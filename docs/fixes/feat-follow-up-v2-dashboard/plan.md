# Fix Batch Plan — feat/follow-up-v2-dashboard

**Date:** 2026-03-02
**Source:** docs/reviews/feat-follow-up-v2-dashboard/REVIEW-SUMMARY.md
**Total findings:** 38

---

## Batch A — Deletes and Removals

| # | Finding | Severity | File | Risk |
|---|---------|----------|------|------|
| 38 | `COOKIE_MAX_AGE_S` declared but never used (dead code) | P3 | `src/auth.ts:7` | Zero — deletion only |
| 30 | `MAX_FOLLOW_UPS` and `computeFollowUpDelay` exported but never imported | P3 | `src/leads.ts:324,333` | Zero — remove unused exports or functions |
| 33 | `isStale` references `sms_sent_at` which is never in API response (dead code) | P3 | `public/dashboard.html:1378` | Zero — remove dead reference |
| 27 | Duplicate comment header "Outcome tracking types" | P3 | `src/types.ts:159-166` | Zero — comment cleanup |
| 26 | Follow-up status comment says "4 states" but there are 5 | P3 | `src/leads.ts:313` | Zero — comment fix |
| 24 | `_req` prefixed as unused but actually used | P3 | `src/api.ts:96-98` | Zero — rename `_req` → `req` |

**Total: 6 findings**

---

## Batch B — Data Integrity and Hot Path

| # | Finding | Severity | File | Risk |
|---|---------|----------|------|------|
| 1 | COOKIE_SECRET env var missing — production crash | P1 | `src/auth.ts:13-15`, `.env.example` | Deploy blocker — server exits without it |
| 2 | Table rebuild migration — indexes dropped, not recreated | P1 | `src/leads.ts:87-152` | Data loss risk — DDL inside transaction, indexes lost after rebuild |
| 3 | CSRF guard missing on api.ts POST routes | P1 | `src/api.ts:123,175,218,296` | Security — 4 unprotected endpoints, 1-line fix each |
| 4 | Scheduler stuck in "sent" status on failure | P1 | `src/follow-up-scheduler.ts:42-65` | Data integrity — failed follow-ups invisible forever |
| 5 | Non-atomic approve-then-send flow | P1 | `src/api.ts:146-170` | Data integrity — crash between writes = stuck state |
| 6 | Non-null assertion on `shapeLead()` | P1 | `src/follow-up-api.ts:35,59,111,135` | Runtime crash — `null` in JSON response, 4 occurrences |
| 22 | Scheduler draft-store races with user skip/reply | P2 | `src/follow-up-scheduler.ts:48-50` | Race condition — inconsistent state after concurrent actions |
| 23 | Twilio validation bypass not production-guarded | P2 | `src/twilio-webhook.ts:38-41` | Security — env var could disable validation in production |

**Total: 8 findings (6 P1, 2 P2)**

---

## Batch C — Code Quality and Abstractions

| # | Finding | Severity | File | Risk |
|---|---------|----------|------|------|
| 8 | CSP blocks Google Fonts — dashboard broken | P2 | `src/server.ts:42-44` | Functional bug — fonts fail silently in CSP browsers |
| 9 | Pipeline error messages forwarded to client via SSE | P2 | `src/api.ts:313-315` | Info leak — internal error details exposed |
| 11 | Unsafe cast of `req.body` in snooze handler | P2 | `src/follow-up-api.ts:71` | Input validation — destructuring throws on null body |
| 10 | No input length limits on edit and analyze | P2 | `src/api.ts:175-211,296-319` | Defense-in-depth — unbounded token usage |
| 12 | Duplicated `baseUrl()` utility across two files | P2 | `src/follow-up-scheduler.ts:12-14`, `src/twilio-webhook.ts:26-28` | DRY — 2-line function duplicated |
| 18 | `shapeLead` imported from peer `api.ts` — coupling | P2 | `src/follow-up-api.ts:4` | Coupling — route modules should share via data layer |
| 15 | Terminal-state functions inconsistent and nearly identical | P2 | `src/leads.ts:372-376,424-476` | Consolidation — 3 functions that differ by one string |
| 14 | Repeated ID-parse + lead-lookup boilerplate across 7 handlers | P2 | `src/follow-up-api.ts:16-136`, `src/api.ts:124-127,176-179,219-222` | DRY — same ~10-line pattern 7 times |
| 20 | Double database read in `updateLead` | P2 | `src/leads.ts:239-278` | Performance — 4+ SELECTs per transaction |
| 17 | `apiFetch`/`apiPost` duplicate auth-retry logic with inconsistency | P2 | `public/dashboard.html:1405-1455` | Consistency — auth retry behavior differs |
| 25 | Scheduler heartbeat log noisy (96 lines/day) | P3 | `src/follow-up-scheduler.ts:81` | Noise — reduce to daily or on-change |
| 28 | Magic number `3` in dashboard follow-up count | P3 | `public/dashboard.html:2344` | Readability — extract to named constant |
| 31 | `satisfies FollowUpActionResponse` used 12+ times | P3 | `src/follow-up-api.ts` | Clutter — remove redundant annotations |
| 34 | `analyzeKvHTML` passes raw HTML as value parameter | P3 | `public/dashboard.html:2149-2155` | Fragile — potential XSS vector |
| 36 | `retryFailures` map entries not bounded/cleaned up | P3 | `src/follow-up-scheduler.ts:9` | Memory — unbounded map growth |
| 32 | `SnoozeRequestBody` one-field type adds little value | P3 | `src/types.ts:244` | Simplification — inline the type |

**Total: 16 findings (10 P2, 6 P3)**

---

## Batch D — Deferred

| # | Finding | Severity | File | Why Deferred |
|---|---------|----------|------|-------------|
| 7 | `approveFollowUp` flow ambiguity — approved draft may never be sent | P2 | `src/leads.ts:382-418` | Needs product decision — "Approve" semantics unclear |
| 19 | Scheduler error SMS lacks rate limiting | P2 | `src/follow-up-scheduler.ts:62-63` | New feature — requires dedup/throttle logic |
| 21 | `listLeadsFiltered`/`listFollowUpLeads` use SELECT * with no pagination | P2 | `src/leads.ts:518-561` | Changes dashboard behavior — needs pagination UI |
| 13 | `leads.ts` is 700+ lines spanning 4+ responsibilities | P2 | `src/leads.ts:1-708` | Structural refactor — do before next feature, not mid-fix |
| 16 | Dashboard HTML monolith (2,474 lines) | P2 | `public/dashboard.html:1-2474` | Acceptable until 3,000 lines — no action now |
| 37 | SSE connection for `/api/analyze` has no timeout or abort handler | P3 | `src/api.ts:296-319` | New feature — needs abort controller wiring |
| 35 | Cookie session has no revocation mechanism (90-day TTL) | P3 | `src/auth.ts:5,95-105` | Needs product decision — session management strategy |
| 29 | `var` used throughout dashboard JS instead of `const`/`let` | P3 | `public/dashboard.html:1264-2471` | Large surface area — ~1,200 lines touched, separate PR |

**Total: 8 findings (5 P2, 3 P3)**
