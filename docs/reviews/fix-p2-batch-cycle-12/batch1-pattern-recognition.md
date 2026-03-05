# Pattern Recognition Specialist — Review Findings

**Agent:** pattern-recognition-specialist
**Branch:** fix/p2-batch-cycle-12
**Date:** 2026-03-05
**Files reviewed:** 21

## Summary

| Severity | Count |
|----------|-------|
| P1 | 1 |
| P2 | 5 |
| P3 | 4 |

## Findings

### [P1] `process.exit(1)` in `auth.ts` `getCookieSecret()` callable at request time
**File:** `src/auth.ts:15`
**Issue:** `getCookieSecret()` is lazy-initialized via `getSecret()`, called on every cookie verification. If `COOKIE_SECRET` is unset in production, the first authenticated request kills the process. Violates existing solution doc: "No `process.exit()` in request handlers — fatal config checks belong at startup."
**Suggestion:** Move COOKIE_SECRET validation to startup in `server.ts`, alongside the existing ANTHROPIC_API_KEY and DASHBOARD_USER/PASS checks. In `auth.ts`, replace `process.exit(1)` with `throw new Error()`.

---

### [P2] Triplicated `stmt()` caching function across db/ modules
**Files:** `src/db/leads.ts:10-24`, `src/db/follow-ups.ts:10-24`, `src/db/queries.ts:10-24`
**Issue:** Exact same 15-line `stmt()` function copy-pasted across all three db modules. "Keep in sync" comments indicate duplication that should be a shared function.
**Suggestion:** Extract a shared `createStmtCache()` factory into `src/db/stmt.ts`.

---

### [P2] Duplicated `baseUrl()` helper in two files
**Files:** `src/follow-up-scheduler.ts:13-15`, `src/twilio-webhook.ts:26-28`
**Issue:** Identical function reads `BASE_URL` env var and strips trailing slashes. If logic changes, two files need updating.
**Suggestion:** Move to `src/utils/base-url.ts` and import from both.

---

### [P2] Repeated "parse ID + validate lead exists" boilerplate across API routes
**Files:** `src/api.ts:51-61`, `src/api.ts:102-122`, `src/api.ts:149-159`, `src/follow-up-api.ts:21-23`, `src/follow-up-api.ts:40-41`
**Issue:** Five places do `parseInt(req.params.id) -> isNaN check -> getLead -> 404 check`. Duplicated validation pattern.
**Suggestion:** Extract a shared `withLead(req, res, fn)` helper or Express middleware.

---

### [P2] Triplicated LLM response validator preamble
**Files:** `src/pipeline/classify.ts:6`, `src/pipeline/generate.ts:21`, `src/pipeline/verify.ts:7`
**Issue:** All three validators start with identical guard: `if (typeof raw !== "object" || raw === null || Array.isArray(raw)) throw new Error("Expected JSON object from LLM")`.
**Suggestion:** Extract `assertJsonObject(raw: unknown)` helper into `src/utils/` or `src/claude.ts`.

---

### [P2] `new Date().toISOString()` scattered across 14 call sites with no shared clock
**Files:** 14 occurrences across `src/db/leads.ts`, `src/db/follow-ups.ts`, `src/post-pipeline.ts`, `src/api.ts`
**Issue:** Timestamp generation inlined everywhere. In transaction boundaries, multiple independent calls could yield different millisecond values. Makes test clock injection impossible.
**Suggestion:** Create a `now()` function in `src/utils/dates.ts`. In transactions, capture `const ts = now()` once and pass through.

---

### [P3] Naming convention: mixed camelCase/snake_case at module boundaries
**Files:** Throughout `src/types.ts`, `src/db/leads.ts`, `src/utils/shape-lead.ts`
**Issue:** snake_case for DB/API fields, camelCase for code — reasonable convention but a few inconsistencies exist (`gut_check_passed` as computed field, `StageEvent.ms` vs `stage`).
**Suggestion:** Document the naming convention rule to prevent future drift.

---

### [P3] `TERMINAL_CLEAR` constant defined but only partially used
**File:** `src/db/follow-ups.ts:83-87`
**Issue:** Used in `approveFollowUp` but not in `skipFollowUp` or `markClientReplied` which inline the same NULL assignments in SQL.
**Suggestion:** Use consistently or remove — current half-and-half state is worst option.

---

### [P3] Single-file dashboard HTML (~2400 lines) approaching maintenance limit
**File:** `public/dashboard.html`
**Issue:** Single HTML file with inline CSS and JS containing 15+ JS functions, 5 tab views, ~800 lines CSS. Approaching the point where modification requires significant scrolling.
**Suggestion:** No action needed now, but consider extracting CSS/JS as future cleanup.

---

### [P3] Circular dependency guard relies on comments, not tooling
**Files:** `src/db/leads.ts:2`, `src/db/follow-ups.ts:2`, `src/db/queries.ts:2`, `src/db/migrate.ts:2`
**Issue:** "NEVER import from ./index.js" comments are not enforced structurally. Future contributor could accidentally add the import.
**Suggestion:** Add ESLint `no-restricted-imports` rule to enforce this.

---

## Positive Patterns Observed

1. **Barrel re-export pattern** (`src/db/index.ts`) — clean separation with single public API surface
2. **Atomic claim pattern** — `claimLeadForSending()`, `claimFollowUpForSending()` with `RETURNING *` prevent race conditions
3. **Transaction safety with async guard** (`runTransaction`) — three-layer defense against SQLite async boundary bug
4. **Validation-before-mutation** in API routes — full validation before any DB write
5. **Fire-and-forget with double-fault handling** (`src/webhook.ts:135-149`)
6. **Follow-up state machine** (`src/db/follow-ups.ts:26-37`) — 5-state, 8-transition machine with explicit guards
