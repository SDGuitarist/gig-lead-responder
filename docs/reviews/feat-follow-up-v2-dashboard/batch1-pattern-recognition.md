# Pattern Recognition Specialist — Review Findings

**Agent:** pattern-recognition-specialist
**Branch:** feat/follow-up-v2-dashboard
**Date:** 2026-03-02
**Files reviewed:** 11

## Findings

### [P1] Duplicated `baseUrl()` function across two files
**File:** `src/follow-up-scheduler.ts:12` and `src/twilio-webhook.ts:26`
**Issue:** The exact same function appears in two separate files. If the logic for constructing the base URL changes, both files must be updated in lockstep.
**Suggestion:** Extract `baseUrl()` into a shared utility file (e.g., `src/config.ts`) and import from both consumers.

---

### [P1] `leads.ts` is a God Object — data access, business logic, and state machine in one 700-line file
**File:** `src/leads.ts:1-708`
**Issue:** This single file handles: database init/migrations, CRUD operations, email idempotency, the entire follow-up state machine, dashboard query helpers, outcome tracking, and analytics queries — 6+ distinct responsibilities.
**Suggestion:** Future incremental refactor into `src/db.ts` (migrations), `src/leads.ts` (CRUD), `src/follow-up-state.ts` (state machine), `src/analytics.ts` (queries). Not urgent but the biggest architectural risk for maintainability.

---

### [P2] Repeated ID-parsing and lead-lookup boilerplate across 7 route handlers
**File:** `src/api.ts:124-127,176-179,219-222` and `src/follow-up-api.ts:17-20,41-44,65-68,117-120`
**Issue:** Same ~8-line pattern repeated 7 times across both API files.
**Suggestion:** Extract a `parseLeadId` helper function.

---

### [P2] `TERMINAL_CLEAR` not used in `skipFollowUp` and `markClientReplied`
**File:** `src/leads.ts:372-376,428-430,467-469`
**Issue:** The constant exists to prevent inconsistency, but 2 of 3 terminal-state functions duplicate the same field clears in raw SQL.
**Suggestion:** Use `TERMINAL_CLEAR` consistently or remove it.

---

### [P2] Nearly identical follow-up route handlers
**File:** `src/follow-up-api.ts:16-136`
**Issue:** The four handlers (approve, skip, snooze, replied) share the same structural pattern. Approve, skip, and replied are structurally identical down to error messages.
**Suggestion:** Consider a table-driven approach or helper that takes the action function as a parameter.

---

### [P2] `dashboard.html` is a 2,474-line monolith mixing CSS, HTML, and JavaScript
**File:** `public/dashboard.html:1-2474`
**Issue:** ~1,081 lines CSS, ~180 lines HTML, ~1,200 lines JS in one file. Changes to styling, markup, and behavior all require editing the same file.
**Suggestion:** Future split into `dashboard.css`, `dashboard.js`, and `dashboard.html` (markup only).

---

### [P2] `apiFetch` and `apiPost` duplicate the 401-retry-with-credentials logic
**File:** `public/dashboard.html:1405-1455`
**Issue:** Both functions independently implement the same retry-on-401 pattern with a minor inconsistency: `apiFetch` only retries when `authHeader === null`, but `apiPost` retries unconditionally on 401.
**Suggestion:** Extract the 401-handling into a shared wrapper function.

---

### [P3] `_req` parameter prefix inconsistency
**File:** `src/api.ts:96,98`
**Issue:** `_req` is prefixed as unused but is actually used (`_req.query.follow_up`). Breaks the "underscore = unused" convention.
**Suggestion:** Rename to `req`.

---

### [P3] Magic number `90` repeated for cookie/snooze max-days
**File:** `src/auth.ts:7` and `src/follow-up-api.ts:93`
**Issue:** The number `90` appears in two unrelated contexts (cookie lifetime vs snooze limit) without named constants in both places.
**Suggestion:** Extract `MAX_SNOOZE_DAYS = 90` in `follow-up-api.ts`.

---

### [P3] `sendSms` asymmetric error handling in scheduler
**File:** `src/follow-up-scheduler.ts:63`
**Issue:** After a failed claim on line 43, the `continue` skips any retry tracking. A comment explaining why would help future readers.
**Suggestion:** Add a comment on line 44 explaining that claim failure means another process intervened.

---

### [P3] `var` used throughout dashboard JavaScript instead of `const`/`let`
**File:** `public/dashboard.html:1264-2471`
**Issue:** All variable declarations use `var` despite targeting modern browsers.
**Suggestion:** Future cleanup pass to convert to `const`/`let`.

---

## Positive Patterns Observed

1. **Atomic claim pattern** — `claimLeadForSending` and `claimFollowUpForSending` use single-statement SQL UPDATEs with WHERE guards.
2. **Transaction wrapper** — `runTransaction` wraps better-sqlite3's transaction API cleanly.
3. **Shared business functions** — State machine functions shared between SMS webhook and dashboard API.
4. **Column whitelist** — `UPDATE_ALLOWED_COLUMNS` prevents SQL injection via dynamic key injection.
5. **CSRF guard** — `csrfGuard` using `X-Requested-With` header correctly protects cookie-authenticated POST requests.
6. **Rate limiting** — Separate limiters per endpoint with factory pattern.
7. **SYNC comments** — Lightweight coupling flags across files.
