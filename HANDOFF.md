# HANDOFF -- Gig Lead Responder

**Date:** 2026-04-07
**Branch:** `main` (now GitHub default branch)
**Phase:** Post-audit cleanup complete for mechanical fixes. 29/32 findings fixed. 3 remaining P2s need design decisions.

## Current State

P3 batch fixed and GitHub default branch changed to `main`. All mechanical audit findings resolved. Remaining 3 items are design-heavy P2s that each need their own brainstorm. 84 tests pass, 0 fail.

### What Was Done (April 7 — Session 5)

| Commit | Description |
|--------|-------------|
| `bd0da08` | fix: P3 batch — shapeLead type, followup delay bounds, min secret length |

Also done: Changed GitHub default branch from `feat/gig-lead-pipeline` to `main` via `gh repo edit`.

### Tests: 84 pass, 0 fail

## Open Issues (Remaining from Audit — 3 of 32)

All remaining items are design-heavy P2s requiring brainstorm before implementation.

### P2 — Dual Parser Systems (audit #12, #18)
**Files:** `src/email-parser.ts` vs `src/automation/parsers/`
**Issue:** Two codepaths parse GigSalad emails with different types/regex. `ParsedLead` name collision.
**Decision needed:** Unify into one parser (complex — different input shapes) or rename automation `ParsedLead` and document as separate systems with different responsibilities.

### P2 — Data Lifecycle Management (audit #19, #25)
**Files:** `src/db/migrate.ts`, `src/automation/dedup.ts`
**Issue:** No cleanup for leads, processed_emails, venue_misses, JSONL logs. Unbounded growth.
**Decision needed:** Retention period (90 vs 180 days), archive vs hard-delete, processed_emails TTL without breaking dedup for in-flight leads.

### P2 — Portal Client Boilerplate (audit #15, #21)
**Files:** `src/automation/portals/gigsalad-client.ts` vs `yelp-client.ts`
**Issue:** ~80 lines duplicated constructor/login/context.
**Decision needed:** Extract `BasePortalClient` or accept duplication (only 2 clients, unlikely to add more soon).

## Deferred Items (Carried Forward)

- **Verify gate voice upgrades** — YAGNI for now
- **full_draft length cap** — no max length on full_draft
- **Accessibility review** — never reviewed
- **Helmet security headers** — skipped; current nonce-based CSP is stronger

## Audit Resolution Summary (32 findings)

| Status | Count | Details |
|--------|-------|---------|
| Fixed (code changes) | 22 | Sessions 1-5: Platform unification, SMS consolidation, double-claim, JSON validation, scheduler gap, migration safety, P3 batch, etc. |
| Already handled | 4 | `void err` (prior fix), `postPipeline` non-atomic (recoverStuckLeads), `callClaude` validate (all callers pass it), `FORMAT_FAMILIES` (fixed in session 1) |
| Config change | 1 | GitHub default branch → main |
| Skipped (intentional) | 2 | Helmet (nonce CSP is stronger), dead venues.ts + SCOPES (deleted in session 1) |
| Remaining (need brainstorm) | 3 | Dual parsers, data lifecycle, portal boilerplate |

## Three Questions (Work Phase)

1. **Hardest implementation decision in this session?** Whether `shapeLead` should keep the `| undefined` parameter for defensive safety or remove it entirely. Removed it — the function is called from `.map(shapeLead)` on `LeadRecord[]` arrays and from `updateLead()` results that are already null-checked. The undefined path was dead code creating a misleading type signature.

2. **What did you consider changing but left alone, and why?** Considered making `computeFollowUpDelay` accept plain `number` and do the bounds check internally, instead of keeping the `0 | 1 | 2` parameter type. Kept the narrow type because the function's contract is clear — it maps follow-up indices to delays, and the caller should know the valid range. `Math.min` at the call site makes the bounds explicit.

3. **Least confident about going into the next session?** The 3 remaining P2s are all "design first, code second" items. Data lifecycle management is the highest value but needs careful thinking about retention periods and the interaction between processed_emails TTL and dedup guarantees. Dual parsers is the most complex — the two parser systems handle genuinely different input shapes (Mailgun webhook vs Gmail API message), and unifying them may not be worth the effort.

## Prompt for Next Session

```
Read HANDOFF.md. The mechanical audit fixes are done (29/32).

Three P2s remain, all need brainstorm before implementation:
1. Data lifecycle management — retention policy design
2. Dual parser systems — unify or rename + document
3. Portal client boilerplate — extract base class or accept duplication

Pick one and run /workflows:brainstorm on it, or move to a new feature.
Spiral Voice Integration is the next major initiative (see memory).
```
