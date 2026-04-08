# HANDOFF -- Gig Lead Responder

**Date:** 2026-04-07
**Branch:** `main`
**Phase:** Post-audit cleanup continued. 21/32 findings fixed (16 prior session + 5 this session).

## Current State

Continued fixing open audit findings from the full 9-agent codebase review. Five fixes applied this session, all passing (84 tests, 0 fail).

### What Was Done (April 7 — Session 2)

| Commit | Description |
|--------|-------------|
| `a1ce772` | fix: unify Platform type — single source of truth in types.ts |
| `dec2f7d` | fix: delete standalone automation/main.ts — poller.ts is canonical |
| `ae4320a` | fix: consolidate dual SMS senders into src/sms.ts |
| `f24fdee` | fix: prevent double-claim — claimLeadForSending only from 'received' |
| `c4162f3` | fix: P3 cleanup — dedupe baseUrl, add getErrorMessage, move plan-gate |

### Details

1. **Platform type unification (audit #8, #11)** — Single `Platform` type in `src/types.ts` covering all sources (gigsalad, thebash, direct, yelp, squarespace). `Classification.platform` now uses it. `source-validator.ts` exports `GmailPlatform` as a narrower subset for email validation.

2. **Delete standalone main.ts (audit #14, #20)** — Removed `src/automation/main.ts` (176 lines) and `"auto"` script from package.json. `poller.ts` is the canonical polling entry point with Railway credential bootstrapping.

3. **Consolidate dual SMS senders (audit #13, #19)** — Added `sendSmsSafe()` to `src/sms.ts` for automation use (dry-run support, config-based, no-throw). Orchestrator now imports from shared module. Deleted `automation/senders/twilio-sms.ts`.

4. **Double-claim fix (audit #21)** — `claimLeadForSending` WHERE clause narrowed from `IN ('received', 'sent')` to `= 'received'`. Prevents concurrent approvals on already-sent leads causing double SMS.

5. **P3 cleanup batch (audit #27, #29, #30, #31)** — Extracted `baseUrl()` and `getErrorMessage()` to `src/utils/helpers.ts`. Removed "No venue intelligence" LLM placeholder (saves tokens). Moved `plan-gate.ts` + test to `scripts/`.

### Tests: 84 pass, 0 fail

## Open Issues (Remaining from Audit — 11 of 32)

### P2 — Dual Parser Systems (audit #12, #18)
**Files:** `src/email-parser.ts` vs `src/automation/parsers/`
**Issue:** Two codepaths parse GigSalad emails with different types/regex. `ParsedLead` name collision.
**Status:** Deferred — requires design decision on whether to unify or keep separate with clear naming.

### P2 — Data Lifecycle Management (audit #19, #25)
**Files:** `src/db/migrate.ts`, `src/automation/dedup.ts`
**Issue:** No cleanup for leads, processed_emails, venue_misses, JSONL logs. Unbounded growth.

### P2 — Table Rebuild Migration Not Crash-Safe (audit #16, #22)
**File:** `src/db/migrate.ts:98-148`
**Issue:** Crash between DROP and RENAME loses data.

### P2 — Follow-up Scheduler Claim-Then-Generate Gap (audit #17, #23)
**File:** `src/follow-up-scheduler.ts:43-62`
**Issue:** Claims follow-up before generating draft. Dashboard shows "sent" with no draft.

### P2 — `postPipeline` Non-Atomic Write (audit #18, #24)
**File:** `src/post-pipeline.ts:11-53`
**Issue:** Crash between saving results and marking sent = stuck lead.

### P2 — Portal Client Boilerplate (audit #15, #21)
**Files:** `src/automation/portals/gigsalad-client.ts` vs `yelp-client.ts`
**Issue:** ~80 lines duplicated constructor/login/context.

### P2 — Stale `feat/gig-lead-pipeline` as GitHub Default Branch (audit #20, #26)
**Issue:** 370 commits behind main. Confuses new clones.

### P2 — Unsafe `as` Casts on JSON.parse (audit #9)
**File:** `src/twilio-webhook.ts:143-146`
**Issue:** `JSON.parse(classification_json)` cast to `Classification` without validation.

### P2 — `void err` Swallows Error Context (audit #10)
**File:** `src/api.ts:85,252`

### P3 — Remaining Minor Items
- `shapeLead` accepts undefined but callers never pass it
- `computeFollowUpDelay` called with unsafe cast
- No minimum password/secret length enforcement at startup
- `getErrorMessage()` utility exists but not yet adopted in all catch blocks

## Deferred Items (Carried Forward)

- **Verify gate voice upgrades** — YAGNI for now
- **full_draft length cap** — no max length on full_draft
- **Accessibility review** — never reviewed
- **Helmet security headers** — skipped; current nonce-based CSP is stronger
- **Stale `feat/gig-lead-pipeline` as GitHub default branch** — change to main

## Three Questions (Work Phase)

1. **Hardest implementation decision in this session?** Whether `sendSmsSafe` should be a separate export or an overload of `sendSms`. Chose separate export because the return types differ (`void` vs `{success, error?}`) and the server-side callers depend on throw-on-failure semantics. Mixing both behaviors under one name would be confusing.

2. **What did you consider changing but left alone, and why?** Considered replacing all `err instanceof Error ? err.message : String(err)` occurrences with `getErrorMessage()` calls. Left most alone because each catch block also accesses `err.stack` or does other error-specific work — a simple function swap wouldn't meaningfully simplify them. The utility is available for new code.

3. **Least confident about going into the next session?** The `GmailPlatform` vs `Platform` split in source-validator.ts. `GmailPlatform` is a subset of `Platform` but isn't expressed as `Extract<Platform, ...>` — it's a separate literal union. If a new platform is added to `Platform` in types.ts, you'd also need to update `GmailPlatform` and `ALLOWED_SENDERS` separately. This is fine for now (both are small and explicit) but could drift.

## Prompt for Next Session

```
Read HANDOFF.md. Continue fixing remaining audit issues.

Priority order:
1. Unsafe `as` casts on JSON.parse in twilio-webhook.ts (audit #9)
2. `void err` swallows error context in api.ts (audit #10)
3. Follow-up scheduler claim-then-generate gap
4. Data lifecycle management (retention policy)
5. Remaining P3 items (shapeLead, computeFollowUpDelay, min secret length)

Audit findings: docs/reviews/main-full-audit/REVIEW-SUMMARY.md
Key files: src/twilio-webhook.ts, src/api.ts, src/follow-up-scheduler.ts,
src/db/migrate.ts, src/utils/shape-lead.ts, src/db/follow-ups.ts
```
