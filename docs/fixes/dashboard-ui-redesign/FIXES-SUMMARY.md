# Fix Summary — dashboard-ui-redesign

**Date:** 2026-02-22
**Batches executed:** 3 (A, B, C)
**Total findings fixed:** 18 (17 directly fixed + 1 resolved as side effect of another fix)
**Total findings deferred:** 10 (9 from Batch D + 1 from Batch C)

## Fixed

| # | Finding | Severity | Batch | Commit |
|---|---------|----------|-------|--------|
| 6 | Old `src/dashboard.ts` is dead code (185 lines) | P2 | A | `4e5902f` |
| 18 | Dead `listLeads()` query function | P3 | A | `4e5902f` |
| 1 | Unauthenticated `/api/analyze` endpoint | P1 | B | `1f8197f` |
| 2 | Approve endpoint race condition (double SMS) | P1 | B | `1f8197f` |
| 3 | Auth bypass when env vars unset | P1 | B | `1f8197f` |
| 4 | Non-null assertion on `updateLead` return | P1 | B | `1f8197f` |
| 7 | Auth applied piecemeal — new routes unprotected | P2 | B | `1f8197f` |
| 8 | Timing-unsafe password comparison | P2 | B | `1f8197f` |
| 9 | Basic Auth parser breaks on passwords with colons | P2 | B | `1f8197f` |
| 15 | Edit doesn't update `compressed_draft` | P2 | B | `1f8197f` |
| 5 | `shapeLead()` brittle mapper with unsafe casts | P2 | C | `06d0ab4` |
| 10 | Full DOM rebuild on every row click | P2 | C | `06d0ab4` |
| 16 | `renderAnalyzeResults()` no null guards | P2 | C | `06d0ab4` |
| 17 | `/api/analyze` inline in `server.ts` | P3 | B* | `1f8197f` |
| 20 | `leads.db` not in `.gitignore` | P3 | C | `06d0ab4` |
| 23 | Data layer: no CHECK, duplication, missing indexes | P3 | C | `06d0ab4` |
| 24 | Client-side constants drift risk | P3 | C | `06d0ab4` |
| 28 | `apiPost` no 401 handling; SMS no length validation | P3 | C | `06d0ab4` |

*Finding #17 was resolved as a side effect of Batch B fix #1 (moving `/api/analyze` into `api.ts`).

## Deferred

| # | Finding | Severity | Reason |
|---|---------|----------|--------|
| 11 | No pagination | P2 | Changes dashboard behavior, needs product decision |
| 12 | SSE endpoint: no timeout, no limits | P2 | Needs design for concurrency semaphore |
| 13 | No security headers | P2 | New dependency (helmet) |
| 14 | No rate limiting | P2 | New dependency (express-rate-limit) |
| 19 | Inline CSS/JS monolith | P3 | Large refactor, changes deploy story |
| 21 | No CSRF protection | P3 | Accepted risk for internal single-user tool |
| 22 | YAGNI: mobile card view and approve animation | P3 | Product decision needed |
| 25 | Credentials in JS variable | P3 | Accepted risk for single-user tool |
| 26 | `express.json` no body size limit | P3 | Trivial but low priority |
| 27 | Error messages in SSE may leak internal details | P3 | Minor risk for internal tool |

## Patterns Worth Capturing

1. **Atomic claim pattern** — Batch B's race condition fix used a dedicated `claimLeadForSending()` function with `UPDATE...WHERE status IN (...)` instead of read-check-write. The generic `updateLead` was preserved for all other callers. Pattern: single-purpose atomic functions for concurrent state transitions, not parameters bolted onto generic CRUD.

2. **Environment-aware fatal guards** — Batch B's auth bypass fix uses `NODE_ENV === "production" || RAILWAY_ENVIRONMENT` to decide severity: production = `process.exit(1)` on missing auth vars, development = skip + `console.warn`. Pattern: fail-closed in production, fail-open in development, with a visible warning so devs know auth is skipped.

3. **Targeted DOM manipulation via data attributes** — Batch C's DOM rebuild fix added `data-detail` attributes to collapse/expand specific panels instead of calling full `renderTable()`. Pattern: when a static HTML page manages its own state, use `data-*` attributes as DOM selectors for surgical updates instead of full re-renders.
