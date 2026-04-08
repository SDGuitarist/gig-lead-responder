# HANDOFF -- Gig Lead Responder

**Date:** 2026-04-07
**Branch:** `main`
**Phase:** Post-audit cleanup. 26/32 findings fixed. 6 remaining (3 P2, 3 P3).

## Current State

Two more audit findings verified/fixed this session. `postPipeline` non-atomic write confirmed already handled by `recoverStuckLeads()`. Table rebuild crash-safety improved with orphaned `leads_new` recovery. 84 tests pass, 0 fail.

### What Was Done (April 7 — Session 4)

| Commit | Description |
|--------|-------------|
| `b0f1ba2` | fix: add startup recovery for orphaned leads_new table |

Also confirmed: `postPipeline` non-atomic write (audit #18, #24) is already handled by `recoverStuckLeads()` in `server.ts:38` — queries `WHERE status='received' AND pipeline_completed_at IS NOT NULL`, re-sends SMS, marks sent.

### Tests: 84 pass, 0 fail

## Open Issues (Remaining from Audit — 6 of 32)

### P2 — Dual Parser Systems (audit #12, #18)
**Files:** `src/email-parser.ts` vs `src/automation/parsers/`
**Issue:** Two codepaths parse GigSalad emails with different types/regex. `ParsedLead` name collision.
**Status:** Deferred — requires design decision on whether to unify or keep separate with clear naming.

### P2 — Data Lifecycle Management (audit #19, #25)
**Files:** `src/db/migrate.ts`, `src/automation/dedup.ts`
**Issue:** No cleanup for leads, processed_emails, venue_misses, JSONL logs. Unbounded growth.

### P2 — Portal Client Boilerplate (audit #15, #21)
**Files:** `src/automation/portals/gigsalad-client.ts` vs `yelp-client.ts`
**Issue:** ~80 lines duplicated constructor/login/context.

### P3 — Remaining Minor Items
- `shapeLead` accepts undefined but callers never pass it
- `computeFollowUpDelay` called with unsafe cast (`newCount as 0 | 1 | 2`)
- No minimum password/secret length enforcement at startup

## Deferred Items (Carried Forward)

- **Verify gate voice upgrades** — YAGNI for now
- **full_draft length cap** — no max length on full_draft
- **Accessibility review** — never reviewed
- **Helmet security headers** — skipped; current nonce-based CSP is stronger
- **Stale `feat/gig-lead-pipeline` as GitHub default branch** — change to main

## Three Questions (Work Phase)

1. **Hardest implementation decision in this session?** Whether the table rebuild crash-safety fix was actually needed. SQLite transactions with WAL mode are atomic — `DROP` + `RENAME` inside `db.transaction()` either both happen or neither does. Added orphan recovery anyway as a defense-in-depth measure for edge cases (corrupted WAL, filesystem issues).

2. **What did you consider changing but left alone, and why?** Considered adding a `leads_new` check inside the transaction itself (checking before DROP). Left it alone because the transaction is already correct — the orphan recovery at startup covers the only realistic failure mode (WAL corruption), and adding checks inside the transaction would add complexity with no benefit.

3. **Least confident about going into the next session?** Data lifecycle management is the remaining high-value P2 but it's the most design-heavy item left. Need to decide: how long to keep leads (90 days? 180?), whether to archive or hard-delete, how to handle processed_emails TTL without breaking dedup for in-flight leads. This needs a brainstorm, not a quick fix.

## Prompt for Next Session

```
Read HANDOFF.md. Continue fixing remaining audit issues.

Priority order:
1. P3 batch: shapeLead undefined, computeFollowUpDelay cast, min secret length
2. Change GitHub default branch from feat/gig-lead-pipeline to main
3. Data lifecycle management — needs brainstorm (retention policy design)
4. Portal client boilerplate — low urgency, deferred
5. Dual parser systems — deferred (design decision needed)

Audit findings: docs/reviews/main-full-audit/REVIEW-SUMMARY.md
Key files: src/utils/shape-lead.ts, src/db/follow-ups.ts, src/auth.ts,
src/server.ts
```
