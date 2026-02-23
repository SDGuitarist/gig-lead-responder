# Fix Batch Plan — dashboard-ui-redesign

**Date:** 2026-02-22
**Source:** docs/reviews/dashboard-ui-redesign/REVIEW-SUMMARY.md
**Total findings:** 28

## Batch A — Deletes and Removals

| # | Finding | Severity | File | Risk |
|---|---------|----------|------|------|
| 1 | #6 Old `src/dashboard.ts` is dead code (185 lines) | P2 | `src/dashboard.ts`, `src/server.ts` | Zero — deletion only |
| 2 | #18 Dead/duplicate query functions in `leads.ts` | P3 | `src/leads.ts` | Zero — deletion only (after #6 removes only consumer) |

## Batch B — Data Integrity and Hot Path

| # | Finding | Severity | File | Risk |
|---|---------|----------|------|------|
| 1 | #1 Unauthenticated `/api/analyze` endpoint | P1 | `src/server.ts`, `src/api.ts`, `public/dashboard.html` | Auth gap — move route + add header |
| 2 | #2 Approve endpoint race condition enables double SMS | P1 | `src/api.ts` | Alters approve flow — `sending` transitional state |
| 3 | #3 Auth bypass when env vars unset | P1 | `src/auth.ts` | Changes dev workflow — must use env vars |
| 4 | #4 Non-null assertion on `updateLead` return | P1 | `src/api.ts:136,165` | Adds null handling on hot paths |
| 5 | #7 Auth applied piecemeal — new routes unprotected by default | P2 | `src/api.ts` | Moves auth to router level (related to #1) |
| 6 | #8 Timing-unsafe password comparison | P2 | `src/auth.ts` | Changes auth comparison logic |
| 7 | #9 Basic Auth parser breaks on passwords with colons | P2 | `src/auth.ts` | Changes auth parsing logic |
| 8 | #15 Edit doesn't update `compressed_draft` | P2 | `src/api.ts` | Stale SMS risk — needs warning at minimum |

## Batch C — Code Quality and Abstractions

| # | Finding | Severity | File | Risk |
|---|---------|----------|------|------|
| 1 | #5 `shapeLead()` brittle 50-line mapper with unsafe casts | P2 | `src/api.ts`, `src/types.ts` | Refactor — structure change |
| 2 | #10 Full DOM rebuild on every row click | P2 | `public/dashboard.html` | Changes UI interaction model |
| 3 | #16 `renderAnalyzeResults()` no null guards | P2 | `public/dashboard.html` | Adds defensive checks |
| 4 | #17 `/api/analyze` inline in `server.ts` | P3 | `src/server.ts` | Addressed by Batch B #1 |
| 5 | #19 Inline CSS/JS monolith | P3 | `public/dashboard.html` | Large refactor |
| 6 | #20 `leads.db` not in `.gitignore` | P3 | `.gitignore` | Zero risk |
| 7 | #23 Data layer: no CHECK, duplication, missing indexes | P3 | `src/leads.ts` | Schema + helper changes |
| 8 | #24 Client-side constants drift risk | P3 | `public/dashboard.html` | Documentation change |
| 9 | #28 `sendSms` no length validation; `apiPost` no 401 handling | P3 | `src/api.ts`, `public/dashboard.html` | Adds warnings/handling |

## Batch D — Deferred

| # | Finding | Severity | File | Why Deferred |
|---|---------|----------|------|-------------|
| 1 | #11 No pagination | P2 | `src/api.ts`, `src/leads.ts` | Changes dashboard behavior, needs product decision |
| 2 | #12 SSE endpoint: no timeout, no limits | P2 | `src/server.ts` | Needs design for concurrency semaphore |
| 3 | #13 No security headers | P2 | `src/server.ts` | New dependency (helmet) |
| 4 | #14 No rate limiting | P2 | `src/server.ts` | New dependency (express-rate-limit) |
| 5 | #21 No CSRF protection | P3 | `src/api.ts` | Accepted risk for internal tool |
| 6 | #22 YAGNI: mobile card view and approve animation | P3 | `public/dashboard.html` | Product decision needed |
| 7 | #25 Credentials in JS variable | P3 | `public/dashboard.html` | Accepted risk for single-user tool |
| 8 | #26 `express.json` no body size limit | P3 | `src/server.ts` | Trivial but low priority |
| 9 | #27 Error messages in SSE may leak internal details | P3 | `src/server.ts` | Minor risk for internal tool |
