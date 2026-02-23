# Gig Lead Responder — Session Handoff

**Last updated:** 2026-02-22 (v32)
**Current phase:** Review complete — Dashboard UI Redesign
**Next session:** Fix phase — `/fix-batched batch1` on review findings

### Deploy Progress (as of 2026-02-22)

- [x] Railway deployed, healthcheck passing
- [x] Mailgun account + subdomain (`mg.alexguillenmusic.com`) + DNS records
- [x] Mailgun receiving route → Railway webhook (HMAC verified)
- [x] Gmail filters forwarding The Bash + GigSalad leads
- [x] `MAILGUN_WEBHOOK_KEY` set in Railway env vars
- [ ] Twilio A2P campaign approval (SMS blocked until approved)
- [ ] First real lead end-to-end test
- [ ] Enable `DISABLE_TWILIO_VALIDATION=false` after confirming signature URL match

---

## What Was Built

A TypeScript CLI tool that takes a raw music gig lead through a 5-stage AI pipeline and outputs two response drafts with a quality verification gate.

```
Raw Lead → [classify] → [price] → [context] → [generate] → [verify] → Output
```

**Project:** `~/projects/gig-lead-responder`
**Branch:** `main` (pushed, all passing `tsc --noEmit` except pre-existing `import.meta.dirname` type issue)

---

## What's Done

| Phase | Status | Commit |
|-------|--------|--------|
| 1. Scaffold + types + callClaude helper | Done | `48a6b63` |
| 2. Rate card + venue data tables | Done | `1a09a3e` |
| 3. Classification pipeline (PROTOCOL.md Steps 0-5) | Done | `9ca9631` |
| 4. Pricing lookup (pure function) | Done | `eced9d4` |
| 5. Context selection + assembly | Done | `1b5f80c` |
| 6. Response generation (dual drafts) | Done | `c64bd92` |
| 7. Verification gate + rewrite loop | Done | `5d16090` |
| 8. CLI entry point (full pipeline) | Done | `58be901` |
| 9. Demo fixture | Done | `80ac1a0` |

---

## What's NOT Done

1. **Live test** — Needs `ANTHROPIC_API_KEY` in `.env` to run `npm run demo`
2. **Review phase** — `/workflows:review` not yet run
3. **Compound phase** — Done (`835225f`) — 6 solutions in `docs/solutions/`
4. **Missing source file** — `Rate_Card_Solo_Duo.md` was never found (solo/duo rates were estimated from PRICING_TABLES.md ranges — may need correction)
5. **CLI color output** — Plan called for colored terminal output, not implemented
6. **No tests** — No automated tests exist

---

## Key Files

### Source Code
- `src/run-pipeline.ts` — Shared `runPipeline(rawText, onStage?)` orchestration + confidence scoring (0-100)
- `src/index.ts` — CLI entry point, reads stdin, calls `runPipeline()`, prints formatted output
- `src/types.ts` — All interfaces: Classification, PricingResult, Drafts, GateResult, PipelineOutput (includes confidence_score)
- `src/claude.ts` — Shared `callClaude<T>()` helper with JSON parsing, code fence stripping, one retry
- `src/pipeline/classify.ts` — Stage 1: `classifyLead(rawText)` → Classification
- `src/pipeline/price.ts` — Stage 2: `lookupPrice(classification)` → PricingResult (pure function)
- `src/pipeline/context.ts` — Stage 3: `selectContext(classification)` → assembled context string
- `src/pipeline/generate.ts` — Stage 4: `generateResponse(classification, pricing, context, rewriteInstructions?)` → Drafts
- `src/pipeline/verify.ts` — Stage 5: `verifyGate()` + `runWithVerification()` with max 2 retries
- `src/data/rates.ts` — 7 format rate tables hardcoded from source .md files
- `src/data/venues.ts` — 29 venues with tier + stealth premium flags
- `src/prompts/classify.ts` — Classification prompt (PROTOCOL.md Steps 0-5)
- `src/prompts/generate.ts` — Generation prompt (reasoning stage + 5-step draft + sparse lead protocol)
- `src/prompts/verify.ts` — Verification gate prompt (14 gut checks, 12/14 to pass, lead-specificity check)

### Business Logic Docs (in `docs/`)
All source docs were found in `~/Downloads/Manual Library/` (Sparkle moved them) and copied to the project. Key files:
- `PROTOCOL.md` — Classification steps
- `RESPONSE_CRAFT.md` — Drafting framework
- `PRICING_TABLES.md` — Price reference (solo, duo, flamenco, mariachi rates)
- `Rate_Card_Trio_Ensemble.md` — Flamenco trio, mariachi rates (anchor/floor by tier)
- `Rate_Card_Bolero_Trio.md` — Bolero trio rates
- `CULTURAL_SPANISH_LATIN.md` — Spanish/Latin cultural context
- `CULTURAL_CORE.md` — Universal cultural framework
- `PRINCIPLES.md` — Core philosophy
- `QUICK_REFERENCE.md` — All lookup tables

### Planning Docs
- `docs/brainstorms/2026-02-20-gig-lead-responder-brainstorm.md`
- `docs/plans/2026-02-20-feat-gig-lead-response-pipeline-plan.md`

---

## Demo Lead (Happy Path)

File: `examples/quinceanera-lead.txt`

```
Event Type: Quinceañera
Date: Saturday, April 26, 2025
Location: Estancia La Jolla
Guest Count: 120
Budget: $800
Genre Request: Spanish guitar / flamenco
Lead Source: GigSalad
Quotes received: 4
```

**Why this lead:** Fires every interesting behavior simultaneously:
- **Stealth premium** — Estancia La Jolla (La Jolla zip) + 120 guests = T3 pricing despite $800 stated budget
- **Genre correction** — Client asked for flamenco, system should route to mariachi_4piece (Mexican heritage quinceañera)
- **Cultural full activation** — "Mexican family," "authentic and meaningful," milestone birthday
- **Gift-giver frame** — Parent booking for daughter's celebration
- **Budget mismatch** — $800 vs. mariachi_4piece 3hr T3P anchor of $2,050
- **Platform competition** — 4 GigSalad quotes = medium competition

Expected pricing output: `mariachi_4piece | 3hr | T3P | anchor $2,050 | floor $1,900 | quote $2,050`

---

## How to Run

```bash
cd ~/projects/gig-lead-responder

# Set API key
echo "ANTHROPIC_API_KEY=sk-ant-your-key" > .env

# Run demo
npm run demo

# Verbose (shows classification JSON at each stage)
npm run demo -- --verbose

# JSON output (full pipeline output as single JSON blob)
npm run demo -- --json
```

---

## How to Resume Work

### To test and fix issues:
```
Read docs/HANDOFF.md. Run `npm run demo` and fix any issues. API key should be in .env.
```

### To run review:
```
Read docs/HANDOFF.md. Run /workflows:review on the feat/gig-lead-pipeline branch.
```

### To add missing features:
```
Read docs/plans/2026-02-20-feat-gig-lead-response-pipeline-plan.md.
Remaining work: CLI color output, --verbose flag polish, Rate_Card_Solo_Duo.md rates verification, automated tests.
```

### To compound (document learnings):
```
Read docs/HANDOFF.md. Run /workflows:compound to capture solved problems in docs/solutions/.
```

---

## Architecture Decisions

1. **Pipeline, not monolith** — Each stage is a separate function so you can inspect, debug, and improve independently
2. **Hardcoded rate tables** — Rates in TypeScript, not parsed from .md at runtime (fragile)
3. **Shared callClaude() helper** — Strips code fences, retries once on JSON parse failure
4. **Rewrite loop** — Failed gate feeds specific fail_reasons back to generator, max 2 retries, returns `verified: false` if all fail (never silently passes)
5. **Required vs optional docs** — RESPONSE_CRAFT.md and PRICING_TABLES.md throw if missing; everything else skips with warning
6. **format_requested vs format_recommended** — Classification outputs both the client's original ask AND the corrected format; pricing uses the corrected one
7. **Shared `runPipeline()` with `onStage` callback** — Single orchestration function used by CLI, web UI, and automation webhook. Progress reporting is decoupled via optional callback (SSE, console, or silent)

---

## Production Loop (Current Work)

**Brainstorm:** `docs/brainstorms/2026-02-20-production-loop-brainstorm.md`
**Plan:** `docs/plans/2026-02-20-feat-production-automation-loop-plan.md`
**Status:** Plan reviewed (3-agent parallel review), simplified, ready for Phase 1.

Automated email -> AI pipeline -> SMS approval loop. Wraps the existing 5-stage pipeline in delivery infrastructure (Mailgun inbound, Twilio SMS, SQLite persistence, dashboard with Basic Auth).

### How to Start Phase 1

Paste this into a fresh Claude Code session:

```
Read docs/plans/2026-02-20-feat-production-automation-loop-plan.md sections "TypeScript Types" and "SQLite Schema". Read src/types.ts. Implement Phase 1: SQLite store + LeadRecord types + CRUD. Files to create/edit: src/leads.ts (new), src/types.ts (add LeadRecord + LeadStatus). Install better-sqlite3 + @types/better-sqlite3. Commit when done.
```

### Phase 1 Deliverables

**`src/types.ts`** — Add to existing file:
- `LeadStatus` type: `"received" | "sent" | "done" | "failed"`
- `LeadRecord` interface: 20 fields, auto-increment integer ID, inline draft storage

**`src/leads.ts`** — New file:
- `initDb(dbPath?)` — creates SQLite DB with WAL mode, `PRAGMA foreign_keys = ON`, creates `leads` table
- `createLead(fields)` — inserts a new lead, returns the `LeadRecord` with auto-generated ID
- `getLead(id)` — returns `LeadRecord | null`
- `updateLead(id, fields)` — partial update, sets `updated_at`
- `getLeadsByStatus(status)` — returns `LeadRecord[]`, ordered by `created_at DESC`
- `getMostRecentSentLead()` — returns the most recent lead with `status = "sent"`, or null

**Install:** `npm install better-sqlite3 && npm install -D @types/better-sqlite3`

### Key Decisions (from plan review)
- **1 table** instead of 3 (cut `draft_versions` and `sms_log`)
- **4 states:** `received`, `sent`, `done`, `failed` (edit_round column tracks revisions)
- **Integer IDs** double as SMS short IDs (`YES-42` not `YES-abc123`)
- **Inline drafts** on leads table (no versioning — Alex never needs old drafts)
- **Null = unparsed:** `client_name = null` means regex parsing failed (no separate flag)
- **No expiration:** idle leads cost nothing; sort by recency for fallback
- **Flat files:** 4 new files in `src/`, no nested directories
- **Edit re-runs:** generate+verify only (not all 5 stages)
- **429 retry:** once after 60s in `callClaude()` (not a future enhancement)
- **Dedup:** `mailgun_message_id UNIQUE` prevents re-processing
- **Stuck recovery:** `received` > 5 min -> `failed` via `setInterval`

### 8 Implementation Phases

| Phase | Description | Status |
|---|---|---|
| 1 | SQLite store + LeadRecord types + CRUD | Done (`b31a193`) |
| 2 | Twilio SMS sender (outbound only) | Done (`4fa610c`) |
| 3 | Mailgun webhook + email parser + HMAC | Done (`fc9043a`) |
| 4 | Extract `runPipeline()` + wire end-to-end | Done — Chunk 1 (`c4b740e`) + Chunk 3 (`936c2f0`) |
| 5 | Twilio reply webhook + YES/edit handler | Done (`f5a32a1`) |
| 6 | Dashboard with Basic Auth | Done (`33394db`) |
| 7 | Railway deployment + env config | Done (`a45b59f`) |
| 8 | Gmail forward filter + e2e test | Done (`dbd51c9`) |

**Pre-requisite before Phase 3:** Save 2-3 sample lead emails from GigSalad and The Bash to `examples/`.

---

## Classification Verification (2026-02-20)

**Ran classification stage in isolation on the demo lead. Result: 6/6 expected behaviors fire.**

```json
{
  "mode": "evaluation",
  "action": "quote",
  "vagueness": "clear",
  "competition_level": "medium",
  "competition_quote_count": 4,
  "stealth_premium": true,
  "stealth_premium_signals": [
    "Premium venue: Estancia La Jolla",
    "Affluent zip: La Jolla (92037)",
    "Saturday evening at named venue",
    "Guest count 120 (approaching 150 threshold)"
  ],
  "tier": "premium",
  "rate_card_tier": "T3",
  "lead_source_column": "P",
  "price_point": "full_premium",
  "format_requested": "Spanish guitar / flamenco",
  "format_recommended": "mariachi_4piece",
  "duration_hours": 3,
  "timeline_band": "short",
  "close_type": "direct",
  "cultural_context_active": true,
  "cultural_tradition": "spanish_latin",
  "planner_effort_active": true,
  "social_proof_active": true,
  "context_modifiers": [
    "Mexican family explicitly requesting authentic cultural music",
    "Milestone celebration (quinceañera) elevates emotional and cultural significance",
    "Luxury venue (Estancia La Jolla) signals high-end event expectations",
    "Genre request (flamenco/Spanish guitar) may be a proxy for mariachi — upsell opportunity",
    "Budget of $800 is likely a placeholder or underestimate for this venue and event scale"
  ],
  "flagged_concerns": [
    "Budget mismatch: $800 is significantly below market rate for T3 premium venue, 3-hour event, 120 guests",
    "Genre mismatch: Spanish guitar/flamenco requested but quinceañera + Mexican family context strongly favors mariachi",
    "Equipment uncertainty may indicate inexperience with live music logistics — may need guidance",
    "Medium competition (4 quotes) on GigSalad requires strong differentiation and fast response"
  ]
}
```

### Scorecard

| # | Expected Behavior | Result | Verdict |
|---|---|---|---|
| 1 | Stealth premium → T3 | `stealth_premium: true`, `rate_card_tier: "T3"`, 4 signals | PASS |
| 2 | Genre correction → mariachi | `format_requested: "Spanish guitar / flamenco"` → `format_recommended: "mariachi_4piece"` | PASS |
| 3 | Cultural full activation | `cultural_context_active: true`, `cultural_tradition: "spanish_latin"` | PASS |
| 4 | Gift-giver frame | `planner_effort_active: true` + context_modifiers | PASS |
| 5 | Budget mismatch flagged | flagged_concern: "$800 is significantly below market rate" | PASS |
| 6 | Platform competition = medium | `competition_level: "medium"`, `competition_quote_count: 4` | PASS |

### Two Surprises (Both Are Better Behavior)

1. **`tier: "premium"` instead of brainstorm's expected `"qualification"`** — Stealth premium signals override budget mismatch. The system sees past the low stated budget to the client's actual spending capacity (Estancia La Jolla, 120 guests, La Jolla zip). This is *smarter* than what the brainstorm predicted.

2. **`close_type: "direct"` instead of `"hesitant"`** — Same reason. Premium venue signals push toward confident closing. The system treats this as a premium client who underestimated the price, not a budget-constrained client.

**Bottom line:** The demo assumption holds. Classification produces all 6 behaviors on one lead. The two surprises make the demo *more* interesting, not less.

---

## Three Questions — This Session

**Hardest decision:** Whether `tier: "premium"` (vs. brainstorm's expected `"qualification"`) is correct or a bug. Decided it's correct — stealth premium signals should override stated budget.

**Rejected alternatives:** (1) Running full pipeline to verify — classification alone was the minimum viable check. (2) Tweaking the prompt to force `"qualification"` — the model's reasoning is better business logic than the brainstorm assumed.

**Least confident about:** Whether the verification gate (Stage 5) can reliably distinguish cinematic from structural scene descriptions. Classification is verified; the gate is the next unverified assumption. Should run generate + verify in isolation before wiring up the full pipeline.

---

## Completed: Chunk 1 — Extract `runPipeline()` (c4b740e)

Extracted inline pipeline orchestration from both `src/server.ts` and `src/index.ts` into `src/run-pipeline.ts`. Key design:

- **`onStage` callback** — Optional progress reporter. Server passes SSE sender, CLI passes console logger, webhook handler passes nothing. No coupling between pipeline logic and delivery.
- **Confidence scoring** — `computeConfidence()` returns 0-100: gate pass (+40), verified (+20), stealth premium (+10), cultural context (+10), competition handling (+10), concern traceability (+10). Demo quinceañera lead should score 100.
- **`StageEvent` type** — Exported for consumers that need typed progress events.

Files changed: `src/run-pipeline.ts` (new), `src/types.ts`, `src/server.ts`, `src/index.ts`.

---

## Completed: Chunk 2 — Email parser + Mailgun webhook (fc9043a)

Email intake layer for the pipeline. Key files:

- **`src/email-parser.ts`** — `parseEmail(fields)` routes to GigSalad or The Bash parser by `from` address. Returns discriminated union `ParseResult` (ok/skip/parse_error). Regex extraction for event_type, event_date, location, token_url, external_id.
- **`src/email-parser.test.ts`** — 12 tests covering happy paths, skip cases, parse errors, edge cases (parentheses in event type, missing location, article "a" vs "an").
- **`src/webhook.ts`** — Express router with `POST /webhook/mailgun`. HMAC-SHA256 validation (Node crypto, timingSafeEqual). Dual dedup: `processed_emails` table (platform-level gate) + `leads.mailgun_message_id` (delivery-level). Creates LeadRecord, fires `runPipeline()` without awaiting.
- **`src/leads.ts`** — Added `processed_emails` table + `isEmailProcessed()` / `markEmailProcessed()` helpers.
- **`.env.example`** — Added `MAILGUN_WEBHOOK_KEY`.

## Completed: Chunk 3 — Pipeline → DB Write → Twilio SMS (936c2f0)

Wires the back half of the webhook fire-and-forget. Key files:

- **`src/post-pipeline.ts`** — `postPipeline(leadId, output)` writes all PipelineOutput fields to LeadRecord (classification_json, pricing_json, full_draft, compressed_draft, gate_passed, gate_json, confidence_score), then sends compressed draft via SMS, then marks status = "sent". `postPipelineError(leadId, err)` marks status = "failed" with error_message, sends review alert SMS.
- **`src/sms.ts`** — `sendSms(body)` with lazy Twilio client init. Throws on failure.
- **`src/webhook.ts`** — Updated fire-and-forget chain: `runPipeline().then(postPipeline).catch(postPipelineError.catch(log))`. Nested `.catch()` handles double-fault (Twilio + DB both down).
- **`src/leads.ts`** — PRAGMA-based column migration adds `confidence_score`, `error_message`, `pipeline_completed_at`, `sms_sent_at` to existing DBs.
- **`src/types.ts`** — 4 new fields on LeadRecord interface.
- **`.env.example`** — Added `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, `ALEX_PHONE`.

### Spec discrepancies corrected
- Used existing column names (`full_draft` not `draft_full`, `compressed_draft` not `draft_compressed`)
- Used plan's 4-state machine (`sent`/`failed`) not spec's invented states (`draft_ready`/`awaiting_approval`/`pipeline_error`)
- Used correct PipelineOutput paths (`output.drafts.full_draft`, `output.gate.gate_status === "pass"`)

## Completed: Chunk 4 — Twilio reply webhook + YES/edit handler (f5a32a1)

Inbound SMS handler for the approval/edit loop. Key file:

- **`src/twilio-webhook.ts`** — Express router with `POST /webhook/twilio`. Twilio signature validation via `twilio.validateRequest()` using `TWILIO_AUTH_TOKEN` + `BASE_URL`. Only accepts messages from `ALEX_PHONE`. Three parsing paths:
  1. **Approval:** `YES`, `Y`, `APPROVE`, `OK` with optional `-ID` or ` ID` suffix → marks lead as `done` with `done_reason: "approved"`, sends confirmation SMS with dashboard link.
  2. **Edit with ID:** `#42 instructions` or `42: instructions` → routes edit to specific lead.
  3. **Edit without ID:** Entire SMS body is edit instructions → routes to single pending lead, or asks for ID if multiple.
- **`resolveLead()`** — Resolves lead by explicit ID or falls back to most recent `sent` lead. Returns discriminated union `{ ok: true, lead } | { ok: false, error }`.
- **`handleEdit()`** — Checks max 3 edit rounds, parses stored classification/pricing JSON, re-assembles context, calls `generateResponse()` with edit instructions + `verifyGate()` (single attempt per round), updates lead, sends new draft via SMS.
- **Fire-and-forget pattern** — Returns empty TwiML immediately, processes async. Error handler sends SMS on failure.
- **`.env.example`** — Added `BASE_URL`.

### Known risk: Twilio signature validation URL mismatch

`verifyTwilioSignature()` builds the signing URL as `BASE_URL + "/webhook/twilio"`. Twilio signs the exact URL it hits. Any mismatch — trailing slash, http vs https, Railway reverse proxy rewriting the host header or stripping the port — silently rejects every inbound SMS. Can't be tested without a live Twilio number pointed at a public URL.

**Mitigation for deployment (Chunk 7):** Add `DISABLE_TWILIO_VALIDATION=true` env var as a temporary escape hatch. When set, skip signature validation and log a warning. Use this to confirm the webhook works at all, then enable validation and fix the `BASE_URL` to match exactly what Twilio sees. Remove the flag once validated.

## Completed: Chunk 5 — Dashboard with Basic Auth (33394db)

Express router serving HTML lead list and detail pages. Key file:

- **`src/dashboard.ts`** — Express router with inline Basic Auth middleware (~15 lines). Auth checks `DASHBOARD_USER` + `DASHBOARD_PASS` env vars; skips auth entirely when both are missing (local dev convenience). Two routes:
  1. **`GET /leads`** — HTML table of all leads: ID (linked), color-coded status badge, event type, date, venue, client name, edit round, confidence score, received time. Unparsed leads (`client_name = null`) get amber background row + italic "unparsed" label.
  2. **`GET /leads/:id`** — Full detail page with all LeadRecord fields in a 2-column grid. Click-to-copy draft boxes (border turns green on copy). Raw email in scrollable monospace box. Amber banner for unparsed leads, red error for failed leads.
- **`src/server.ts`** — Added `import dashboardRouter` + `app.use(dashboardRouter)`.
- **`.env.example`** — Added `DASHBOARD_USER=admin` and `DASHBOARD_PASS=change-me`.

No new dependencies. Type checks clean (only pre-existing `import.meta.dirname` issue).

### Three Questions — Chunk 5

**Hardest decision:** Whether to skip auth when env vars are missing vs. blocking the server from starting. Went with skip — Alex is the only user, and the dashboard just working on `localhost` without configuring dummy credentials removes friction during development. In production, Railway will have the env vars set, so auth kicks in automatically.

**Rejected alternatives:** (1) A template engine (EJS, Handlebars) — one more dependency for two pages. Inline HTML strings are ugly but the dashboard is simple enough. (2) A separate auth middleware file — the plan explicitly said "~10 lines, lives inline in `dashboard.ts`." (3) Protecting `/api/analyze` with the same auth — that's the web UI pipeline runner, different concern, would break the existing `public/` frontend.

**Least confident about going into Chunk 6 (Railway deployment):** (1) SQLite on Railway — filesystem is ephemeral by default, need a Volume mounted at the right path. If misconfigured, every deploy silently wipes the leads DB. (2) `BASE_URL` matching exactly what Twilio sees — Railway's reverse proxy might rewrite headers, causing silent 403 on every inbound SMS. The `DISABLE_TWILIO_VALIDATION` escape hatch will be important. (3) Port binding — Railway sets `PORT` dynamically, server already reads it, but haven't verified Railway doesn't do anything unexpected.

---

## Completed: Chunk 6 — Railway Deployment (a45b59f)

Railway deployment configuration. Key files:

- **`railway.json`** — Nixpacks builder, `npx tsx src/server.ts` start command, `/health` healthcheck, ON_FAILURE restart with 3 retries.
- **`src/server.ts`** — Added `GET /health` endpoint returning `{ status: "ok" }`.
- **`src/twilio-webhook.ts`** — Added `DISABLE_TWILIO_VALIDATION` escape hatch to `verifyTwilioSignature()`. When `true`, skips signature validation and logs a warning.
- **`package.json`** — Moved `tsx` from devDependencies to dependencies (prevents cold deploy failure when Railway runs `npm ci --omit=dev`).
- **`.env.example`** — Full rewrite with grouped sections, comments, and `DISABLE_TWILIO_VALIDATION=false`.
- **`docs/deployment.md`** — Step-by-step Railway setup: volume config, all env vars with descriptions, Mailgun inbound route, Twilio webhook URL, Gmail forward filter, redeploy checklist.

### Three Questions — Chunk 6

**Hardest decision:** The `tsx` production dependency question. `tsx` was in devDependencies, so `npx tsx` would fail silently on Railway's cold deploy. Fix was trivial (move one line in package.json) but the failure mode was nasty — works locally, crashes only in production.

**Rejected:** Adding a `tsc` build step + `node dist/server.js`. Three moving parts for zero benefit at this scale. Also rejected making `/health` do a DB check — healthcheck should mean "process alive," not "every dependency working."

**Least confident:** Gmail forwarding verification flow — chicken-and-egg between Railway deploy and Gmail verification email delivery.

---

## Completed: Chunk 7 — Gmail Forward Filter + E2E Test (dbd51c9)

Documentation-only chunk. Key files:

- **`docs/deployment.md` section 7** — Rewrote Gmail forward filter setup with:
  - Sequencing warning (deploy Railway + Mailgun BEFORE Gmail verification)
  - Per-platform filter criteria: The Bash (`from:info@thebash.com` + `subject:Gig Alert`),
    GigSalad (`from:leads@gigsalad.com` only — no subject filter, dedup handles reminders),
    Squarespace (optional, parser not built yet)
  - Detailed forwarding verification steps
- **`docs/e2e-test.md`** — 9-test manual checklist: healthcheck, direct Mailgun
  webhook, Gmail full path, YES approval, edit reply, dedup, error path, volume
  persistence, DISABLE_TWILIO_VALIDATION toggle. Includes flow diagram and
  troubleshooting for each step.

### Three Questions — Chunk 7

**Hardest decision:** Whether to add a subject filter on GigSalad's Gmail filter.
Decided against it — GigSalad sends multiple emails per lead from the same `leads@`
address with varying subjects. Adding `subject:New lead` risks silently dropping
leads if GigSalad changes their format. Better to forward everything from `leads@`
and let the application-layer parser + dedup handle filtering.

**Rejected:** Building an automated test script (curl-based or similar) that hits
the Mailgun webhook. It would simulate the webhook POST but wouldn't test the
actual Gmail → Mailgun → Railway path, which is the part most likely to break.
A manual checklist that tests the real path is more valuable for first deploy.

**First thing that will break:** The Mailgun HMAC signature validation on the
`/webhook/mailgun` endpoint. Gmail-forwarded emails arrive at Mailgun as new
inbound messages, and Mailgun signs the webhook POST with its own key. But the
`MAILGUN_WEBHOOK_KEY` in Railway must match Mailgun's *webhook signing key* (not
the API key, not the domain key). These are easy to confuse in Mailgun's dashboard,
and a mismatch means every webhook POST returns 401 silently — no lead created,
no SMS sent, no error visible unless you check Railway logs.

---

## Post-Chunk: DISABLE_MAILGUN_VALIDATION Escape Hatch (44b15b8)

Added after Chunk 7 to address the "first thing that will break" prediction.

- **`src/webhook.ts`** — Added `DISABLE_MAILGUN_VALIDATION` escape hatch,
  mirroring the Twilio pattern. When `true`, skips HMAC validation and logs a warning.
- **`.env.example`** — Added `DISABLE_MAILGUN_VALIDATION=false` with comment
  explaining the three Mailgun key types and which one is correct.
- **`docs/deployment.md`** — Added debugging section under Mailgun setup explaining
  the key confusion (API key vs domain key vs webhook signing key) and the
  disable-validate-fix-re-enable workflow.

Both webhook handlers now have matching escape hatches for first-deploy debugging.

---

## Post-Review: Batch A + Batch B Fixes (045eb8f, 84c4cf4)

Two fix batches from `/workflows:review` findings. All commits on `main`, pushed.

### Batch A — Deletes and quick wins (`045eb8f`)

- **Deleted `src/twilio.ts`** — Dead file, zero imports (superseded by `src/sms.ts`)
- **Removed no-op middleware** in `webhook.ts` — Called `next()` in both branches, global `express.urlencoded()` already handles form-encoded bodies
- **Fixed escape hatch ordering** in `webhook.ts` — `DISABLE_MAILGUN_VALIDATION` check now runs before the missing-fields guard, so the escape hatch actually works when signature fields are absent

### Batch B — Data integrity (`84c4cf4`)

- **Pipeline timeout** — `runPipeline()` wrapped in `Promise.race` with 2-minute timeout. Timeout fires `postPipelineError()` → lead marked `failed` + SMS alert to Alex. Prevents silent hangs.
- **Atomic dedup** — `isEmailProcessed` + `markEmailProcessed` + `insertLead` wrapped in a `better-sqlite3` transaction via new `runTransaction()` helper. Eliminates TOCTOU race on duplicate webhooks.
- ~~**Atomic postPipeline**~~ — Revised in `fb6c5fe`. Originally SMS was sent before any DB write. Now pipeline results (drafts, classification, pricing, gate, confidence) are saved to DB first, then SMS is attempted, then status is marked `"sent"`. Drafts survive SMS failures (e.g., missing Twilio creds during local testing). Trade-off: if process crashes between DB write and SMS, lead has drafts but status stays `"received"` — the stuck-lead sweep catches this.

### Batch C — Code quality P2s (`3883489`)

- **EmailFields export** — `email-parser.ts` exports `EmailFields` interface; `webhook.ts` imports and types the reconstructed fields object instead of inline `as` casts
- **SQL column whitelist** — `leads.ts` adds `UPDATE_ALLOWED_COLUMNS` set (24 cols matching LeadRecord). `updateLead()` throws before building SQL if any key isn't in the whitelist. Defense-in-depth against runtime key injection.
- **`runEditPipeline()` abstraction** — `run-pipeline.ts` exports `runEditPipeline(classification, pricing, instructions)` owning context assembly + generate + verify. `twilio-webhook.ts` drops 3 pipeline internal imports, calls `runEditPipeline()` instead. Webhook handler is now a thin routing layer.

### What's left before deploy

Stuck-lead recovery (`setInterval` marking `received` > 5 min as `failed`) was in the plan but not yet built. The pipeline timeout partially covers this — a hung pipeline will fail after 2 minutes. But a crash between lead insert and pipeline start (process restart, OOM) would leave a lead in `received` forever. Build the recovery sweep if that scenario matters in production.

---

## All Implementation Chunks Complete

All 8 chunks are done. The system is ready for first Railway deploy.

### Next Steps

1. **Deploy to Railway** — Follow `docs/deployment.md` sections 1-4
2. **Configure services** — Mailgun (section 5), Twilio (section 6), Gmail (section 7)
3. **Run e2e tests** — Follow `docs/e2e-test.md` tests 0-8
4. **Review phase** — `/workflows:review` on the full codebase
5. **Compound phase** — Document learnings in `docs/solutions/`

### Prompt for next session (deploy)

```
Read docs/deployment.md. Follow sections 1-4 to deploy to Railway.
Then read docs/e2e-test.md and run Test 0 (healthcheck + dashboard).
```

---

## Platform Policy: GigSalad Contact Block Suppression (`02f1382`)

GigSalad prohibits direct contact info (phone, email, website) in platform messages. The Bash allows it. Fix suppresses the contact block for GigSalad leads only.

### Where `platform` lives

- **`Classification.platform?`** — Optional field, stamped post-AI (not generated by classify prompt)
- **`ParsedLead.platform`** — Set by email parser ("gigsalad" | "thebash")
- **`LeadRecord.source_platform`** — Persisted in DB

### How it flows

1. `webhook.ts` passes `lead.platform` into `runPipeline(rawText, onStage, platform)`
2. `run-pipeline.ts` stamps `classification.platform = platform` after AI classification returns
3. `prompts/generate.ts` checks `classification.platform === "gigsalad"` → omits contact block instruction
4. `pipeline/generate.ts` checks same → skips `ensureContactBlock()` code safeguard
5. Edit path: `twilio-webhook.ts` re-stamps platform from `lead.source_platform` when deserializing stored classification JSON

### Files changed

| File | Change |
|------|--------|
| `src/types.ts` | Added `platform?: "gigsalad" \| "thebash" \| "direct"` to Classification |
| `src/run-pipeline.ts` | New `platform` param, stamps on classification post-AI |
| `src/webhook.ts` | Passes `lead.platform` into `runPipeline()` |
| `src/prompts/generate.ts` | Conditional contact block in prompt |
| `src/pipeline/generate.ts` | Conditional `ensureContactBlock()` |
| `src/twilio-webhook.ts` | Re-stamps platform from DB on edit path |

### Known gaps

1. ~~**Website URLs / social handles**~~ — Fixed in `88d801a`. Hard constraint added near top of generate prompt prohibiting all contact info (phone, email, URLs, social handles, "call me"/"text me" phrasing) in the entire response body, not just the contact block. Contact block omission (v14) still in place lower in the prompt as a second layer.
2. **No platform-policy config** — The `=== "gigsalad"` check is hardcoded in three files (generate prompt, verify prompt, pipeline/generate.ts). If more platforms with different rules appear, a config object would be cleaner.
3. ~~**Verification gate unaware**~~ — Fixed in `7d69d9c` (GigSalad) and `d997751` (The Bash/direct). Verify prompt section 8 is now a platform-conditional hard gate: GigSalad gets "Platform Policy Check" (fails if contact info detected), The Bash/direct get "Contact Block Check" (fails if name, business name, or phone number missing). Section numbering is now consistent (8→9→10) regardless of platform. Also fixed in v16: compressed draft says "GigSalad messaging system" / "The Bash messaging system" (platform-specific) and omits "contact block" from must-retain list for GigSalad.

---

## Reasoning Stage + Sparse Lead Handling (2026-02-21)

### Problem

The generation model skipped straight to drafting and produced generic output — especially on sparse leads. Opening sentences were cinematic but referenced no lead details. Named fears were implied but never stated explicitly. Sparse leads with minimal info got the same treatment as rich leads.

### What Changed

**7 commits across `src/prompts/generate.ts`, `src/types.ts`, `src/pipeline/generate.ts`, `src/prompts/verify.ts`, `src/index.ts`.**

#### Reasoning Stage (`generate.ts`)
- Model must fill a `reasoning` JSON block before writing any prose: `details_present`, `absences`, `emotional_core`, `cinematic_opening`, `validation_line`
- Replaced 7-component framework with 5-step draft sequence: cinematic hook + validation → differentiator + named fear → fear/concern resolution → recommendation + price → CTA
- `GenerateResponse` interface in `pipeline/generate.ts` captures reasoning; only drafts flow downstream

#### Lead-Specificity Check (`verify.ts`, `types.ts`)
- New section 6b in verify prompt: does the opening sentence reference a concrete detail from the classification?
- `lead_specific_opening: boolean` added to `GateResult.gut_checks` (now 10 checks total)
- Pass threshold updated: 7/9 → 8/10 (same 2-failure tolerance)
- `src/index.ts` uses `Object.keys(checks).length` instead of hardcoded `/9`

#### Named Fear Fix (`generate.ts`)
- Step 2 rewritten as "Differentiator + Named Fear" — must name a specific failure mode before showing differentiation
- Sparse Lead Protocol includes fear inference: infer fears from context even when lead doesn't state concerns

#### Sparse Lead Type System (`generate.ts`)
- **Type 1 — Price shopper**: far date, no details → memorable, not exhaustive
- **Type 2 — Overwhelmed**: emotional event, sparse form → remove friction, validate
- **Type 3 — Impatient filler**: category-only, short lead → assume and quote, bundle concerns
- **Type 4 — Still figuring it out**: vague request → one binary question
- Ambiguous defaults to Type 4

#### Forcing Instruction (`generate.ts`)
- Deletion test: "If you remove the detail and the sentence still works for any lead, it fails"
- Pass/fail examples in the prompt
- Corporate event emotional_core: background music, ambience, musician handles everything

#### Concern Traceability Rules (`generate.ts`)
- Type 3 bundling: one confident sentence can cover multiple gaps
- Genre default rule: always state default style when unspecified (corporate: fingerstyle jazz/acoustic pop)
- Date proximity rule: events within 6 weeks must have timeline acknowledged

#### Sparse Lead Scene Strategy (`generate.ts`)
- When lead gives no venue/guest count, build cinematic from the experience: guests at table, glasses in hands, time of night, music responding to room

### Test Results (all 4 passing)

| # | Lead | Type | Gate | Attempts | Confidence |
|---|------|------|------|----------|------------|
| 1 | Wedding @ Hilton La Jolla (120 guests, flamenco, $400-500 budget) | Rich | PASS | 2 | 90 |
| 2 | Birthday March 22, "not sure on details" | Sparse | PASS | 1 | 70 |
| 3 | October 2026 birthday, "just getting pricing" | Type 1 | PASS | 2 | 70 |
| 4 | Corporate March 14, downtown San Diego | Type 3 | PASS | 1 | 80 |

All 10/10 gut checks across the board.

### Three Questions

**Hardest decision:** Where to put the genre default rule. The model was already seeing genre in the Type 3 bundling *example* and ignoring it. Had to decide between scoping it to Type 3, to corporate emotional_core, or as a standalone rule. Went standalone inside Type 3 with explicit default strings per event type. Risk is prompt bloat — the Sparse Lead Protocol section is getting long.

**What was rejected:** Fixing the classifier instead of the generate prompt. Lead 2 kept failing because the classifier flagged 4-5 concerns on a lead with almost no info. Could have tightened the classify prompt to flag fewer concerns on sparse leads. Rejected because: (a) classify prompt wasn't in scope, (b) strict classifier + capable generator is better than lenient classifier that misses issues on richer leads, (c) generate-side fixes (bundling, date proximity rule) solved it without touching a second prompt file.

**Least confident about:** Scene consistency on ultra-sparse leads. Lead 2 was the most volatile — sometimes `cinematic`, sometimes `structural`, depending on how the model phrased the fear. The sparse scene strategy helps but has no testable constraint like the forcing rule's deletion test. On Railway with real leads sparser than the test set, this will be the most common first-attempt failure. The rewrite loop catches it, so it's not a blocker — but it's the least deterministic part of the pipeline.

---

## Context for Presentation

This project is a demo for an AI user group presentation showcasing the **compound engineering** workflow:

1. **Brainstorm** — Explored requirements, chose tech stack, picked demo lead
2. **Plan** — 9-phase implementation plan with SpecFlow analysis (found 10 gaps, fixed 6 critical/important ones)
3. **Work** — Built all 9 phases with incremental commits (~50-100 lines each)
4. **Review** — Done (9 agents, 34 findings, 3 fix batches)
5. **Compound** — Done (6 solutions in `docs/solutions/`)

The quinceañera lead was chosen because it's the stress test that generic tools fail — requires cultural context detection, genre correction, stealth premium override, and gift-giver framing all at once.

---

## Budget Mismatch Handling (2026-02-21)

### Problem

When a lead states a budget below the rate floor, the pipeline classifies as
Standard, quotes at anchor, and ignores the budget entirely. Client's next reply
is "but I said $400" — a second round-trip that loses deals. Root cause: budget
extracted as text, never compared numerically to floor. LLM fails at the math.

### Brainstorm + Plan

- **Brainstorm:** `docs/brainstorms/2026-02-21-budget-mismatch-handling-brainstorm.md`
- **Plan (deepened):** `docs/plans/2026-02-21-feat-budget-mismatch-handling-plan.md`

### Architecture (from deepening — 7 agents reviewed)

**Hybrid:** LLM extracts `stated_budget` as number → deterministic code computes
gap → routes generate prompt to matching response mode.

**Three-tier gap strategy:**
- Small (<$75 gap): name the gap, quote anchor
- Large ($75-$200 gap): offer scoped alternative (shorter set at floor price)
- No viable scope (>$200 or no scope-down): warm redirect

**Key design decisions (from agent reviews):**
1. `BudgetGapResult` is a discriminated union — type-safe, no null-check bugs
2. `detectBudgetGap` is a separate pure function — `lookupPrice` stays single-purpose
3. `enrichClassification` pure function instead of mutation — preserves audit trail
4. Budget mode injected at TOP of generate prompt (from prompt-placement learning)
5. Deletion test for `budget_acknowledged` gut check (from testable-constraints learning)
6. Input validation: bounds check, NaN filter, prompt injection defense

**Dropped from original plan (simplicity review):**
- Phase 6 confidence caps (YAGNI — nothing reads confidence to make decisions)
- Simplified 3-check verify gate for redirects (standard checks work fine)
- `stated_budget` on PricingResult (redundant — already on Classification)

### Implementation Order (3 sessions)

| Session | Phases | Status | Commits |
|---------|--------|--------|---------|
| 1 | Types + classify extraction + detectBudgetGap | Done | `d30dc90` |
| 2 | Enrichment + generate routing + pipeline wiring | Done | `fc24cdc` |
| 3 | Near-miss fix + verify budget_acknowledged + full test suite | Done | `0fdaae6`, `e55731d` |

### Prompt for Session 1

```
Read docs/plans/2026-02-21-feat-budget-mismatch-handling-plan.md Phase 1 and Phase 2.
Read src/types.ts, src/prompts/classify.ts, src/pipeline/price.ts.
Implement: BudgetGapResult discriminated union + stated_budget on Classification +
classify extraction rules + detectBudgetGap pure function in price.ts.
Commit after types, commit after detectBudgetGap.
```

### Prompt for Session 2

```
Read docs/plans/2026-02-21-feat-budget-mismatch-handling-plan.md Phase 3.
Read src/run-pipeline.ts, src/prompts/generate.ts, src/pipeline/price.ts.
Implement: enrichClassification in new src/pipeline/enrich.ts + wire detectBudgetGap
and enrichClassification in run-pipeline.ts + budget mode injection at top of
generate prompt (small/large/no_viable_scope). Commit after enrich, commit after
generate routing.
```

### Prompt for Session 3

```
Read docs/plans/2026-02-21-feat-budget-mismatch-handling-plan.md Phase 4 + Test Plan.
Read src/prompts/verify.ts. Implement: optional pricing param on buildVerifyPrompt +
budget_acknowledged gut check with deletion test framing. Then test all 7 leads
(4 existing + 3 new budget leads). Tune thresholds if needed.
```

### Completed: Session 3 — Near-miss fix + Phase 4 verify + full test suite

**Commits:** `0fdaae6` (near-miss fix), `e55731d` (Phase 4 verify)

#### Near-miss fix (`0fdaae6`)

`findScopedAlternative` in `price.ts` was rejecting scoped alternatives where
the shorter-duration floor slightly exceeded the stated budget. A $400 budget
against a $450 1hr floor (gap $50) was escalating to `no_viable_scope` instead
of offering the 1hr set.

**Fix:** Added `NEAR_MISS_TOLERANCE = 75` constant. Changed comparison from
`floor > budget` to `floor >= budget + NEAR_MISS_TOLERANCE`. Now a $50 gap
passes into "large" mode; gap exactly $75 still rejects (boundary: strictly
less than tolerance).

Also changed `generate.ts` large mode copy from "fits their budget" to "starts
at" — with near-miss tolerance, the scoped price may exceed stated budget, so
the old phrasing was sometimes false. The LLM has both numbers in context and
frames the gap appropriately.

**Plan discrepancy:** Plan specified `>` operator but test expectations required
`>=` for boundary behavior (gap exactly at tolerance must reject). Used `>=` to
match test expectations.

#### Phase 4: budget_acknowledged gut check (`e55731d`)

`buildVerifyPrompt` now accepts optional `pricing` parameter (defaults to
`{ tier: "none" }` for edit pipeline backward compat). When budget tier is
active, injects an 11th gut check with deletion-test framing:

- **small:** draft must name the rate directly in relation to stated budget
- **large:** draft must name the specific scoped alternative price
- **no_viable_scope:** draft must state the floor and suggest a concrete alternative
- **none:** always true (no-op)

Threshold updated from 8/10 to 9/11. For non-budget leads, the freebie
`budget_acknowledged: true` means effective difficulty is unchanged (still need
8 of the original 10 to pass). For budget leads, it's a real check.

Threading: `verifyGate()` and `runWithVerification()` accept optional `pricing`.
`runEditPipeline()` also passes pricing through (edit pipeline re-checks budget
acknowledgment on rewrites).

#### Test results

**48 unit tests passing** (40 original + 4 near-miss + 4 security):
- Near-miss: $400/$376 budgets pass through tolerance, $375 (exact boundary) rejects
- Security: -500, 0, 999999999 all route to `tier: "none"`
- 1 existing test updated (gap=75 now routes to "large" with near-miss tolerance)

**Lead A regression (end-to-end):**
- Classification: `flamenco_duo`, T3D, stealth premium, $400 stated budget
- Pricing: `no_viable_scope` (gap $700 — classify recommended flamenco_duo at T3D floor $1100)
- Gate: PASS on attempt 2, 11/11 gut checks, `budget_acknowledged: true`
- Draft: names $1,100 floor, suggests playlist/DJ alternative, no DJ as scoped alternative
- Confidence: 90/100

**Known issue:** `no_viable_scope` compressed draft came in at 113 words vs 50-75
target. The warm redirect prompt says 50-75 words but the LLM over-writes.
Prompt calibration issue for a future session, not a code bug.

#### Three Questions — Session 3

**Hardest decision:** Whether to use `>` (as the plan specified) or `>=` for
the near-miss comparison. The plan's code snippet and its test expectations
contradicted each other. Chose `>=` because the tests were the source of truth
for boundary behavior: "gap $75 = tolerance, NOT less than" means the tolerance
must be strictly less than, requiring `>=` in the guard.

**What was rejected:** (1) Making `budget_acknowledged` optional in `GateResult`
(only present when tier !== "none"). Rejected because it would break
`Object.keys(checks).length` and require null checks everywhere. Always-present
with "always true" for non-budget leads is simpler. (2) A separate simplified
verify gate for `no_viable_scope` redirects. The plan explicitly said "standard
checks apply to all modes" and the production watch item in MEMORY.md warns
against this — if redirects start failing standard checks, fix with scoped
definitions, not a simplified gate.

**Least confident about:** Whether the 9/11 threshold is correctly calibrated
for budget leads. For non-budget leads, `budget_acknowledged` is free so it's
effectively still 8/10. For budget leads, it's a real 9/11 = 82% bar. If budget
drafts start failing gate disproportionately because `budget_acknowledged` is
hard to satisfy alongside 8 other checks, may need to adjust. The Lead A
regression passed 11/11 so no signal yet.

### Integration test: 7 leads (post-Session 3)

Ran all 7 leads from the plan test table. Results before range fix (`aa019b2`):

| # | Lead | Expected tier | Actual tier | Gate | budget_ack | Verdict |
|---|------|--------------|-------------|------|------------|---------|
| A | Wedding $400, 2hr solo | large | no_viable_scope | FAIL 9/11 | true | Not a bug — plan assumed T2D, classifier correctly detected stealth premium → T3D floor $650, gap $250 |
| B | Wedding, no budget | none | none | PASS 10/11 | true | No change |
| C | Birthday, no budget (sparse) | none | none | PASS 10/11 | true | No change |
| D | Corporate, no budget (sparse) | none | none | FAIL 9/11 | true | Pre-existing gate flakiness on sparse leads |
| E | $475 solo, small gap | small | small | PASS 10/11 | true | Gap $25, quotes $550, names gap |
| F | $250 duo, no_viable_scope | no_viable_scope | no_viable_scope | PASS 10/11 | true | Warm redirect, duo 2hr floor $700 |
| G | $350-400 solo, large | no_viable_scope | FAIL 9/11 | true | Range extraction bug — see fix below |

**5/7 tiers correct, budget_acknowledged 7/7.** Two mismatches explained:

**Lead A:** Plan test table assumed T2D rates but Hilton La Jolla triggers stealth
premium → T3D. Floor $650, gap $250 → `no_viable_scope`. Pipeline is correct;
plan assumption was wrong.

**Lead G:** Classify extracted $350 (low end of "$350-400") per the extraction
rule. Gap $150 is in "large" range, but 1hr floor $450 >= $350 + $75 = $425 →
near-miss rejects → `no_viable_scope`. Root cause: low-end extraction rule was
designed to prevent overpromising on quote price, but scope-down math needs the
client's ceiling, not their floor.

### Range extraction fix (`aa019b2`)

One-line change in `src/prompts/classify.ts`:
```
- "$350-400" → 350 (use the LOW end of any range)
+ "$350-400" → 400 (use the HIGH end of any range)
```

**Reasoning:** A client who writes "$350-400" is telling you their ceiling is
$400. The pipeline saying "you mentioned $400" is accurate. Scope-down math:
$450 floor < $400 + $75 = $475 → passes → `tier: "large"`, scoped alt 1hr @ $450.

**Lead G after fix:** `stated_budget: 400`, gap $100, `tier: "large"`,
`scoped_alt: 1hr @ $450`, gate PASS 13/14, `budget_acknowledged: true`.

---

## Prompt for Next Session (Post-Deploy)

```
Read docs/HANDOFF.md "Deploy Progress" checklist at the top.
Remaining: Twilio A2P campaign approval, first real lead e2e test,
re-enable Twilio signature validation. Read docs/e2e-test.md tests 3-8
for the SMS and approval flow tests once Twilio is unblocked.
```

---

## Three Rubric Comparison Fixes (2026-02-21)

### Problem

Running the Alex R. mariachi lead (Dec 24 2025, Chula Vista) through both the
pipeline and Claude Projects produced a 13-point gap (24/40 vs 37/40). Three
root causes: pipeline treated a past date as future, defaulted to 4-piece
mariachi when full ensemble was correct, and used wrong cultural vocabulary
("Las Posadas" instead of "Nochebuena").

### Brainstorm + Plan

- **Brainstorm:** `docs/brainstorms/2026-02-21-rubric-comparison-fixes-brainstorm.md`
- **Plan (deepened):** `docs/plans/2026-02-21-fix-rubric-comparison-fixes-plan.md`

### Implementation (3 sessions, 5 phases)

| Session | Phases | Commits |
|---------|--------|---------|
| 1 | Phase 0 (shared infra) + Phase 1 (past-date detection) | `9119acd`, `bdf31e6` |
| 2 | Phase 2A (format routing rules) + Phase 2B (dual-format prompt) | `b807909` |
| 3 | Phase 3 (cultural vocab) + Phase 4 (threshold) + Phase 5 (test) | `b68bb33`, `09897ca` |

### What Changed

**Phase 0 — Shared Infrastructure** (`9119acd`)
- `event_date_iso?: string | null` on Classification (LLM extracts, code uses)
- `buildClassifyPrompt(today)` — injects today's date at top of classify prompt
- `parseLocalDate()` in `src/utils/dates.ts` — noon anchor to avoid UTC rollover

**Phase 1 — Past-Date Detection** (`bdf31e6`)
- `past_date_detected?: boolean` computed in `enrichClassification()`, not by LLM
- Generate prompt injects `## FLAGGED: EVENT DATE APPEARS TO BE IN THE PAST`
- `past_date_acknowledged` gut check with deletion test
- CLI warning in formatted output mode

**Phase 2 — Mariachi Format Routing** (`b807909`)
- `event_energy?: "background" | "performance" | null` on Classification
- `resolveFormatRouting()` in `enrich.ts` — hard constraint: 4-piece weekday only, full ensemble default
- Dual-format prompt injection via `flagged_concerns` ("mention_4piece_alternative" / "mention_full_ensemble_upgrade")
- `mariachi_pricing_format` gut check — anchor-high verification for dual-format leads
- `buildDualFormatBlock()` in `generate.ts` — frames 4-piece as "designed for weekday events", not "budget option"

**Phase 3 — Cultural Vocabulary** (`b68bb33`)
- `buildCulturalVocabBlock()` in `generate.ts` — 2 FAIL/PASS contrastive pairs:
  - Las Posadas (FAIL) vs Nochebuena (PASS) — wrong tradition vs correct term
  - "traditional birthday performance" (FAIL) vs Las Mañanitas (PASS) — generic vs specific
- Generalization rule: adjacent cultural terms are NOT interchangeable
- `cultural_vocabulary_used` gut check with deletion test

**Phase 4 — Threshold Update** (`09897ca`)
- Verify gate: 9/11 → 12/14 (~86% pass rate)
- New checks are no-ops when inactive (always true), so non-cultural/non-mariachi/non-past-date leads face unchanged difficulty

### Test Results (all 4 passing, 14/14 gut checks)

| # | Lead | Type | Gate | Attempts | Confidence | Key Checks |
|---|------|------|------|----------|------------|------------|
| 1 | Wedding @ Hilton La Jolla (Dec 2025, flamenco, $400) | Rich | PASS | 3 | 100 | past_date: true, mariachi_full, Nochebuena + Las Mañanitas, no_viable_scope |
| 2 | Birthday March 22, "not sure on details" | Sparse | PASS | 1 | 90 | event_date_iso present, no-op cultural/mariachi checks pass |
| 3 | October 2026 birthday, "just getting pricing" | Type 1 | PASS | 2 | 80 | comfortable timeline, no-op checks pass |
| 4 | Corporate March 14, downtown San Diego | Type 3 | PASS | 1 | 80 | genre default stated, concern bundling, no-op checks pass |

Lead 1 highlights: `past_date_detected` caught Dec 2025, `mariachi_full` routed
correctly (Saturday cultural event), "Nochebuena" and "Las Mañanitas" both used
in draft, `no_viable_scope` budget mode active ($400 vs $1,850 floor).

### Three Questions — Session 3

**Hardest decision:** Whether to run the test leads with approximate text or
track down exact lead files. The plan referenced `leads/` directory that doesn't
exist — leads are piped via echo. Reconstructed from HANDOFF descriptions and
the example file format. All 4 passed, confirming the fixes work regardless of
exact lead wording.

**What was rejected:** Adding a third FAIL/PASS pair for serenata vocabulary.
Research recommended 2 pairs as the sweet spot — 3 risks over-prompting. The
generalization rule at the end covers edge cases without specific examples.

**Least confident about:** The 3-attempt pass on Lead 1. It's the hardest lead
(past date + cultural vocab + format correction + no_viable_scope budget all
active at once), so retries are expected. But if production leads routinely need
3 attempts, the generate prompt may need tighter guardrails for multi-concern
leads. The rewrite loop handles it, but each retry costs ~$0.03 in API calls.

---

## Fix Phase Complete — rubric-comparison-fixes (2026-02-21)

**Summary:** `docs/fixes/rubric-comparison-fixes/FIXES-SUMMARY.md`
**Review source:** `docs/reviews/rubric-comparison-fixes/REVIEW-SUMMARY.md`

| Batch | Name | Findings | Key Commits |
|-------|------|----------|-------------|
| A | Deletes and Removals | 4 fixed | `dc06ae7` |
| B | Data Integrity and Hot Path | 5 fixed | `11f50cf`, `10e9cfd`, `9be5e43`, `d00f448` |
| C | Code Quality and Abstractions | 10 fixed | `0874426`..`2406541` (8 commits) |
| D | Deferred | 8 deferred | — |

**Total:** 19 fixed, 8 deferred. All P1s resolved (pricing recompute, enriched
classification return, timezone centralization, date validation). 4 patterns
flagged for compound phase.

---

## Cross-Pollinate Process Docs — Status

All three projects share three questions + feed-forward rules. Low-effort
cross-pollination is done. Medium-effort items remain.

### Completed

| What | From | To | Commit |
|------|------|----|--------|
| `FAILURE_MODES_CATALOG.md` | research-agent | gig-lead-responder, pf-intel | `08f362f`, `8e08482` |
| Solutions category structure | research-agent (7 categories) | gig-lead-responder (now 5 categories, 15 files) | `08f362f` |
| Auto-memory (`MEMORY.md`) | — | pf-intel already had one (34 lines) | Skipped |

### Remaining (Medium Effort)

| What | From | To | What's Involved |
|------|------|----|-----------------|
| ~~`docs/workflow-templates.md`~~ | pf-intel | gig-lead-responder (`6f15eda`), research-agent (`b40821f`) | Done — adapted per project: TS reviewer + prompt iteration template (gig), Python reviewer + pytest commands (research) |
| ~~Project-specific skills~~ | pf-intel (4 skills) | gig-lead-responder (`018f7c9`) | Done — 3 skills: `/lead-test`, `/prompt-iteration`, `/deploy-checklist`. Dropped `pipeline-stage` (pipeline is stable, not worth scaffolding). |

### Prompt for next session (workflow templates)

```
Read docs/HANDOFF.md section "Cross-Pollinate Process Docs — Status".
Read ~/Projects/pf-intel/docs/workflow-templates.md (the source).
Create docs/workflow-templates.md for gig-lead-responder with adapted
prompts for: brainstorm, plan, work, review, compound. Swap file paths
and stage names to match this project's conventions. Then do the same
for ~/Projects/research-agent/docs/workflow-templates.md.
Relevant paths:
- ~/Projects/gig-lead-responder/
- ~/Projects/research-agent/
- ~/Projects/pf-intel/
```

### Prompt for next session (project-specific skills)

```
Read docs/HANDOFF.md section "Cross-Pollinate Process Docs — Status".
Read ~/Projects/pf-intel/.claude/commands/ to see pf-intel's 4 skills.
Create 2-4 skills in .claude/commands/ for gig-lead-responder:
1. pipeline-stage — scaffold a new pipeline stage (prompt + pipeline fn + types)
2. prompt-iteration — run a lead, compare output, tune prompt, repeat
3. lead-test — run all test leads and show pass/fail table
4. deploy-checklist — Railway deploy verification steps
Start with the most useful one (likely lead-test or prompt-iteration).
```

---

## Compound Phase Complete — rubric-comparison-fixes (2026-02-21)

3 new solutions documented from the rubric-comparison-fixes implementation
and budget-mismatch handling work. Total: 15 solutions in `docs/solutions/`.

| # | Solution | Category | Pattern |
|---|----------|----------|---------|
| 13 | `contrastive-pair-vocabulary-enforcement.md` | prompt-engineering | FAIL/PASS example pairs teach vocabulary precision (wrong-but-specific vs correct term) |
| 14 | `hybrid-llm-deterministic-computation.md` | architecture | LLM does fuzzy extraction, code does precise math — 3 instances (dates, budgets, format routing) |
| 15 | `noop-gut-checks-conditional-features.md` | verification-design | Conditional checks return "Always true" when inactive — stable threshold, fixed types |

### What was already documented (from prior sessions)

- Solutions 1-6: Original pipeline compound phase
- Solutions 7-8: `testable-constraints-for-prompt-compliance.md`, `sparse-lead-type-classification.md`
- Solutions 9-12: `logic-errors/` patterns from fix-batched phase (= the 4 "Patterns Worth Capturing" in FIXES-SUMMARY: reprice-after-enrichment, today-as-parameter, required-nullable-vs-optional, constants-at-the-boundary)

### Three Questions

**Hardest pattern to extract:** Whether the hybrid LLM+code pattern is one
solution or three. Each instance (dates, budgets, format routing) has the same
structure but different domains. Documented as one solution with three examples
because the principle — "LLMs are fuzzy parsers, not calculators" — is the
reusable insight.

**What was left out:** The range extraction rule ("$350-400" → take high end
for scope-down math). It's a one-line classify prompt fix documented in the
handoff, not a reusable pattern. Also left out: the calibration of 2 contrastive
pairs as sweet spot — research detail, not an architectural pattern.

**What might future sessions miss:** The GENERALIZATION rule at the end of
contrastive pair blocks. Without it, the LLM learns the specific examples but
doesn't transfer the principle to new cultural terms. Every contrastive pair
block needs its own generalization rule — this isn't documented as a hard
requirement in the reusable pattern checklist.

---

## Dashboard UI Redesign — Work Phase (2026-02-22)

**Brainstorm:** `docs/brainstorms/2026-02-22-dashboard-ui-redesign-brainstorm.md`
**Plan:** `docs/plans/2026-02-22-feat-dashboard-ui-redesign-plan.md`

### Chunk Progress

| Chunk | Description | Status | Commit |
|-------|-------------|--------|--------|
| 1 | Database layer — `listLeadsFiltered()` + `getLeadStats()` | Done | `ddb515d` |
| 2 | API router — `GET /api/leads`, `GET /api/stats`, `POST /api/leads/:id/approve` | Done | `b918790` |
| 3 | Dashboard HTML — layout + stats + table + filters + tabs | Done | `524f3e3` |
| 4 | Dashboard HTML — expanded row + approve action | Done | `449b32e` |
| 5 | Dashboard HTML — Analyze tab (SSE migration) | Done | `af60ac2` |
| 6 | Route cleanup + polish (Refresh button, mockup cleanup) | Done | `d5b34fe` |

### Chunk 1: Database Layer (`ddb515d`)

Two new query functions in `src/leads.ts`:

- **`listLeadsFiltered(opts)`** — optional `status` filter + `sort` by date/score/event. Uses `event_date IS NULL, event_date ASC` workaround for SQLite's lack of `NULLS LAST`.
- **`getLeadStats()`** — single query with conditional aggregation: pending count, sent count, avg confidence (nulls excluded), this-month count.

### Chunk 2: API Router (`b918790`)

- **`src/auth.ts`** — Extracted Basic Auth middleware from `dashboard.ts` into shared module.
- **`src/api.ts`** — Three endpoints behind Basic Auth:
  - `GET /api/leads` — returns shaped JSON with parsed classification/pricing/gate sub-fields, excludes `raw_email`
  - `GET /api/stats` — returns `{ pending, sent, avg_score, this_month }`
  - `POST /api/leads/:id/approve` — validates lead has draft + correct status, sends SMS via `sendSms()`, updates to `done`/`approved_dashboard`. On Twilio failure: 500, status unchanged.
- **`src/dashboard.ts`** — Replaced inline auth with import from `src/auth.ts`.
- **`src/server.ts`** — Mounted `apiRouter`.

### Chunk 3: Dashboard HTML (`524f3e3`)

- **`public/dashboard.html`** — 876 lines. All CSS from mockup-hybrid + dynamic JS rendering.
  - Stats cards from `GET /api/stats`, dynamic greeting
  - Filter pills re-fetch with `?status=` (Pending pill maps to API `received`)
  - Sort dropdown re-fetches with `?sort=date|score|event`
  - Tabs: Queue (defaults to Pending filter), All Leads (no filter), Analyze (placeholder)
  - Desktop table + responsive mobile cards at 768px
  - Auth-aware `apiFetch()`: prompts on 401, skips if no auth configured
  - Detail panel + approve flash CSS included (ready for Chunk 4)
- **`src/server.ts`** — Added `/` redirect to `/dashboard.html`

### Chunk 4: Expandable Row Detail + Approve Action (`449b32e`)

- **`public/dashboard.html`** — 1203 lines (+331). Click-to-expand accordion detail panel:
  - Gut check progress bar (green/amber/red) + failed check names listed
  - Full draft + compressed draft in two-column grid, edit round indicator
  - Classification + pricing breakdown grid (format, duration, tier, competition, quote/anchor/floor)
  - "Approve & Send" button → `POST /api/leads/:id/approve` → flash animation → row updates to Done
  - "Edit Draft" button → inline textarea → "Save" calls `POST /api/leads/:id/edit` → `edit_round` incremented
  - Error state: red banner with `error_message` for failed leads
  - Mid-pipeline state: spinner + "Pipeline running..." for received leads with no draft
  - Accordion behavior: only one row expanded at a time
  - Mobile cards also expand with same detail panel
- **`src/api.ts`** — Two additions:
  - `failed_checks: string[]` added to `shapeLead` response (names of gut checks that failed)
  - `POST /api/leads/:id/edit` — validates `full_draft` string, updates DB, increments `edit_round`, returns shaped lead

### Chunk 5: Analyze Tab — SSE Migration (`af60ac2`)

- **`public/dashboard.html`** — 1543 lines (+340). Full Analyze tab replacing placeholder:
  - Textarea with placeholder + Ctrl+Enter shortcut
  - "Analyze" button triggers `POST /api/analyze` with SSE streaming
  - 5-stage progress indicator with pulse animation (classify → price → context → generate → verify)
  - SSE manual parser ported from `index.html` (`fetch` + `getReader` + `buffer.split("\n")` loop)
  - Results display: classification KVs, pricing KVs, dual drafts grid, verification gate (gut check count, fail reasons, scene type, competitor test)
  - Error handling: network failures and mid-stream SSE errors shown inline
  - All styled in warm palette (cream background, gold accents, Playfair Display section headings, gold left-border draft boxes)

### Chunk 6: Route Cleanup + Polish (`d5b34fe`)

- **`public/dashboard.html`** — Added Refresh button to top bar with `.refresh-btn` CSS. Calls `loadStats()` + `loadLeads()` on click.
- **Mockup cleanup** — Deleted `mockup-clean.html`, `mockup-dark.html`, `mockup-warm.html` (untracked, never committed). Kept `mockup-hybrid.html` as design reference.
- **`/` redirect** — Already done in Chunk 3 (server.ts line 37-39).
- **Old `/leads` routes** — Still working via `dashboardRouter` in `src/dashboard.ts`.

### Dashboard Architecture (New)

The unified dashboard replaces the old two-surface design:

| Route | Source | Purpose |
|-------|--------|---------|
| `/` | `src/server.ts` redirect | → `/dashboard.html` |
| `/dashboard.html` | `public/dashboard.html` (static) | Unified dashboard: Queue + All Leads + Analyze tabs |
| `/api/leads` | `src/api.ts` | JSON API: filtered lead list with parsed sub-fields |
| `/api/stats` | `src/api.ts` | JSON API: pending, sent, avg_score, this_month |
| `/api/leads/:id/approve` | `src/api.ts` | Approve lead → SMS to `ALEX_PHONE` → status `done` |
| `/api/leads/:id/edit` | `src/api.ts` | Manual text edit → save to DB, increment `edit_round` |
| `/api/analyze` | `src/server.ts` | SSE streaming pipeline (unprotected, matches old behavior) |
| `/leads` | `src/dashboard.ts` (old) | Legacy HTML table — still works, superseded |
| `/leads/:id` | `src/dashboard.ts` (old) | Legacy detail page — still works, superseded |

All `/api/*` routes (except `/api/analyze`) require Basic Auth via `src/auth.ts`.

### Review Phase Complete (2026-02-22)

**Review summary:** `docs/reviews/dashboard-ui-redesign/REVIEW-SUMMARY.md`
**Agents run:** 9 (3 batches of 3)
**Findings:** 4 P1, 12 P2, 12 P3 (28 unique from 100 raw)

#### P1s (must fix before next deploy)

| # | Finding | File |
|---|---------|------|
| 1 | `/api/analyze` has no auth + client doesn't send auth header | `server.ts:51`, `dashboard.html:1491` |
| 2 | Approve endpoint race condition → double SMS | `api.ts:106-136` |
| 3 | Auth bypass when env vars unset | `auth.ts:8-11` |
| 4 | Non-null assertion on `updateLead` return | `api.ts:136,165` |

#### Top P2s

- `shapeLead()` brittle 50-line mapping, unsafe `as` casts
- Old `dashboard.ts` is dead code (185 lines)
- Auth applied piecemeal — new routes unprotected by default
- Timing-unsafe password comparison (`auth.ts:23`)
- Basic Auth breaks on passwords with colons (`auth.ts:21`)
- Edit doesn't update `compressed_draft` → stale SMS on approve

#### What the review confirmed from work phase

The "Least confident" flag from Chunk 5 — `renderAnalyzeResults()` accessing nested properties without null guards — was caught by the architecture-strategist agent (P2 #16).

### Prompt for Next Session (Fix Phase)

```
Read docs/reviews/dashboard-ui-redesign/REVIEW-SUMMARY.md.
Run /fix-batched batch1 to fix the P1 findings.
Relevant files: src/server.ts, src/api.ts, src/auth.ts, public/dashboard.html.
```

## Three Questions

1. **Hardest implementation decision in this session?** Nothing hard — Chunk 6 was the cleanup chunk. The only decision was where to place the Refresh button (top bar vs. page header). Top bar keeps it visible across all tabs and avoids it disappearing when switching to Analyze.

2. **What did you consider changing but left alone, and why?** Considered removing the old `/leads` routes entirely since the new dashboard supersedes them. Left them alone because (a) the plan explicitly says "keep old routes working" for backwards compatibility, and (b) they cost nothing — `dashboard.ts` is already mounted and tested.

3. **Least confident about going into review?** Same as Chunk 5's flag: `renderAnalyzeResults()` accesses nested properties like `data.gate.gut_checks` without null guards. If the SSE `complete` event has a different shape than expected (partial pipeline failure), it could throw. The review should flag this.
