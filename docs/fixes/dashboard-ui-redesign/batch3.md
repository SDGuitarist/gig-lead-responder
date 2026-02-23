# Batch 3 — Code Quality and Abstractions Results

**Branch:** main
**Date:** 2026-02-22
**Commit:** 06d0ab4

### Prior Phase Risk

> "Yes, two things for Batch C: 1. **Finding #17 (move /api/analyze to api.ts)** is now done as part of #1. Batch C can skip it entirely. 2. **Finding #23 (CHECK constraint on status)** now needs to include `'sending'` in the allowed values if it's implemented."

Addressed: #17 skipped (already done). #23 CHECK constraint includes `'sending'`.

## Changes Made

### #5 — `shapeLead()` brittle mapper with unsafe casts
**File:** `src/types.ts:161-191` (new `LeadApiResponse` interface), `src/api.ts:3,22` (import + return type)
**What changed:** Added `LeadApiResponse` interface as the typed return for `shapeLead()`. Explicit `as string`/`as number` casts on JSON-parsed fields replace the implicit `unknown` flowing through. Compile-time errors now catch field drift between the API shape and the mapper.
**Review finding:** P2 — Manually maps 25+ fields with no named return type. Uses `as` casts on `safeJsonParse()` results without runtime validation.

---

### #10 — Full DOM rebuild on every row click
**File:** `public/dashboard.html:1241-1266` (rewritten `toggleDetail`), `1186,1232` (added `data-detail` attributes)
**What changed:** Rewrote `toggleDetail()` to use `querySelectorAll('[data-detail="N"]')` to collapse/expand specific panels instead of calling `renderTable()` + `renderMobile()`. Added `data-detail` attributes to the `.detail-panel` divs in both table and mobile renderers. Scroll position, textarea content, and focus are now preserved across toggles.
**Review finding:** P2 — Full DOM rebuild on every row click, approve, save, and cancel. User state (textarea content, scroll position, focus) is lost.

---

### #16 — `renderAnalyzeResults()` no null guards
**File:** `public/dashboard.html:1428-1433` (top-level guard), `1437` (stealth_premium_signals fallback)
**What changed:** Added an early return guard: if `data`, `data.classification`, `data.pricing`, `data.drafts`, or `data.gate` is missing, shows "Incomplete pipeline output" instead of throwing. Added `|| []` fallback on `stealth_premium_signals.join()` to prevent TypeError if the array is null.
**Review finding:** P2 — Accesses `data.classification`, `data.pricing`, `data.gate.gut_checks` without null checks.

---

### #20 — `leads.db` not in `.gitignore`
**File:** `.gitignore` (added `*.db`)
**What changed:** Added `*.db` glob to `.gitignore`. Any SQLite database file in the project root is now excluded from git tracking.
**Review finding:** P3 — `.gitignore` has `/data/` but `leads.db` in the project root is not ignored.

---

### #23 — Data layer: CHECK constraint, normalizeRow helper, indexes
**File:** `src/leads.ts:30` (CHECK), `src/leads.ts:46-47` (indexes), `src/leads.ts:74-78` (normalizeRow helper), `src/leads.ts:129,139,259` (replaced 3 copy-pasted conversions)
**What changed:** Added `CHECK(status IN ('received','sending','sent','done','failed'))` to the CREATE TABLE statement (enforced on new DBs). Added indexes on `event_date` and `confidence_score` for sort queries. Extracted `normalizeRow()` helper that converts SQLite 0/1 to boolean for `gate_passed` — replaced 3 identical inline conversions.
**Review finding:** P3 — Status column allows any string. `gate_passed` conversion copy-pasted in 4 functions. Sort columns lack indexes.

---

### #24 — Client-side constants drift risk
**File:** `public/dashboard.html:897-900` (4 SYNC comments)
**What changed:** Added `// SYNC:` comments above `FORMAT_NAMES`, `CHECK_NAMES`, and `STATUS_DISPLAY` noting the TypeScript source files they must stay in sync with. References `LeadApiResponse` in types.ts as the API contract.
**Review finding:** P3 — `FORMAT_NAMES` and `CHECK_NAMES` maps duplicate TypeScript-side constants with no shared source of truth.

---

### #28 — `apiPost` no 401 handling + SMS length warning
**File:** `public/dashboard.html:996-1017` (apiPost 401 retry), `src/api.ts:121-123` (SMS length warning)
**What changed:** Added 401 handling to `apiPost()` matching the pattern in `apiFetch()`: clears stale `authHeader`, prompts for credentials, retries the request. On the server side, added a `console.warn` when `compressed_draft` exceeds 1600 chars (SMS concatenation limit) before sending — logs the warning but doesn't block the send.
**Review finding:** P3 — `apiPost()` doesn't detect 401. `compressed_draft` sent to SMS with no length check.

---

## Considered but Rejected

- **#19 (Inline CSS/JS monolith)** — Extracting ~1400 lines of CSS/JS into separate files changes the deploy story (cache headers, static file serving, build step). Too large for this batch. Deferred to a dedicated session.
- **Blocking on SMS length** — Considered returning a 400 error when compressed_draft > 1600 chars, but that would prevent sending any message when the pipeline produces a slightly-long draft. A console warning is proportionate for a single-user tool.
- **Runtime validation on JSON-parsed fields** — The review suggested validating the `as` casts at runtime. Added the return type for compile-time safety but skipped Zod/runtime validation — the JSON is written by our own pipeline, not user input.

## Deferred to Later Batch

- **#19 (Inline CSS/JS monolith)** — deferred to a dedicated session (P3, large refactor)

## Three Questions

### 1. Hardest fix in this batch?

The targeted DOM toggle (#10). The original `toggleDetail()` was 3 lines calling `renderTable()` + `renderMobile()`. The replacement needs to: (a) collapse the previous panel, (b) find the lead data from the array, (c) expand the new panel, and (d) work for both table and mobile views via `data-detail` attributes. Had to add `data-detail` to the `.detail-panel` divs in both render functions so `querySelectorAll` can find them. The logic is still simple but touches 3 locations in the HTML template.

### 2. What did you consider fixing differently, and why didn't you?

Considered making `LeadApiResponse` the actual return of `shapeLead` by removing the `null` case and throwing on null input. But `shapeLead` is called from `leads.map(shapeLead)` in the list endpoint where null leads shouldn't happen (they come from the DB), and from single-lead endpoints where null is already guarded before calling. Changing the return type to non-nullable would require adjusting callers for no practical benefit.

### 3. Did anything in this batch change the scope or approach for the next batch?

No. Batch D findings (pagination, SSE timeout, security headers, rate limiting, CSRF, mobile card YAGNI, body size limit, error message leaking, credentials in JS) are all deferred items that need product decisions or new dependencies. Nothing in Batch C altered their scope.
