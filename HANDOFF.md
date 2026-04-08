# HANDOFF -- Gig Lead Responder

**Date:** 2026-04-07
**Branch:** `main`
**Phase:** Post-audit cleanup. Full codebase audit complete. 16/32 findings fixed. Remaining items ready for implementation.

## Current State

Full 9-agent codebase audit completed and 16 critical fixes applied in this session. Production is now running with all Cycle 12 review fixes that were previously stranded on unmerged branches. Gmail leads now persist to SQLite. File-based dedup replaced with SQLite.

### What Was Done (April 7 Session)

1. **Deploy crash investigation** — body-parser limit 100kb → 1mb, Gmail poller stops on auth failure instead of spamming
2. **Full codebase audit** — 9 agents across 3 batches, 32 findings (6 P1, 17 P2, 9 P3)
3. **16 unmerged Cycle 12 + batch-d fixes applied:**
   - COOKIE_SECRET startup validation + throw instead of process.exit
   - Pre-migration duplicate mailgun_message_id check
   - Shared stmt-cache.ts (replaces triplicated cache)
   - Pagination for listLeadsFiltered (LIMIT 50, max 200)
   - Startup recovery for stuck "received" leads
   - Dashboard HTML + root redirect behind sessionAuth
   - try-catch on JSON.parse in twilio-webhook
   - Rate limiting (30/15min) on Mailgun + Twilio webhooks
   - Raw HTML flag removed from analyzeKvHTML (XSS fix)
   - SSE heartbeat every 15s for /api/analyze
   - Phone number redacted to last 4 digits
   - Credential file permissions (0o600)
   - SMS/API error response sanitization (4 locations)
   - CSRF guard skips Basic Auth (not browser-auto-attached)
4. **Gmail leads persisted to SQLite** — insertLead at parse, updateLead with pipeline results, status updates on hold/send/fail
5. **File-based dedup → SQLite** — dedup.ts now wraps isEmailProcessed/markEmailProcessed from db/leads.ts
6. **Sourced format T1 tier fallback** — price.ts falls back to T2P when T1 missing
7. **Dead code deleted** — venues.ts (83 lines), SCOPES constant, commented-out guardrail
8. **FORMAT_FAMILIES updated** — added sourced cultural formats + flamenco_trio_full

### Commits (April 7)

| Commit | Description |
|--------|-------------|
| `6b13556` | fix: body-parser limit + gmail poller auth failure handling |
| `18ed17a` | fix: apply 16 unmerged Cycle 12 + batch-d security/reliability fixes |
| `e76434a` | docs: full codebase audit — 9 agents, 32 findings |
| `af803f3` | fix: persist Gmail leads to SQLite, migrate dedup to DB, cleanup dead code |

### Tests: 84 pass, 0 fail

## Open Issues (Remaining from Audit)

### P2 — Platform Type Unification
**Files:** `src/types.ts`, `src/automation/types.ts`, `src/automation/source-validator.ts`
**Issue:** Three separate platform type definitions:
- `Classification.platform`: `"gigsalad" | "thebash" | "direct"`
- Automation `Platform`: `"gigsalad" | "thebash" | "yelp" | "squarespace"`
- DB column: `source_platform` (string, no constraint)

**Why it matters:** Gmail-polled GigSalad leads don't get `platform` set on their Classification, which means contact suppression policies could be bypassed. The automation type includes platforms (yelp, squarespace) that the main pipeline doesn't know about.

**Fix approach:** Create a single `Platform` union type in `src/types.ts` that covers all sources. Update Classification to use it. Update automation types to import from the shared definition.

**Key files:** `src/types.ts:79`, `src/automation/types.ts`, `src/automation/source-validator.ts:6-10`

### P2 — Dual Parser Systems
**Files:** `src/email-parser.ts` vs `src/automation/parsers/`
**Issue:** Two completely separate codepaths parse GigSalad emails — the webhook path (`email-parser.ts`) and the automation path (`automation/parsers/gigsalad.ts`). Different types, different regex, `ParsedLead` name collision between `src/types.ts` and `src/automation/types.ts`.

**Why it matters:** A fix to email parsing in one path won't reach the other. As email formats change, both must be updated independently.

**Fix approach:** Either unify into one parser or rename the automation `ParsedLead` to avoid collision and document that they're separate paths with different responsibilities.

### P2 — Dual SMS Sender Modules
**Files:** `src/sms.ts` (27 lines) vs `src/automation/senders/twilio-sms.ts` (46 lines)
**Issue:** Both send SMS to Alex via Twilio with different interfaces. Server version reads env vars directly; automation version takes config object and creates new client per call.

**Fix approach:** Consolidate into `src/sms.ts` with an optional config parameter. Have automation import the shared module.

### P2 — Delete Standalone `main.ts`
**File:** `src/automation/main.ts` (176 lines)
**Issue:** Standalone CLI entry point that duplicates `poller.ts` polling logic. Created before server-embedded mode existed. Lacks Railway credential bootstrapping. Will drift from poller.ts over time.

**Fix approach:** Delete `main.ts`, update `package.json` to remove `"auto"` script. If standalone mode ever needed, `poller.ts` can be imported directly.

### P2 — Data Lifecycle Management
**Files:** `src/db/migrate.ts`, `src/automation/dedup.ts`
**Issue:** No cleanup mechanism for any persistent data:
- `leads` table grows forever (JSON columns = several KB per row)
- `processed_emails` table grows forever
- `venue_misses` table grows forever
- `logs/leads.jsonl` append-only, no rotation
- Browser data directories accumulate session cookies

**Fix approach:** Add a scheduled cleanup (e.g., monthly) that archives leads older than N months. Add TTL for processed_emails (30 days is sufficient for dedup). Add log rotation for JSONL.

### P2 — `claimLeadForSending` Double-Claim Risk
**File:** `src/db/leads.ts:171-176`
**Issue:** WHERE clause `status IN ('received', 'sent')` allows concurrent approvals to both succeed, causing double SMS sends.

**Fix approach:** Split into `claimForFirstSend` (WHERE received) and `claimForApproval` (WHERE sent).

### P3 — Minor Remaining Items
- `baseUrl()` helper duplicated in `twilio-webhook.ts` and `follow-up-scheduler.ts`
- `plan-gate.ts` is devtool living in `src/` (move to `scripts/`)
- Error message extraction pattern repeated 8+ times (extract `getErrorMessage()`)
- `shapeLead` accepts undefined but callers never pass it
- "No venue intelligence" placeholder wastes LLM tokens in context.ts
- No minimum password/secret length enforcement at startup
- `computeFollowUpDelay` called with unsafe cast (`newCount as 0 | 1 | 2`)

## Key Artifacts

| Item | Location |
|------|----------|
| Audit summary | `docs/reviews/main-full-audit/REVIEW-SUMMARY.md` |
| Batch 1 findings (3 files) | `docs/reviews/main-full-audit/batch1-*.md` |
| Batch 2 findings (3 files) | `docs/reviews/main-full-audit/batch2-*.md` |
| Batch 3 findings (3 files) | `docs/reviews/main-full-audit/batch3-*.md` |
| Shared stmt cache | `src/db/stmt-cache.ts` |
| Startup recovery | `src/post-pipeline.ts:recoverStuckLeads()` |

## Deferred Items (Carried Forward)

- **Verify gate voice upgrades** — YAGNI for now
- **full_draft length cap** — no max length on full_draft
- **Accessibility review** — never reviewed
- **Helmet security headers** — skipped intentionally; current manual headers use nonce-based CSP which is stronger than Helmet's unsafe-inline
- **Stale `feat/gig-lead-pipeline` as GitHub default branch** — 370 commits behind main, should be changed to main

## Three Questions (Work Phase)

1. **Hardest implementation decision in this session?** Whether to merge the unmerged branches directly or re-apply fixes surgically. Chose surgical re-application because the branches had conflicts in 4 files and their server.ts had been restructured to inline app.ts. Re-applying let us keep the current createApp() architecture while getting all the fixes.

2. **What did you consider changing but left alone, and why?** The Helmet middleware from batch-d. The current app.ts uses per-request CSP nonces (`nonce-${randomBytes(16)}`), which is strictly more secure than Helmet's `unsafe-inline` approach. Adding Helmet would have downgraded CSP security. Kept the manual security headers.

3. **Least confident about going into the next session?** The Gmail lead persistence in orchestrator.ts. It inserts leads at parse time and updates after pipeline, but the automation `ParsedLead` type doesn't carry `eventType` — so event_type is only populated after the pipeline runs (from classification). Also, held leads get status "sent" which may not be the ideal status for a lead that was held by the router. May need a "held" status or at least a `done_reason` of "held" to distinguish from SMS-sent leads on the dashboard.

## Prompt for Next Session

```
Read HANDOFF.md. Continue fixing open audit issues.

Priority order:
1. Platform type unification (src/types.ts, src/automation/types.ts)
2. Delete standalone main.ts (src/automation/main.ts)
3. Consolidate dual SMS senders (src/sms.ts vs src/automation/senders/twilio-sms.ts)
4. claimLeadForSending double-claim fix (src/db/leads.ts)
5. P3 cleanup batch (baseUrl helper, plan-gate move, error extraction, etc.)

Audit findings: docs/reviews/main-full-audit/REVIEW-SUMMARY.md
Key files: src/types.ts, src/automation/types.ts, src/automation/main.ts,
src/sms.ts, src/automation/senders/twilio-sms.ts, src/db/leads.ts
```
