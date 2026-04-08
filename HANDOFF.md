# HANDOFF -- Gig Lead Responder

**Date:** 2026-04-07
**Branch:** `main`
**Phase:** Post-audit cleanup. 24/32 findings fixed (16 session 1 + 5 session 2 + 3 session 3).

## Current State

Three more audit findings resolved this session. JSON.parse shape validation added, `void err` confirmed already fixed, follow-up scheduler draft-before-claim gap closed. 84 tests pass, 0 fail.

### What Was Done (April 7 — Session 3)

| Commit | Description |
|--------|-------------|
| `f607613` | fix: add runtime shape validation to JSON.parse in twilio-webhook |
| `062d637` | fix: generate follow-up draft before claiming to close dashboard gap |

Also confirmed: `void err` in api.ts (audit #10) was already fixed in a prior session — both catch blocks now log the actual error object.

### Tests: 84 pass, 0 fail

## Open Issues (Remaining from Audit — 8 of 32)

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

### P2 — `postPipeline` Non-Atomic Write (audit #18, #24)
**File:** `src/post-pipeline.ts:11-53`
**Issue:** Crash between saving results and marking sent = stuck lead.

### P2 — Portal Client Boilerplate (audit #15, #21)
**Files:** `src/automation/portals/gigsalad-client.ts` vs `yelp-client.ts`
**Issue:** ~80 lines duplicated constructor/login/context.

### P2 — Stale `feat/gig-lead-pipeline` as GitHub Default Branch (audit #20, #26)
**Issue:** 370 commits behind main. Confuses new clones.

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

1. **Hardest implementation decision in this session?** How much runtime validation to add for JSON.parse in twilio-webhook. Full schema validation (checking every field) would be overkill for data we wrote ourselves. Settled on checking one discriminating field per type (`mode` for Classification, `quote_price` for PricingResult) — enough to catch corrupt/missing data without over-validating internal writes.

2. **What did you consider changing but left alone, and why?** Considered reordering the scheduler to also store the draft atomically with the claim (single transaction). Left it as separate steps because `storeFollowUpDraft` already has a WHERE guard on status, and wrapping the LLM call + DB write in a transaction would violate the async-SQLite boundary (documented in solution doc).

3. **Least confident about going into the next session?** The `postPipeline` non-atomic write and table rebuild crash-safety fixes both involve database operation ordering. The async-SQLite transaction boundary constraint means we can't just wrap things in a transaction — we need startup recovery for stuck states, which adds complexity. Need to check if `recoverStuckLeads()` in post-pipeline.ts already handles the failure modes.

## Prompt for Next Session

```
Read HANDOFF.md. Continue fixing remaining audit issues.

Priority order:
1. postPipeline non-atomic write — check if recoverStuckLeads() covers it (src/post-pipeline.ts)
2. Data lifecycle management — add retention policy for old leads/processed_emails
3. Table rebuild crash-safety (src/db/migrate.ts:98-148)
4. P3 items: shapeLead undefined, computeFollowUpDelay cast, min secret length
5. Change GitHub default branch from feat/gig-lead-pipeline to main

Audit findings: docs/reviews/main-full-audit/REVIEW-SUMMARY.md
Key files: src/post-pipeline.ts, src/db/migrate.ts, src/utils/shape-lead.ts,
src/db/follow-ups.ts, src/auth.ts, src/server.ts
```
