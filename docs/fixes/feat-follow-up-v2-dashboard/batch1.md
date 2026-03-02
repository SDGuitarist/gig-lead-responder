# Batch A — Deletes and Removals

**Date:** 2026-03-02
**Commit:** `be86d17`
**Findings fixed:** 5 of 6 (1 false positive skipped)

### Prior Phase Risk

> "What might this review have missed? Accessibility, timezone handling, SMS content validation, logging consistency, browser compatibility."

Batch A is comment/dead-code cleanup — no behavioral changes, so prior risk items don't apply here.

---

## Fixes Applied

| # | Finding | File | Fix |
|---|---------|------|-----|
| 30 | `MAX_FOLLOW_UPS` and `computeFollowUpDelay` exported but never imported | `src/leads.ts` | Removed `export` keyword; functions remain for internal use |
| 33 | `isStale` references `sms_sent_at` (never in API response) | `public/dashboard.html` | Removed dead `l.sms_sent_at ||` — falls through to `l.updated_at` anyway |
| 27 | Duplicate "Outcome tracking types" comment header | `src/types.ts` | Removed first duplicate at line 159 |
| 26 | State machine comment says "4 states" but there are 5 | `src/leads.ts` | Fixed to "5 states, 8 transitions", added `replied` paths |
| 24 | `_req` prefixed as unused but actually used | `src/api.ts` | Renamed `_req` → `req` on GET /api/leads handler |

## Skipped

| # | Finding | Reason |
|---|---------|--------|
| 38 | `COOKIE_MAX_AGE_S` declared but never used | **False positive** — used on line 8 to compute `COOKIE_MAX_AGE_MS` |

## Three Questions

1. **Hardest fix in this batch?** The state machine comment (#26) — needed to count all transitions including `replied` from both `pending` and `sent` states. Got 8 transitions total.

2. **What did you consider fixing differently, and why didn't you?** Considered deleting `MAX_FOLLOW_UPS` and `computeFollowUpDelay` entirely since the review said "exported but never imported." But they're used internally — the issue was just the unnecessary `export` keyword.

3. **Least confident about going into the next batch or compound phase?** Nothing — all changes are deletions/renames with zero behavioral impact.
