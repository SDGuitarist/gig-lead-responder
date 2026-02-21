---
title: "feat: Production Automation Loop"
type: feat
date: 2026-02-20
brainstorm: docs/brainstorms/2026-02-20-production-loop-brainstorm.md
revised: 2026-02-20 (plan_review simplifications applied)
---

# feat: Production Automation Loop

## Overview

Wrap the existing 5-stage AI pipeline in a fully automated delivery loop:
**Email in -> Pipeline runs -> SMS draft to Alex -> Approve/edit via reply -> Copy-paste from dashboard.**

No existing code changes except extracting `runPipeline()` into a shared function. Everything else is purely additive — new files for email ingestion, SMS handling, lead persistence, and dashboard routes, all wired into the existing Express server.

## Problem Statement / Motivation

The current flow requires Alex to manually check email, open the web UI, paste the lead text, wait for the pipeline, and copy the response. That takes 5-10 minutes per lead. **Speed wins gigs** — the first musician to respond often gets booked. This loop delivers a ready-to-send draft to Alex's phone in under 60 seconds, with one-word approval.

## Proposed Solution

```
Gmail auto-forward -> Mailgun inbound webhook -> Express server
  -> Validate HMAC + dedup by Message-Id
  -> Parse email fields (regex, fallback to raw text if parsing fails)
  -> Persist lead to SQLite (status: received)
  -> Respond 200 to Mailgun immediately
  -> Run pipeline async (classify -> price -> context -> generate -> verify)
  -> On success: update lead with draft + classification, set status to sent
  -> Send compressed draft + lead ID via Twilio SMS
  -> Alex replies "YES" or "YES-42" -> Confirmation SMS + dashboard link
  -> Alex replies with edit instructions -> Re-run generate+verify only (max 3 rounds)
  -> Pipeline failure -> status: failed, SMS sends [REVIEW NEEDED]
```

**Full draft delivery:** On approval, Alex receives a short confirmation SMS with a deep link to the dashboard (`/leads/:id`) where the full formatted draft is displayed for copy-paste. This is cheaper ($0.01 vs $0.15-0.20) and more readable than sending 15-20 SMS segments.

## Technical Approach

### New Dependencies

| Package | Purpose |
|---|---|
| `better-sqlite3` | Synchronous SQLite driver, WAL mode |
| `@types/better-sqlite3` | TypeScript types (dev) |
| `twilio` | SMS send + receive + signature validation |

No Mailgun SDK needed — webhook is just an Express route with HMAC validation using Node's built-in `crypto`.

### New Files (flat structure)

| File | Purpose |
|---|---|
| `src/leads.ts` | SQLite init, LeadRecord CRUD, status transitions |
| `src/mailgun.ts` | Mailgun webhook handler + HMAC validation + email parser |
| `src/twilio.ts` | SMS send, receive replies, Twilio signature validation |
| `src/dashboard.ts` | Express router for `/leads` with Basic Auth inline |
| `src/run-pipeline.ts` | Extracted `runPipeline(rawText)` shared by CLI, web UI, and automation |
| `src/types.ts` | Add `LeadRecord`, `LeadStatus` types (existing file) |
| `src/server.ts` | Mount new routers + webhook routes (existing file) |

No single-file directories. Auth middleware (~10 lines) lives inline in `dashboard.ts`. Webhook routes mount directly in `server.ts`.

### TypeScript Types (added to `src/types.ts`)

```typescript
// 4 states only. edit_round column tracks revision count.
export type LeadStatus = "received" | "sent" | "done" | "failed";

export interface LeadRecord {
  id: number;                          // auto-increment, doubles as SMS short ID
  source_platform: string | null;      // "gigsalad" | "thebash" | "unknown"
  mailgun_message_id: string | null;   // dedup key from email headers
  raw_email: string;                   // full email body as received
  client_name: string | null;          // null = regex parsing failed
  event_date: string | null;
  event_type: string | null;
  venue: string | null;
  guest_count: number | null;
  budget_note: string | null;
  status: LeadStatus;
  classification_json: string | null;  // JSON string, deserialized as Classification
  pricing_json: string | null;         // JSON string, deserialized as PricingResult
  full_draft: string | null;           // current/final draft (inline, no versioning table)
  compressed_draft: string | null;
  gate_passed: boolean | null;         // true = verified, false = failed gate
  gate_json: string | null;            // JSON string, deserialized as GateResult
  edit_round: number;                  // 0 = initial, 1-3 = edit rounds
  edit_instructions: string | null;    // most recent edit request from Alex
  done_reason: string | null;          // "approved" | "max_edits" | "pipeline_error"
  created_at: string;                  // ISO 8601
  updated_at: string;                  // ISO 8601
}
```

The store layer (`src/leads.ts`) handles JSON serialization/deserialization. Functions like `getLead(id)` return `LeadRecord` with JSON fields as strings; callers parse as needed with `JSON.parse()`.

### SQLite Schema (single table)

```sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_platform TEXT,
  mailgun_message_id TEXT UNIQUE,       -- dedup: reject duplicate webhooks
  raw_email TEXT NOT NULL,
  client_name TEXT,                     -- null = regex parsing failed (no separate flag)
  event_date TEXT,
  event_type TEXT,
  venue TEXT,
  guest_count INTEGER,
  budget_note TEXT,
  status TEXT NOT NULL DEFAULT 'received',
  classification_json TEXT,
  pricing_json TEXT,
  full_draft TEXT,
  compressed_draft TEXT,
  gate_passed INTEGER,                  -- 1 = verified, 0 = failed
  gate_json TEXT,
  edit_round INTEGER NOT NULL DEFAULT 0,
  edit_instructions TEXT,
  done_reason TEXT,                     -- "approved" | "max_edits" | "pipeline_error"
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
```

**Simplifications applied (from plan review):**
- 1 table instead of 3 (cut `draft_versions` and `sms_log`)
- Auto-increment integer ID doubles as SMS short ID (cut UUID + `short_id`)
- Current draft stored inline (no versioning — Alex never needs old drafts)
- `client_name = null` signals unparsed lead (cut `parse_fallback` column)
- Cut `expires_at` column (no expiration mechanism — see rationale below)
- `mailgun_message_id UNIQUE` prevents duplicate webhook processing
- SMS history available in Twilio's console (no need to duplicate it)

### Lead State Machine (4 states)

```
received --> sent --> done
               |
               +--> sent (edit_round + 1, up to 3)
         |
         +--> failed
```

| Transition | Trigger | Side effect |
|---|---|---|
| `received -> sent` | Pipeline succeeds, SMS delivered | Stores classification, pricing, draft |
| `received -> failed` | Pipeline error or stuck >5 min | SMS: `[REVIEW NEEDED] Lead #42 failed` |
| `sent -> sent` | Alex sends edit instructions (round < 3) | Re-runs generate+verify, sends new draft |
| `sent -> done` | Alex replies YES/approve | `done_reason = "approved"`, SMS: confirmation + dashboard link |
| `sent -> failed` | 3rd edit round exhausted | `done_reason = "max_edits"`, SMS: `[MAX REVISIONS] Check dashboard` |

**Why no `processing`, `drafted`, `delivered`, `editing`, `expired`, or `max_edits` states:**
- `processing` — the pipeline runs for ~10 seconds. If it succeeds, go to `sent`. If it fails or gets stuck, go to `failed`. No user-facing scenario where Alex needs to see "processing."
- `drafted` — exists for the millisecond between pipeline completion and SMS send. Not worth a state.
- `delivered` — no action between approval and delivery. The dashboard link IS the delivery.
- `editing` — `sent` with `edit_round > 0` communicates the same information.
- `expired` — see "Why no expiration" below.
- `max_edits` — `failed` with `done_reason = "max_edits"` communicates the same information.

**Why no expiration mechanism:** A lead sitting in `sent` state costs nothing — no resources, no notifications. If Alex doesn't reply, the gig opportunity is gone anyway. The most-recent fallback uses `ORDER BY created_at DESC`, so old leads naturally sort to the bottom. If cleanup is needed later, add a dashboard "archive" button.

### Stuck Lead Recovery

`setInterval` every 5 minutes checks for leads in `received` status where `created_at` is more than 5 minutes old. These are pipeline crashes (process restart, OOM, Anthropic timeout). Transitions them to `failed` with `done_reason = "pipeline_error"` and sends an SMS notification.

This is restart-safe because it's query-based — no in-memory timers to lose on deploy.

### SMS Parsing Rules

Inbound SMS matching (case-insensitive):

```typescript
// Approval: YES, Y, APPROVE, OK — optionally followed by - or space + integer lead ID
const APPROVAL_PATTERN = /^(yes|y|approve|ok)(?:[-\s](\d+))?$/i;

// Everything else is treated as edit instructions
```

- **With ID:** `YES-42`, `yes 42`, `y-42` — matches specific lead by integer ID
- **Without ID:** `YES` alone — falls back to most recent `sent` lead (`ORDER BY created_at DESC LIMIT 1`)
- **Edit with ID:** If message doesn't match approval pattern and starts with `#42` or `42:`, route to that lead
- **Edit without ID (single pending lead):** Route to the only `sent` lead
- **Edit without ID (multiple pending leads):** Reply with `"Multiple leads pending. Specify ID: #42, #43"` — do NOT guess which lead to edit
- **No `sent` leads found:** Reply with `"No pending leads. Check dashboard at {BASE_URL}/leads"`

### Edit Round Pipeline

When Alex sends edit instructions, only **generate + verify** re-run. Classification and pricing are already correct — re-running them wastes API calls and could produce different results.

```
edit instructions arrive
  -> load existing classification + pricing from lead record
  -> call generateResponse(classification, pricing, context, [editInstructions])
  -> call runWithVerification() with edit instructions as rewrite guidance
  -> update lead: full_draft, compressed_draft, gate_json, edit_round + 1
  -> send new compressed draft via SMS
```

If `edit_round` reaches 3 and Alex sends another edit request:
- Transition to `failed` with `done_reason = "max_edits"`
- SMS: `"Max revisions reached for lead #42. Full draft on dashboard: {BASE_URL}/leads/42"`

### Webhook Response Strategy

**Mailgun webhook:**
1. Validate HMAC signature (reject with 401 if invalid)
2. Check timestamp freshness (reject if >5 minutes old — compares Mailgun's Unix timestamp to `Date.now()`)
3. Check `mailgun_message_id` for duplicates (reject with 200 if already processed — prevents re-triggering on Mailgun retry)
4. Parse email fields
5. Persist lead to SQLite with status `received`
6. **Respond 200 immediately**
7. Run pipeline async — fire-and-forget promise with error handling:

```typescript
res.status(200).send("OK");
processLead(leadId).catch(err => {
  updateLeadStatus(leadId, "failed", "pipeline_error");
  sendSms(`[REVIEW NEEDED] Lead #${leadId} failed: ${err.message}`);
});
```

Note: NOT `setImmediate()`. The response is sent first, then the promise runs. Unhandled rejections are caught explicitly.

**Twilio webhook:**
1. Validate `X-Twilio-Signature` (reject with 401 if invalid)
2. Parse SMS body with `APPROVAL_PATTERN`
3. Look up lead by ID or most-recent fallback (`ORDER BY created_at DESC`)
4. Process reply (approve, re-generate, or error response)
5. Respond with TwiML (empty `<Response/>` — Twilio requires XML response)

### Anthropic 429 Handling

The existing `callClaude()` helper (`src/claude.ts`) retries once on JSON parse failure. Add a second retry path: if the Anthropic API returns 429, wait 60 seconds and retry once. If still 429, throw — the webhook error handler will transition the lead to `failed` and send an SMS.

This is 5-10 lines added to `src/claude.ts`, not a "future enhancement."

### Environment Variables (New)

| Variable | Purpose |
|---|---|
| `MAILGUN_SIGNING_KEY` | HMAC validation for inbound webhooks |
| `TWILIO_ACCOUNT_SID` | Twilio auth |
| `TWILIO_AUTH_TOKEN` | Twilio auth + signature validation |
| `TWILIO_PHONE_NUMBER` | Outbound SMS sender |
| `ALEX_PHONE_NUMBER` | SMS recipient |
| `DASHBOARD_USER` | Basic Auth username for `/leads` |
| `DASHBOARD_PASS` | Basic Auth password for `/leads` |
| `BASE_URL` | Railway production URL, no trailing slash (used for dashboard deep links in SMS) |
| `DATABASE_PATH` | Path to SQLite file on Railway Volume (default: `./data/leads.db`) |

`BASE_URL` must not have a trailing slash. Strip it in code if present.

## Acceptance Criteria

### Core Loop
- [ ] Forwarded lead email from GigSalad/The Bash triggers pipeline automatically
- [ ] Compressed draft arrives on Alex's phone via SMS within 60 seconds
- [ ] Reply "YES" (or "YES-42") approves the lead and sends dashboard link
- [ ] Reply with edit instructions re-runs generate+verify and sends new draft
- [ ] 3 edit rounds max, then `failed` with `done_reason = "max_edits"`

### Persistence
- [ ] All leads persisted to SQLite with full email body, classification, and pricing
- [ ] Current draft stored inline on lead record (updated on each edit round)
- [ ] Duplicate emails rejected via `mailgun_message_id` UNIQUE constraint

### Security
- [ ] Mailgun webhook validates HMAC signature + timestamp freshness (<5 min)
- [ ] Twilio webhook validates X-Twilio-Signature
- [ ] Dashboard protected by Basic Auth (served over HTTPS via Railway)
- [ ] All webhook endpoints return appropriate status codes for invalid signatures

### Dashboard
- [ ] `GET /leads` lists all leads with status, edit_round, timestamps
- [ ] `GET /leads/:id` shows full lead detail with copy-paste ready draft
- [ ] Leads with `client_name = null` are visually distinct (unparsed email)

### Error Handling
- [ ] Pipeline error -> lead enters `failed` state, SMS sends `[REVIEW NEEDED]`
- [ ] Stuck leads (`received` > 5 min) -> recovered to `failed` by interval check
- [ ] Anthropic 429 -> retry once after 60s, then fail
- [ ] Duplicate Mailgun webhook -> rejected with 200 (no re-processing)
- [ ] Non-lead email -> logged as ignored, no SMS sent
- [ ] Multiple pending leads + edit without ID -> SMS asks Alex to specify ID
- [ ] No pending leads + reply -> SMS says "No pending leads"

### Deployment
- [ ] Runs on Railway with persistent SQLite on Volume
- [ ] All env vars documented and configured
- [ ] `npm run serve` as the production entry point

## Implementation Phases

| Phase | Description | Key Files |
|---|---|---|
| 1 | SQLite store + LeadRecord types + CRUD functions | `src/leads.ts`, `src/types.ts` |
| 2 | Twilio SMS sender (outbound only, hardcoded test) | `src/twilio.ts` |
| 3 | Mailgun webhook + email parser + HMAC validation | `src/mailgun.ts` |
| 4 | Extract `runPipeline()` + wire Mailgun -> pipeline -> Twilio | `src/run-pipeline.ts`, `src/server.ts` |
| 5 | Twilio reply webhook + YES/edit handler | `src/twilio.ts`, `src/server.ts` |
| 6 | Dashboard with Basic Auth | `src/dashboard.ts`, `src/server.ts` |
| 7 | Railway deployment + env config | `railway.json`, `Procfile`, `.env.example` |
| 8 | Gmail forward filter + end-to-end test | Setup docs |

Each phase is a separate work session with its own commit(s). Phases 1-3 can be developed and tested independently. Phase 4 is the first integration point. Phases 5-6 complete the user-facing loop. Phases 7-8 are deployment and configuration.

**Phase 4 note:** This is the only phase that touches existing code — extracting the inline pipeline orchestration from `src/server.ts:40-94` into `src/run-pipeline.ts`. The SSE handler and CLI both call the extracted function. This prevents a third inline copy in the webhook handler.

## Dependencies & Risks

### Dependencies
- **Gmail -> Mailgun forwarding** must be configured before Phase 3 can be tested end-to-end
- **Twilio phone number** must be provisioned before Phase 2
- **Railway account + Volume** must be set up before Phase 7
- **Sample lead emails** from GigSalad and The Bash are needed to write accurate regex parsers in Phase 3. Without them, the parser falls back to raw text (null parsed fields).

### Risks

| Risk | Impact | Mitigation |
|---|---|---|
| GigSalad/The Bash changes email template | Parser breaks silently | Null parsed fields + dashboard shows unparsed leads distinctly |
| Gmail forwarding wraps email in "Forwarded message" | Regex targets wrong content | Parse Gmail forwarding format first, then extract original body |
| Mailgun 30s webhook timeout | Duplicate processing if pipeline slow | Persist lead + dedup by `mailgun_message_id` + respond 200 + process async |
| SQLite on wrong Railway filesystem | Data loss on every deploy | Document Railway Volume setup explicitly in Phase 7 |
| Twilio URL mismatch after redeploy | Signature validation silently fails | Store `BASE_URL` in env, strip trailing slash, validate in health check |
| Anthropic API 429 during pipeline | Lead stuck in `received` | Retry once after 60s in `callClaude()`. Stuck lead recovery catches remaining failures. |
| Pipeline crash (OOM, process restart) | Lead stuck in `received` | `setInterval` every 5 min marks `received` leads older than 5 min as `failed` |

## Pre-requisites Before Phase 3

> **Action needed:** Save 2-3 sample lead notification emails from GigSalad and The Bash (redact personal details) to `examples/` directory. The email parser cannot be accurately built without knowing the actual email format. The Gmail forwarding wrapper must also be accounted for.

## Plan Review Changes (2026-02-20)

Simplifications applied after parallel review by 3 agents (DHH, Kieran, Simplicity):

| Change | Before | After | Rationale |
|---|---|---|---|
| Database tables | 3 (`leads`, `draft_versions`, `sms_log`) | 1 (`leads`) | Draft versioning unused by single user; SMS log duplicates Twilio console |
| Lead states | 8-10 | 4 (`received`, `sent`, `done`, `failed`) | Edit round tracked by column, not state; no expiration needed |
| Lead ID | UUID + 6-char `short_id` | Auto-increment integer | `YES-42` is easier to type than `YES-abc123` |
| Draft storage | Separate versioned table | Inline on leads table | Alex never needs old draft versions |
| Parse failure | `parse_fallback` flag column | `client_name = null` | Null fields are self-documenting |
| Expiration | `setInterval` + `expires_at` + `expired` state | Cut entirely | Idle leads cost nothing; sort by recency for fallback |
| File structure | 6 new files in 4 subdirectories | 4 new files flat in `src/` | No single-file directories |
| Async pattern | `setImmediate()` | Fire-and-forget promise with `.catch()` | Correct Express pattern; explicit error handling |
| Anthropic 429 | "Future enhancement" | Retry once after 60s | 5-10 lines; not optional for production |
| Duplicate emails | Not handled | `mailgun_message_id UNIQUE` | Prevents re-processing on webhook retry |
| Edit re-runs | Unspecified | Generate + verify only | Classification/pricing already correct |
| Stuck leads | Not handled | `received` > 5 min -> `failed` | Catches pipeline crashes |
| Foreign keys | Decorative | `PRAGMA foreign_keys = ON` | Actually enforced |
| Multi-lead edits | Unspecified | Require ID when multiple `sent` leads exist | Prevents routing edits to wrong lead |

## References

- **Brainstorm:** `docs/brainstorms/2026-02-20-production-loop-brainstorm.md`
- **Pipeline entry points:** `src/server.ts:40-94` (SSE handler), `src/index.ts:34-66` (CLI)
- **Existing types:** `src/types.ts` (Classification, PricingResult, Drafts, GateResult, PipelineOutput)
- **Claude helper:** `src/claude.ts` (callClaude<T>, callClaudeText)
- **Pipeline functions:** `src/pipeline/classify.ts`, `src/pipeline/price.ts`, `src/pipeline/context.ts`, `src/pipeline/generate.ts`, `src/pipeline/verify.ts`
- **Architecture notes:** `docs/HANDOFF.md`
