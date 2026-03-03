# Batch D — Deferred Results

**Branch:** feat/follow-up-v2-dashboard
**Date:** 2026-03-02
**Commit:** N/A — documentation only, no code changes

### Prior Phase Risk

> "Did anything in this batch change the scope or approach for the next batch? No — all changes are additive guards and fixes. The 5 deferred structural refactors (#14, #15, #18, #20) would benefit from being tackled together in a dedicated refactoring session rather than piecemeal in Batch D."

Accepted. Batch D documents all deferred findings with rationale — no code changes made. Structural refactors from Batch C's deferred list are noted below as future work.

---

## Deferred Findings

### #7 — `approveFollowUp` flow ambiguity (P2)
**File:** `src/leads.ts:382-418`
**Issue:** Approved draft may never be sent if the scheduler doesn't pick it up. The "Approve" button semantics are unclear — does it mean "approve and send now" or "approve for next scheduled run"?
**Why deferred:** Needs product decision. Current behavior works (scheduler picks up approved drafts on next tick), but the UX promise is ambiguous.
**Recommended next step:** Decide whether "Approve" should trigger immediate send or remain scheduler-dependent. If immediate, add a `sendNow` flag to the approve endpoint.

---

### #19 — Scheduler error SMS lacks rate limiting (P2)
**File:** `src/follow-up-scheduler.ts:62-63`
**Issue:** If Twilio fails repeatedly, the scheduler retries on every tick with no dedup or throttle. Could send duplicate error-notification SMS to the admin.
**Why deferred:** New feature requiring dedup/throttle logic (e.g., "only notify once per lead per hour"). The in-memory retry map (fixed in Batch B, #4) limits retries to 3, which caps the blast radius for now.
**Recommended next step:** Add a `lastNotifiedAt` timestamp per lead to the retry map. Skip notification if within cooldown window.

---

### #21 — SELECT * with no pagination (P2)
**File:** `src/leads.ts:518-561`
**Issue:** `listLeadsFiltered` and `listFollowUpLeads` return all rows. At scale, this will slow the dashboard and increase memory usage.
**Why deferred:** Pagination changes dashboard behavior — the frontend needs a pagination UI, infinite scroll, or "load more" button. Can't change the backend without the frontend work.
**Recommended next step:** Add `LIMIT/OFFSET` to queries + a `?page=` param to API routes. Build pagination controls in dashboard. Target: when lead count exceeds ~200.

---

### #13 — `leads.ts` is 700+ lines spanning 4+ responsibilities (P2)
**File:** `src/leads.ts:1-708`
**Issue:** Single file handles schema migration, CRUD operations, follow-up state machine, and query helpers. Hard to navigate and test in isolation.
**Why deferred:** Structural refactor that should be done before the next feature, not mid-fix. Batch C also deferred 4 related structural findings (#14 boilerplate, #15 terminal-state consolidation, #18 shapeLead coupling, #20 double-read) that should be tackled together.
**Recommended next step:** Split into `src/db/migrate.ts`, `src/db/leads.ts` (CRUD), `src/db/follow-ups.ts` (state machine). Do as a dedicated refactoring PR with no feature changes.

---

### #16 — Dashboard HTML monolith (2,474 lines) (P2)
**File:** `public/dashboard.html:1-2474`
**Issue:** Single HTML file with inline CSS and JS. Hard to navigate, no code splitting.
**Why deferred:** Acceptable until ~3,000 lines. The dashboard is a single-page app with no build step — splitting requires introducing a bundler or switching to a framework, which is a project-level decision.
**Recommended next step:** Monitor line count. When approaching 3,000, extract JS into `public/dashboard.js` and CSS into `public/dashboard.css` as a first step (no bundler needed).

---

### #37 — SSE connection has no timeout or abort handler (P3)
**File:** `src/api.ts:296-319`
**Issue:** The `/api/analyze` SSE endpoint streams until the LLM finishes. If the client disconnects, the server-side stream continues processing. No AbortController wired to `req.on('close')`.
**Why deferred:** New feature requiring abort controller wiring through the pipeline. The current risk is wasted compute on disconnected clients, not data corruption.
**Recommended next step:** Pass an `AbortSignal` from `req.on('close')` through to the Claude API call. Low priority until usage scales.

---

### #35 — Cookie session has no revocation mechanism (P3)
**File:** `src/auth.ts:5,95-105`
**Issue:** Sessions last 90 days with no server-side revocation. If a session is compromised, there's no way to invalidate it without changing the COOKIE_SECRET (which invalidates ALL sessions).
**Why deferred:** Needs product decision on session management strategy. For a single-user admin dashboard, the risk is low. The 90-day TTL is the only expiration mechanism.
**Recommended next step:** If multi-user access is added, implement a session store (SQLite table) with per-session revocation. For single-user, consider reducing TTL to 7-14 days.

---

### #29 — `var` used throughout dashboard JS (P3)
**File:** `public/dashboard.html:1264-2471`
**Issue:** ~1,200 lines of JS using `var` instead of `const`/`let`. No block scoping, potential for hoisting bugs.
**Why deferred:** Large surface area (~200+ `var` declarations). Mechanical change but high risk of introducing bugs if done hastily. Should be a separate PR with careful testing.
**Recommended next step:** Run a find-and-replace in a dedicated PR. Convert `var` to `const` by default, `let` only where reassigned. Test every dashboard interaction after.

---

## Also Deferred from Batch C

These structural refactors were deferred from Batch C and are related to #13 above:

- **#14** — Repeated ID-parse + lead-lookup boilerplate (7 handlers)
- **#15** — Terminal-state functions nearly identical (3 functions, 1-string diff)
- **#18** — `shapeLead` imported from peer `api.ts` (coupling)
- **#20** — Double database read in `updateLead`

All four should be tackled together with #13 in a dedicated refactoring PR.

## Three Questions

### 1. Hardest fix in this batch?

No code fixes — the hardest judgment was confirming that all 8 findings genuinely belong in "deferred" rather than sneaking in a quick fix. #37 (SSE abort) and #29 (var→const) are both mechanically simple, but both have blast radius that doesn't belong in a fix phase. The abort controller needs to thread through the pipeline, and var→const touches 200+ declarations in a file with no tests.

### 2. What did you consider fixing differently, and why didn't you?

Considered doing the `var`→`const`/`let` conversion (#29) since it's mechanical. Rejected because: (a) 200+ changes in a 2,474-line file with no automated tests means manual verification of every dashboard interaction, (b) Batch C already touched dashboard.html for auth retry and magic number fixes — more changes in the same file increases merge conflict risk, and (c) the plan explicitly deferred it as "separate PR."

### 3. Did anything in this batch change the scope or approach for the next batch?

N/A — this is the last batch. For the close step: 30 findings were fixed across batches A-C, 8 are documented as deferred here. The structural refactoring cluster (#13, #14, #15, #18, #20) should be the first work item after the compound phase. The product-decision items (#7 approve semantics, #35 session revocation) should be discussed before the next feature.
