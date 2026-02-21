# Gig Lead Responder — Session Handoff

**Last updated:** 2026-02-20 (v10)
**Current phase:** Work — Production Loop (all implementation chunks complete)
**Next session:** Deploy to Railway + run e2e tests (see `docs/deployment.md` + `docs/e2e-test.md`)

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
3. **Compound phase** — No `docs/solutions/` captured yet
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
- `src/prompts/generate.ts` — Generation prompt (RESPONSE_CRAFT.md 7-component framework)
- `src/prompts/verify.ts` — Verification gate prompt (evidence-based pass/fail)

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

## Context for Presentation

This project is a demo for an AI user group presentation showcasing the **compound engineering** workflow:

1. **Brainstorm** — Explored requirements, chose tech stack, picked demo lead
2. **Plan** — 9-phase implementation plan with SpecFlow analysis (found 10 gaps, fixed 6 critical/important ones)
3. **Work** — Built all 9 phases with incremental commits (~50-100 lines each)
4. **Review** — Not yet done
5. **Compound** — Not yet done

The quinceañera lead was chosen because it's the stress test that generic tools fail — requires cultural context detection, genre correction, stealth premium override, and gift-giver framing all at once.
