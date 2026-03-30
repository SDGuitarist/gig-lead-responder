---
title: "feat: Auto-Reply Automation Layer"
type: feat
status: active
date: 2026-03-29
deepened: 2026-03-29
codex_review: 2026-03-29
origin: docs/brainstorms/2026-03-29-auto-reply-automation-brainstorm.md
feed_forward:
  risk: "Portal automation fragility — GigSalad and Yelp can change their website at any time, breaking Playwright scripts. Also: the existing pipeline has never been live-tested and solo/duo rates are estimated."
  verify_first: true
---

# feat: Auto-Reply Automation Layer

## Codex Review Changelog (2026-03-29)

Codex reviewed the deepened plan and found 8 issues. All addressed below:

| # | Issue | Fix |
|---|-------|-----|
| 1 | Yelp truncates messages in email — no pre-pipeline enrichment step | Added explicit Yelp portal enrichment flow: email parse → Playwright reads full message → enriched rawText enters pipeline. New `src/automation/portals/yelp-client.ts` with `fetchLeadDetails()` + `submitReply()`. |
| 2 | `runPipeline(rawText)` would break SSE streaming in server.ts | Replaced with `runPipeline(rawText, hooks?)` supporting optional progress callbacks. Server passes SSE hooks; CLI/automation pass nothing. "Must not change" updated. |
| 3 | Gmail auth script conflicts with server on port 3000 | Added dedicated `scripts/gmail-auth.ts` using port 3001. Token paths and permissions documented explicitly. |
| 4 | Parser confidence was optional ("consider a field") | `parseConfidence` is now required on all ParsedLead types. Low confidence → always hold. Yelp confidence starts low until portal enrichment succeeds. |
| 5 | ParsedLead missing Gmail metadata for replies/audit | Added `threadId`, `messageIdHeader`, `receivedAt` to ParsedLeadBase. Squarespace uses `Reply-To` header as primary client email source. Gmail sender preserves thread context. |
| 6 | Source validation too weak ("sender contains domain") | Replaced with exact allowlisted sender patterns + Gmail SPF/DKIM header checks. Portal URLs removed from SMS (may be tokenized). |
| 7 | Solo/duo rates are estimated, no tests exist — unverified pricing driving auto-send | Added prerequisite: verify Rate_Card_Solo_Duo.md rates. Added guardrail: if format is solo/duo, flag as edge case until rates are confirmed. |
| 8 | Acceptance criteria too weak | Added: fixture-based parser tests, Yelp portal-read verification, DRY_RUN send-proof, /api/analyze preservation test. |

---

## Overview

Add an always-on automation layer to the existing gig-lead-responder that watches Gmail for incoming lead notifications, runs them through the existing 5-stage pipeline, and delivers replies automatically — via Gmail API (Squarespace leads) or Playwright browser automation (GigSalad/Yelp portal leads). Edge cases are held and sent to Alejandro via SMS for manual review.

## Problem Statement / Motivation

Speed wins gigs — the first musician to respond often gets booked. Currently Alejandro writes replies manually, meaning leads can sit for hours. With 5-15 leads per week across three platforms, that's significant lost revenue. (see brainstorm: docs/brainstorms/2026-03-29-auto-reply-automation-brainstorm.md)

## Proposed Solution

Four new capabilities added to the existing TypeScript/Node/Express app:

1. **Gmail Watcher** — detects lead notification emails via polling (60-second interval)
2. **Yelp Portal Enrichment** — reads full client message from Yelp portal (email is truncated)
3. **Edge Case Router** — decides auto-send vs. hold-for-review based on classification + gate + parse confidence
4. **Reply Senders** — Gmail API for email replies, Playwright for portal submissions, Twilio SMS for notifications

### Architecture

```
Gmail Inbox
    │
    ▼
[Gmail Poller] ── checks every 60 seconds for new lead emails
    │
    ▼
[Source Validator] ── exact sender allowlist + SPF/DKIM check
    │
    ▼
[Dedup Check] ── skip if message ID already in processed-ids.json
    │
    ▼
[Lead Parser] ── platform-specific email → ParsedLead (discriminated union)
    │                                       includes parseConfidence
    │
    ├── GigSalad / Squarespace → rawText ready, confidence high/medium
    │
    └── Yelp → rawText truncated, confidence low
            │
            ▼
        [Yelp Portal Client.fetchLeadDetails()] ── Playwright reads full message
            │
            ▼
        Enriched YelpLead → rawText updated, confidence elevated
    │
    ▼
[runPipeline(rawText, hooks?)] ── shared runner: classify → price → context → generate → verify
    │                               hooks: optional progress callbacks for SSE streaming
    │
    ▼
[Edge Case Router] ── check classification + gate + parseConfidence + pricing guardrails
    │
    ├── AutoSend → [Reply Sender]
    │       ├── SquarespaceLead → Gmail API reply (preserves thread context)
    │       ├── GigSaladLead → Playwright portal submit
    │       └── YelpLead → Yelp Portal Client.submitReply()
    │
    └── Hold or Failure → [SMS Notification via Twilio]
            └── Short summary SMS (no portal URLs — may be tokenized)
```

### Shared Pipeline Runner (Codex fix #2)

The existing pipeline orchestration is duplicated in `index.ts` and `server.ts`. Extract to `src/pipeline/run.ts` with optional hooks for progress reporting:

```typescript
// src/pipeline/run.ts
export interface PipelineHooks {
  onStageStart?(stage: number, name: string): void;
  onStageComplete?(stage: number, name: string, ms: number, result?: unknown): void;
}

export async function runPipeline(
  rawText: string,
  hooks?: PipelineHooks
): Promise<PipelineOutput> {
  const timing: Record<string, number> = {};

  hooks?.onStageStart?.(1, "classify");
  const t0 = Date.now();
  const classification = await classifyLead(rawText);
  timing.classify = Date.now() - t0;
  hooks?.onStageComplete?.(1, "classify", timing.classify, classification);

  hooks?.onStageStart?.(2, "price");
  const t1 = Date.now();
  const pricing = lookupPrice(classification);
  timing.price = Date.now() - t1;
  hooks?.onStageComplete?.(2, "price", timing.price, pricing);

  hooks?.onStageStart?.(3, "context");
  const t2 = Date.now();
  const context = await selectContext(classification);
  timing.context = Date.now() - t2;
  hooks?.onStageComplete?.(3, "context", timing.context);

  hooks?.onStageStart?.(4, "generate+verify");
  const t3 = Date.now();
  const { drafts, gate, verified } = await runWithVerification(classification, pricing, context);
  timing["generate+verify"] = Date.now() - t3;
  hooks?.onStageComplete?.(4, "generate+verify", timing["generate+verify"], { gate, verified });

  return { classification, pricing, drafts, gate, verified, timing };
}
```

- **`server.ts`** passes SSE hooks that emit events per stage (preserves existing streaming behavior)
- **`index.ts`** passes no hooks or simple console hooks (preserves CLI behavior)
- **Automation orchestrator** passes no hooks (just needs the final output)

---

## Prerequisites — MUST Complete Before This Plan

The existing pipeline has **never been live-tested** (see docs/HANDOFF.md). Before building automation:

1. Add `ANTHROPIC_API_KEY` to `.env`
2. Run `npm run demo` with the quinceanera fixture
3. Verify classification, pricing, and draft output are correct
4. **Verify solo/duo rates** — HANDOFF.md says "solo/duo rates were estimated from PRICING_TABLES.md ranges — may need correction." Find or recreate `Rate_Card_Solo_Duo.md` and verify `src/data/rates.ts` entries for `SOLO_RATES` and `DUO_RATES`. *(Codex fix #7)*
5. Fix any issues found
6. Run `/workflows:review` on the existing `feat/gig-lead-pipeline` branch
7. Run `/workflows:compound` to document learnings

**Pricing guardrail (until solo/duo rates are verified):** If `classification.format_recommended` is `"solo"` or `"duo"`, the edge case router MUST hold for review. Remove this guardrail only after rates are confirmed against a real rate card. *(Codex fix #7)*

**Do not start Phase 1 until the pipeline produces correct output on real API calls AND solo/duo rates are verified.**

---

## Gmail Auth Bootstrap (Codex fix #3)

Gmail OAuth requires a one-time browser authorization. This needs its own script because the existing server uses port 3000.

**Dedicated auth script:** `scripts/gmail-auth.ts`
- Uses port **3001** for the OAuth callback (avoids conflict with Express server on 3000)
- Reads `credentials.json` from project root
- Writes token to `data/gmail-token.json` with permissions `0o600`
- Run once: `npx tsx scripts/gmail-auth.ts`

**Token file paths:**
| File | Path | Permissions | Gitignored |
|------|------|-------------|------------|
| OAuth credentials | `credentials.json` | 0600 | Yes (add to .gitignore) |
| OAuth token | `data/gmail-token.json` | 0600 | Yes (data/ is gitignored) |

**Config references:**
```
GMAIL_CREDENTIALS_PATH=credentials.json
GMAIL_TOKEN_PATH=data/gmail-token.json
```

---

## Implementation Phases (4 Phases)

### Phase 1: Pipeline Refactor + Gmail Watcher + Foundation

Extract the shared pipeline runner, build the email watcher, config, logging, and dedup.

**Tasks:**
- [ ] Extract `runPipeline(rawText, hooks?)` into `src/pipeline/run.ts`
- [ ] Refactor `src/server.ts` to call `runPipeline()` with SSE hooks — verify `/api/analyze` behavior is identical
- [ ] Refactor `src/index.ts` to call `runPipeline()` — verify CLI behavior is identical
- [ ] Create `scripts/gmail-auth.ts` — standalone OAuth bootstrap on port 3001
- [ ] Create `src/automation/config.ts` — typed settings from `.env`
- [ ] Create `src/automation/logger.ts` — structured JSON logger → `logs/leads.jsonl`
- [ ] Create `src/automation/dedup.ts` — JSON file dedup
- [ ] Create `src/automation/source-validator.ts` — exact sender allowlist + header checks
- [ ] Create `src/automation/gmail-watcher.ts` — Gmail API poller (60-second interval)
- [ ] Add `DRY_RUN=true` env variable (default true)
- [ ] Update `.gitignore`: add `data/`, `logs/`, `credentials.json`, `token.json`

#### Source Validation (Codex fix #6)

Substring matching ("sender contains gigsalad.com") is insufficient for auto-send. Use exact patterns:

```typescript
// src/automation/source-validator.ts
const ALLOWED_SENDERS: Record<string, RegExp> = {
  gigsalad: /^(leads|noreply|notifications)@gigsalad\.com$/i,
  yelp: /^(no-reply|biz-alerts)@yelp\.com$/i,
  squarespace: /^(form-submission|noreply)@squarespace\.(com|info)$/i,
};

interface ValidationResult {
  valid: boolean;
  platform?: "gigsalad" | "yelp" | "squarespace";
  reason?: string;
}

export function validateSource(fromHeader: string, authHeaders: GmailHeaders): ValidationResult {
  // 1. Extract email from "Display Name <email@domain>" format
  // 2. Match against exact allowlist
  // 3. Check SPF/DKIM pass via Gmail's Authentication-Results header
  // 4. Reject if SPF/DKIM fail (spoofed email)
}
```

**Gmail provides authentication headers** in the message metadata. Check `Authentication-Results` for `spf=pass` and `dkim=pass` before trusting the sender.

**SMS guidance (Codex fix #6):** Do NOT include portal URLs in SMS messages — they may contain session tokens or be time-limited. SMS content should be: "HOLD: [Platform] lead — [event type], $[budget]. [N reasons]. Check logs for details."

**Success criteria:** System detects new lead emails within 60 seconds, validates sender authenticity, and logs them. `/api/analyze` SSE streaming works identically after refactor.

**Key files:** `src/pipeline/run.ts`, `scripts/gmail-auth.ts`, `src/automation/config.ts`, `src/automation/logger.ts`, `src/automation/dedup.ts`, `src/automation/source-validator.ts`, `src/automation/gmail-watcher.ts`

---

### Phase 2: Lead Parsers + Yelp Enrichment + Edge Case Router

Parse platform emails, enrich Yelp leads via portal, route to auto-send or hold.

**Tasks:**
- [ ] Create `src/automation/types.ts` — ParsedLead discriminated union + RouterResult + ParseConfidence
- [ ] Create `src/automation/parsers/index.ts` — router by validated platform
- [ ] Create `src/automation/parsers/gigsalad.ts`
- [ ] Create `src/automation/parsers/yelp.ts` — email parse only (truncated rawText, confidence: low)
- [ ] Create `src/automation/parsers/squarespace.ts` — uses Reply-To header for client email
- [ ] Create `src/automation/portals/yelp-client.ts` — shared Playwright client with `fetchLeadDetails()` + `submitReply()`
- [ ] Save 2-3 real example emails per platform to `examples/emails/` (stripped of personal info)
- [ ] Create fixture-based parser tests: `tests/parsers/` with captured real emails
- [ ] Create `src/automation/router.ts` — edge case detection with confidence + pricing guardrails

#### Type-Safe ParsedLead (Codex fixes #4 and #5)

```typescript
// src/automation/types.ts
type ParseConfidence = "high" | "medium" | "low";

interface ParsedLeadBase {
  rawText: string;
  parseConfidence: ParseConfidence;  // REQUIRED — not optional (Codex fix #4)
  parseWarnings: string[];
  clientName?: string;
  eventDate?: string;
  // Gmail metadata for replies and audit (Codex fix #5)
  gmailMessageId: string;
  threadId: string;
  messageIdHeader: string;  // Message-ID header for In-Reply-To
  receivedAt: Date;
}

interface GigSaladLead extends ParsedLeadBase {
  platform: "gigsalad";
  portalUrl: string;
}

interface YelpLead extends ParsedLeadBase {
  platform: "yelp";
  portalUrl: string;
  enriched: boolean;  // false after email parse, true after portal read
}

interface SquarespaceLead extends ParsedLeadBase {
  platform: "squarespace";
  clientEmail: string;        // REQUIRED — from Reply-To header (Codex fix #5)
  replyToHeader: string;      // Raw Reply-To for audit
}

type ParsedLead = GigSaladLead | YelpLead | SquarespaceLead;
```

**Confidence rules:**
- GigSalad: `"high"` if all expected fields extracted, `"medium"` if some missing, `"low"` if rawText extraction failed
- Yelp: always `"low"` until portal enrichment succeeds (email is truncated), then `"high"`
- Squarespace: `"high"` if Reply-To header present and rawText extracted, `"medium"` otherwise

**Any `"low"` confidence lead MUST route to hold — no exceptions.** *(Codex fix #4)*

#### Yelp Portal Enrichment (Codex fix #1)

Yelp notification emails truncate the client's message. The full message must be read from the portal before the pipeline runs.

```typescript
// src/automation/portals/yelp-client.ts
import { chromium, BrowserContext } from "playwright";

export class YelpPortalClient {
  private context: BrowserContext | null = null;
  private dataDir = "data/browser/yelp";

  /** Read the full lead message from the Yelp portal */
  async fetchLeadDetails(portalUrl: string): Promise<{
    fullMessage: string;
    clientName?: string;
    success: boolean;
    error?: string;
  }> {
    // 1. Launch persistent context
    // 2. Navigate to portalUrl
    // 3. Check if logged in, re-auth if needed
    // 4. Extract full message text from the conversation page
    // 5. Return enriched data
  }

  /** Submit a reply to a lead on the Yelp portal */
  async submitReply(portalUrl: string, replyText: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    // 1. Navigate to portalUrl
    // 2. Find reply textarea
    // 3. Paste replyText
    // 4. Click submit
    // 5. Verify success
  }

  async close(): Promise<void> {
    await this.context?.close();
  }
}
```

**Orchestrator flow for Yelp leads:**
1. Email parser returns `YelpLead` with `enriched: false`, `parseConfidence: "low"`, `rawText: "(truncated)"`
2. Orchestrator calls `yelpClient.fetchLeadDetails(lead.portalUrl)`
3. If success: update `lead.rawText` with full message, set `enriched: true`, elevate `parseConfidence` to `"high"`
4. If failure: keep `parseConfidence: "low"` → router will hold for review
5. Only enriched Yelp leads enter the pipeline

#### Squarespace Reply-To (Codex fix #5)

Squarespace form notifications include the submitter's email in the `Reply-To` header. This is the primary source for `clientEmail`:

```typescript
// In squarespace parser:
const replyTo = getHeader(msg, "Reply-To");
const clientEmail = extractEmailFromHeader(replyTo);
if (!clientEmail) {
  return { ...lead, parseConfidence: "low", parseWarnings: ["No Reply-To header found"] };
}
```

#### Edge Case Triggers (updated with confidence + pricing guardrails)

| Trigger | Condition |
|---------|-----------|
| Low parse confidence | `parseConfidence === "low"` — **always hold, no exceptions** |
| High budget | `pricing.quote_price > edgeCaseBudgetThreshold` (default $3,000) |
| Gate failed | `verified === false` |
| Flagged concerns | `classification.flagged_concerns.length > 0` |
| Major format correction | Different format *family* (cross-family) |
| Vague + one question | `vagueness === "vague"` AND `action === "one_question"` |
| High-value assumption | `action === "assume_and_quote"` AND `stealth_premium === true` |
| **Unverified solo/duo rates** | `format_recommended` is `"solo"` or `"duo"` — hold until rates confirmed *(Codex fix #7)* |
| Yelp not enriched | `platform === "yelp"` AND `enriched === false` |

**Success criteria:** Fixture-based parser tests pass for all 3 platforms. Yelp portal enrichment retrieves full message. Router correctly holds low-confidence and unverified-rate leads.

**Key files:** `src/automation/types.ts`, `src/automation/parsers/*.ts`, `src/automation/portals/yelp-client.ts`, `src/automation/router.ts`, `tests/parsers/`

---

### Phase 3: Reply Senders + Orchestrator (Gmail + Playwright + Twilio)

All send mechanisms plus the orchestrator that ties everything together.

**Tasks:**
- [ ] Create `src/automation/senders/gmail-sender.ts` — Gmail API send preserving thread context
- [ ] Create `src/automation/portals/gigsalad-client.ts` — Playwright portal submit
- [ ] Create `src/automation/senders/twilio-sms.ts` — thin Twilio wrapper
- [ ] Create `src/automation/orchestrator.ts` — full flow with Yelp enrichment step
- [ ] Create `src/automation/main.ts` — entry point: starts Express + Gmail watcher

#### Gmail Reply Sender (Squarespace leads — Codex fix #5)

```typescript
// src/automation/senders/gmail-sender.ts
export async function sendGmailReply(
  auth: OAuth2Client,
  lead: SquarespaceLead,
  replyBody: string
): Promise<SendResult> {
  // Send with thread context preserved:
  // - To: lead.clientEmail (from Reply-To header)
  // - Subject: "Re: Your Event Inquiry — Alex Guillen Music"
  // - In-Reply-To: lead.messageIdHeader
  // - threadId: lead.threadId
}
```

#### Orchestrator (updated for Yelp enrichment — Codex fix #1)

```typescript
// src/automation/orchestrator.ts
export async function processLead(email: GmailMessage): Promise<void> {
  // 1. Validate source (exact allowlist + SPF/DKIM)
  // 2. Check dedup
  // 3. Parse email → ParsedLead

  // 4. Yelp enrichment step (Codex fix #1)
  if (lead.platform === "yelp" && !lead.enriched) {
    const details = await yelpClient.fetchLeadDetails(lead.portalUrl);
    if (details.success) {
      lead.rawText = details.fullMessage;
      lead.enriched = true;
      lead.parseConfidence = "high";
    }
    // If enrichment fails, confidence stays "low" → router will hold
  }

  // 5. Run pipeline (only if confidence is not "low" — otherwise skip straight to hold)
  if (lead.parseConfidence === "low") {
    await sendSms(`HOLD: ${lead.platform} lead — low parse confidence. Check logs.`);
    markProcessed(lead.gmailMessageId);
    return;
  }

  const output = await runPipeline(lead.rawText);

  // 6. Route
  const result = route(lead, output);

  // 7. Send or hold
  if (result.action === "auto-send") {
    // dispatch to correct sender by platform
  } else {
    await sendSms(`HOLD: ${lead.platform} lead — ${result.reasons.join(", ")}.`);
  }

  // 8. Log + mark processed
}
```

#### File Layout (updated)

```
src/automation/
  main.ts              ← entry point (Express + watcher)
  config.ts
  logger.ts
  dedup.ts
  source-validator.ts
  gmail-watcher.ts
  orchestrator.ts
  router.ts
  types.ts
  parsers/
    index.ts
    gigsalad.ts
    yelp.ts
    squarespace.ts
  portals/              ← NEW: shared portal clients
    yelp-client.ts      ← fetchLeadDetails() + submitReply()
    gigsalad-client.ts  ← submitReply() only
  senders/
    gmail-sender.ts
    twilio-sms.ts
scripts/
  gmail-auth.ts         ← standalone OAuth bootstrap (port 3001)
tests/
  parsers/              ← fixture-based parser tests
  pipeline-run.test.ts  ← verify refactored runPipeline works
```

**Success criteria:** In DRY_RUN mode, full end-to-end flow works without sending anything. Yelp leads are enriched before pipeline. DRY_RUN proof: grep logs for "would have sent" and confirm zero actual sends.

---

### Phase 4: Process Management (Old Mac Setup)

Run as an always-on service on the old Mac.

**Tasks:**
- [ ] Create `ecosystem.config.cjs` for pm2 (points to `src/automation/main.ts`)
- [ ] Create `scripts/setup-old-mac.sh` — install Node, clone repo, npm install, pm2 setup
- [ ] Configure pm2 startup hook: `pm2 startup`
- [ ] Set old Mac energy settings: Prevent automatic sleeping
- [ ] Add heartbeat: if no email processed for 3 days, send SMS health check
- [ ] Run `scripts/gmail-auth.ts` on the old Mac to authorize Gmail

**Success criteria:** Unplug old Mac, plug back in, lead responder auto-starts within 60 seconds.

---

## Plan Quality Gate

1. **What exactly is changing?** Adding `src/automation/` directory + `src/automation/portals/` + extracting `src/pipeline/run.ts` with hooks + `scripts/gmail-auth.ts` + pm2 config + parser tests. Existing pipeline stage code (`src/pipeline/classify.ts`, `price.ts`, `context.ts`, `generate.ts`, `verify.ts`) is NOT modified. Existing prompts and data files are NOT modified.
2. **What must not change?** The existing pipeline *stages* (`src/pipeline/*`, `src/prompts/*`, `src/data/*`). The `src/types.ts` interfaces. The behavior of `POST /api/analyze` (SSE streaming) — refactored to call `runPipeline()` with hooks but output must be identical. The behavior of `npm run demo` CLI mode.
3. **How will we know it worked?** Response time drops from hours to under 2 minutes. Leads get correct, personalized replies. No duplicate or garbage replies. System runs unattended for 1+ weeks. Fixture-based parser tests pass. `/api/analyze` returns identical SSE events before and after refactor.
4. **What is the most likely way this plan is wrong?** (a) Email parsers based on training data, not real emails — must capture real emails first. (b) Playwright selectors for GigSalad/Yelp are guesses until manually verified. (c) Solo/duo rates may still be wrong even after verification attempt if the source rate card is lost.

---

## Acceptance Criteria (Strengthened — Codex fix #8)

### Functional Requirements
- [ ] System detects new lead emails within 60 seconds of arrival
- [ ] Source validation rejects spoofed/unknown sender emails
- [ ] Correct platform identification (GigSalad, Yelp, Squarespace)
- [ ] Yelp leads enriched via portal read before pipeline runs
- [ ] Lead text correctly extracted and fed to existing pipeline
- [ ] Normal leads get auto-reply within 2 minutes of email arrival
- [ ] Edge case leads trigger SMS notification within 30 seconds
- [ ] Low-confidence parses always route to hold — never auto-send
- [ ] Solo/duo format leads held until rates verified
- [ ] Playwright failures fall back to SMS within 10 seconds
- [ ] No duplicate replies sent for the same lead
- [ ] DRY_RUN mode works end-to-end without sending anything

### Testing Requirements (Codex fix #8)
- [ ] **Fixture-based parser tests:** Each parser has tests using captured real email fixtures from `examples/emails/`. Tests verify extraction of all expected fields and correct `parseConfidence` assignment.
- [ ] **Yelp portal-read test:** Verify `fetchLeadDetails()` retrieves full message text from a real Yelp lead (manual verification during DRY_RUN period).
- [ ] **DRY_RUN send proof:** Run system for 1 week in DRY_RUN. Grep `logs/leads.jsonl` for `"status": "sent"` — must find zero. All entries must be `"status": "dry-run"`.
- [ ] **Pipeline refactor preservation test:** Capture `/api/analyze` SSE output for the quinceanera fixture before and after refactor. Diff must show identical stage events (timing may differ).
- [ ] **Source validator test:** Send test email with spoofed From header — must be rejected.

### Non-Functional Requirements
- [ ] Service auto-restarts after crash or Mac reboot
- [ ] Gmail OAuth tokens auto-refresh without manual intervention
- [ ] All leads logged with full audit trail in `logs/leads.jsonl`
- [ ] Credentials never appear in logs
- [ ] Express bound to `127.0.0.1`

### Quality Gates
- [ ] DRY_RUN testing with real emails from all 3 platforms before enabling auto-send
- [ ] 1 week of DRY_RUN monitoring before switching to live mode
- [ ] Manual verification of at least 10 auto-generated replies before trusting the system
- [ ] Solo/duo rates verified against actual rate card before removing guardrail

---

## Security Considerations

### Source Validation (Codex fix #6)
- Exact regex allowlist per platform sender — not substring matching
- Gmail `Authentication-Results` header checked for SPF/DKIM pass
- Emails failing SPF/DKIM are rejected even if sender matches allowlist
- Unknown senders logged and skipped silently (no SMS — could be spam)

### SMS Content (Codex fix #6)
- Do NOT include portal URLs in SMS — may contain session tokens or be time-limited
- SMS limited to: platform name, event type (generic), budget range, hold reason count
- Full details available only in `logs/leads.jsonl` on the Mac

### Credential Storage
- Portal passwords in `.env` — gitignored, `chmod 600`, FileVault required
- Gmail tokens in `data/gmail-token.json` — `chmod 600`, gitignored
- Playwright sessions in `data/browser/` — gitignored
- All `data/` and `logs/` directories in `.gitignore`

---

## Most Likely Failure Modes Still Remaining

Even after all Codex fixes, these risks persist:

1. **Parser drift.** Platform email templates change without notice. Parsers based on captured emails will eventually break. **Mitigation:** parseConfidence ensures broken parsers route to hold, not to auto-send with garbage. Weekly manual portal check.

2. **Playwright selector rot.** GigSalad and Yelp redesign their portals periodically. All selectors are educated guesses until manually verified. **Mitigation:** Screenshot on failure + SMS fallback. No silent failures.

3. **Solo/duo rate card may be permanently lost.** HANDOFF.md says `Rate_Card_Solo_Duo.md` was never found. If the original rate card doesn't exist, the estimated rates must be manually confirmed by Alejandro against his actual pricing. The guardrail (hold all solo/duo leads) prevents incorrect quotes from being auto-sent.

4. **Yelp anti-bot detection.** Yelp is known to be aggressive about bot detection. The persistent context + anti-detection flags may not be enough. If Yelp consistently blocks Playwright, Yelp leads permanently fall back to SMS notification (system degrades gracefully but Yelp auto-reply is lost).

5. **Gmail OAuth token revocation.** If Google revokes the token (rare), the entire system stops watching. **Mitigation:** SMS alert on auth failure, clear error message to re-run `scripts/gmail-auth.ts`.

---

## Dependencies & Prerequisites

| Dependency | What | Status |
|-----------|------|--------|
| Pipeline validation | Run existing pipeline with real API key, fix issues | NOT DONE — blocks everything |
| Solo/duo rate verification | Verify SOLO_RATES and DUO_RATES in rates.ts | NOT DONE — blocks auto-send for solo/duo |
| Gmail API credentials | Google Cloud project + OAuth consent screen | Need to set up |
| Gmail auth bootstrap | Run `scripts/gmail-auth.ts` on target machine | Need to build |
| Twilio account | Account SID, auth token, phone number | Need to set up |
| GigSalad credentials | Login email + password for portal | Have (in password manager) |
| Yelp credentials | Login email + password for portal | Have (in password manager) |
| Real email fixtures | 2-3 emails per platform in `examples/emails/` | Need to capture |
| Old Mac setup | Node.js, pm2, repo clone, .env | Need to set up |
| npm packages | `googleapis`, `google-auth-library`, `playwright`, `twilio`, `cheerio` | Need to install |

## Risk Analysis & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| GigSalad/Yelp change website layout | Medium | Playwright breaks | Screenshot + SMS fallback, weekly manual check |
| Yelp blocks Playwright | Medium | Yelp auto-reply lost | Degrade to SMS-only for Yelp leads |
| Gmail OAuth token revoked | Low | System stops watching | SMS alert + re-auth script |
| Bad pipeline output auto-sent | Medium | Wrong quote | DRY_RUN week, edge case guardrails, solo/duo hold |
| Email template change breaks parser | Medium | Bad rawText | parseConfidence ensures broken parsers → hold |
| Solo/duo rates are wrong | Medium | Wrong quote for solo/duo | Hold all solo/duo until rates verified |
| Spoofed email triggers pipeline | Low | Wasted API call or bad reply | SPF/DKIM check + exact sender allowlist |

## Success Metrics

- **Response time:** < 2 minutes from email arrival to reply sent (currently: hours)
- **Automation rate:** > 60% of leads auto-sent without manual intervention (lower than before due to solo/duo guardrail)
- **Error rate:** < 5% of leads result in failures requiring manual intervention
- **Uptime:** System running > 99% of the time

## Feed-Forward

- **Hardest decision:** How to handle Yelp's truncated email messages — resolved by adding a pre-pipeline portal enrichment step.
- **Rejected alternatives:** Perplexity Computer, Zapier, notification-only approach, SQLite for dedup, dashboard in v1.
- **Least confident:** Yelp anti-bot detection. If Yelp aggressively blocks Playwright, both enrichment and reply submission fail, making Yelp leads permanently manual. This is the single biggest automation coverage risk.

---

## Sources & References

### Origin
- **Brainstorm document:** [docs/brainstorms/2026-03-29-auto-reply-automation-brainstorm.md](docs/brainstorms/2026-03-29-auto-reply-automation-brainstorm.md)

### Internal References
- Pipeline types: `src/types.ts`
- Existing server: `src/server.ts`
- Pipeline entry: `src/pipeline/verify.ts:runWithVerification()`
- HANDOFF: `docs/HANDOFF.md` — pipeline status, solo/duo rate uncertainty, no tests

### Implementation Guides (from Deep Research)
- **Gmail API:** [docs/research/gmail-api-setup-guide.md](../research/gmail-api-setup-guide.md)
- **Playwright Portals:** [docs/research/playwright-portal-automation.md](../research/playwright-portal-automation.md)
- **Email Parsing:** [docs/research/email-parsing-research.md](../research/email-parsing-research.md)
- **Twilio + pm2:** [docs/research/twilio-pm2-setup-guide.md](../research/twilio-pm2-setup-guide.md)
