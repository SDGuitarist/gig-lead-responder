# Fix Summary — feat/follow-up-v2-dashboard

**Date:** 2026-03-02
**Batches executed:** 4 (A, B, C, D)
**Total findings fixed:** 21
**Total findings deferred:** 12
**False positives / rejected:** 5

## Fixed

| # | Finding | Severity | Batch | Commit |
|---|---------|----------|-------|--------|
| 24 | `_req` prefixed as unused but actually used | P3 | A | `be86d17` |
| 26 | State machine comment says "4 states" but there are 5 | P3 | A | `be86d17` |
| 27 | Duplicate "Outcome tracking types" comment header | P3 | A | `be86d17` |
| 30 | `MAX_FOLLOW_UPS` and `computeFollowUpDelay` exported but never imported | P3 | A | `be86d17` |
| 33 | `isStale` references `sms_sent_at` which is never in API response | P3 | A | `be86d17` |
| 1 | COOKIE_SECRET env var missing — production crash | P1 | B | `a20a710` |
| 2 | Table rebuild migration — indexes dropped, not recreated | P1 | B | `cc1fc2b` |
| 3 | CSRF guard missing on api.ts POST routes | P1 | B | `415949b` |
| 4 | Scheduler stuck in "sent" status on failure | P1 | B | `7313dbd` |
| 5 | Non-atomic approve-then-send flow | P1 | B | `419b654` |
| 6 | Non-null assertion on `shapeLead()` | P1 | B | `52d2cf0` |
| 22 | Scheduler draft-store races with user skip/reply | P2 | B | `1fecaca` |
| 23 | Twilio validation bypass not production-guarded | P2 | B | `d90199f` |
| 8 | CSP blocks Google Fonts — dashboard broken | P2 | C | `c244fc7` |
| 9 | Pipeline error messages forwarded to client via SSE | P2 | C | `c244fc7` |
| 10 | No input length limits on edit and analyze | P2 | C | `c244fc7` |
| 11 | Unsafe cast of `req.body` in snooze handler | P2 | C | `c244fc7` |
| 17 | `apiFetch`/`apiPost` inconsistent auth retry | P2 | C | `c244fc7` |
| 25 | Scheduler heartbeat log noisy (96 lines/day) | P3 | C | `c244fc7` |
| 28 | Magic number `3` in dashboard follow-up count | P3 | C | `c244fc7` |
| 36 | `retryFailures` map entries not bounded | P3 | C | `c244fc7` |

## Deferred

| # | Finding | Severity | Reason |
|---|---------|----------|--------|
| 7 | `approveFollowUp` flow ambiguity | P2 | Needs product decision — "Approve" semantics unclear |
| 13 | `leads.ts` 700+ lines spanning 4+ responsibilities | P2 | Structural refactor — dedicated PR after compound phase |
| 14 | Repeated ID-parse + lead-lookup boilerplate (7 handlers) | P2 | Structural refactor — tackle with #13 |
| 15 | Terminal-state functions nearly identical | P2 | Core state machine — tackle with #13 |
| 16 | Dashboard HTML monolith (2,474 lines) | P2 | Acceptable until ~3,000 lines |
| 18 | `shapeLead` imported from peer `api.ts` | P2 | Structural file move — tackle with #13 |
| 19 | Scheduler error SMS lacks rate limiting | P2 | New feature requiring dedup/throttle logic |
| 20 | Double database read in `updateLead` | P2 | Core DB path — tackle with #13 |
| 21 | SELECT * with no pagination | P2 | Needs frontend pagination UI |
| 29 | `var` used throughout dashboard JS | P3 | ~200+ declarations, large surface area, separate PR |
| 35 | Cookie session has no revocation mechanism | P3 | Needs product decision on session management |
| 37 | SSE connection has no timeout or abort handler | P3 | New feature requiring abort controller wiring |

## Not Fixed (false positives / rejected)

| # | Finding | Reason |
|---|---------|--------|
| 38 | `COOKIE_MAX_AGE_S` declared but never used | False positive — used to compute `COOKIE_MAX_AGE_MS` |
| 31 | `satisfies FollowUpActionResponse` used 12+ times | False positive — annotation not present in code |
| 12 | Duplicated `baseUrl()` across two files | Rejected — coupling worse than 2-line duplication |
| 32 | `SnoozeRequestBody` one-field type | Rejected — type provides documentation value at cast site |
| 34 | `analyzeKvHTML` passes raw HTML as value | Rejected — callers already escape with `esc()` |

## Severity Snapshot

- **P1:** 6 fixed, 0 deferred
- **P2:** 10 fixed, 9 deferred
- **P3:** 5 fixed, 3 deferred, 5 not applicable

## Patterns Worth Capturing

1. **"Guard at the boundary" pattern** — Findings #3 (CSRF), #6 (null guard), #10 (input limits), #11 (body validation) all share the same fix shape: validate at the handler entry point, fail fast with 4xx. Could become a `docs/solutions/` entry for "input validation checklist for Express handlers."

2. **"Atomic state transitions" pattern** — Findings #4 (scheduler stuck), #5 (non-atomic approve), #22 (draft-store race) all stem from multi-step writes without transactional guarantees. The fix pattern: fold related writes into one transaction, add WHERE guards for concurrent access. Worth a solution doc on "state machine safety in SQLite."

3. **"Deferred structural cluster" pattern** — Five findings (#13, #14, #15, #18, #20) are symptoms of one root cause: `leads.ts` doing too much. Documenting the planned split (`db/migrate.ts`, `db/leads.ts`, `db/follow-ups.ts`) would help the refactoring session.
