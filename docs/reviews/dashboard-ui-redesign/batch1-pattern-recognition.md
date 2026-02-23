# Pattern Recognition Specialist — Review Findings

**Agent:** pattern-recognition-specialist
**Branch:** main (commits ddb515d..d5b34fe)
**Date:** 2026-02-22
**Files reviewed:** 6

## Findings

### [P2] Duplicated lead-shaping logic between old dashboard and new API

**File:** `src/dashboard.ts:72-113` vs `src/api.ts:22-72`
**Issue:** Both routers read the same `LeadRecord` from the database and transform it for display through completely different code paths. The old `dashboard.ts` reads fields directly in HTML template strings. The new `api.ts` parses JSON columns and flattens them into a response object. Two independently maintained views of "what a lead looks like" exist.
**Suggestion:** If old dashboard is kept, extract `shapeLead()` into a shared module. If deprecated, remove `dashboard.ts` entirely.

---

### [P2] `gate_passed` boolean coercion duplicated four times in leads.ts

**File:** `src/leads.ts:123,133,217,255`
**Issue:** Every function that reads rows applies the same `gate_passed: r.gate_passed === null ? null : Boolean(r.gate_passed)` transformation. Four copies of the same one-liner.
**Suggestion:** Extract a `normalizeRow(row: LeadRecord): LeadRecord` helper.

---

### [P2] `/api/analyze` endpoint has no authentication

**File:** `src/server.ts:51`
**Issue:** `POST /api/analyze` triggers Anthropic API calls that cost real money, but has no auth middleware. All other API routes are protected.
**Suggestion:** Add `basicAuth` middleware to the route. Also update client-side `runAnalyze()` to include credentials.

---

### [P2] Full table re-render on every interaction

**File:** `public/dashboard.html:1240-1248`
**Issue:** `toggleDetail()` calls both `renderTable(currentLeads)` and `renderMobile(currentLeads)`, rebuilding the entire DOM on every row click, approve, save, or cancel. In-progress user state (text selection, scroll position) is lost.
**Suggestion:** For current scale this is acceptable. Consider targeted DOM updates (toggle `.open` class on specific panel) if the dashboard grows.

---

### [P2] `apiPost()` does not handle 401 with auth retry like `apiFetch()` does

**File:** `public/dashboard.html:995-1011`
**Issue:** `apiFetch()` detects 401 and prompts for credentials. `apiPost()` does not — it simply rejects. Approve and edit actions will fail with generic "API error 401" instead of prompting for login.
**Suggestion:** Extract 401-handling logic into a shared wrapper that both functions call.

---

### [P2] `runAnalyze()` bypasses `apiPost()` and sends unauthenticated requests

**File:** `public/dashboard.html:1491-1494`
**Issue:** `runAnalyze()` uses raw `fetch('/api/analyze', ...)` without the `authHeader`. Every other API call goes through `apiFetch()` or `apiPost()`. Once auth is added to `/api/analyze`, this call will always fail for authenticated users.
**Suggestion:** Use an auth-aware fetch variant that returns the raw response for SSE streaming but still includes the `Authorization` header.

---

### [P3] Naming inconsistency: `pending` vs `received` status across client and server

**File:** `public/dashboard.html:908,930`
**Issue:** The database stores initial status as `"received"`. The client uses `"pending"` for display. The stats API returns `pending`. The API filter parameter uses `received`. The mapping works but requires mental translation.
**Suggestion:** Document the mapping with a comment in `api.ts` near `VALID_STATUSES`.

---

### [P3] `esc()` function duplicated with different implementations

**File:** `src/dashboard.ts:12-15` vs `public/dashboard.html:942-947`
**Issue:** Two HTML-escaping functions with different implementations (server: regex-based, client: DOM-based). Both are correct for their contexts. Name collision can confuse codebase searches.
**Suggestion:** Resolves itself if old dashboard is removed.

---

### [P3] `shapeLead()` non-null assertion on `updateLead` return value

**File:** `src/api.ts:136,165`
**Issue:** Both approve and edit handlers use `shapeLead(updated!)` with a non-null assertion. The `!` suppresses the type checker rather than handling the edge case.
**Suggestion:** Replace with explicit null check and 404/500 response.

---

### [P3] Inline `POST /api/analyze` handler in server.ts breaks router separation pattern

**File:** `src/server.ts:51-75`
**Issue:** All other route groups are in dedicated router modules, but `/api/analyze` is defined inline in `server.ts`. Breaks the mounting-only pattern.
**Suggestion:** Move into `api.ts` or a dedicated `src/analyze.ts`.

---

### [P3] Client-side global state managed through closure variables

**File:** `public/dashboard.html:934-938`
**Issue:** Five closure variables (`activeFilter`, `activeSort`, `authHeader`, `currentLeads`, `expandedId`) mutated from many places. Any function can silently mutate shared state.
**Suggestion:** For current size, acceptable. If SPA grows, consolidate into a single `state` object with a `setState()` function.

---

### [P3] `parseInt(req.params.id, 10)` / ID validation duplicated in two handlers

**File:** `src/api.ts:100-104,142-146`
**Issue:** Identical ID parsing and validation code in both `approve` and `edit` handlers. Adding more `:id` endpoints will compound the duplication.
**Suggestion:** Extract a `parseLeadId(req, res)` helper or Express param middleware.

---

### [P3] CSS for `.edit-textarea` and `.analyze-textarea` are near-identical

**File:** `public/dashboard.html:534-552,599-617`
**Issue:** Two CSS blocks with nearly identical styles. The only difference is `min-height: 200px` vs `min-height: 140px`.
**Suggestion:** Create a shared `.app-textarea` base class with size modifier classes.

---

### [P3] `analyze-draft-box` and `draft-box` CSS classes are identical

**File:** `public/dashboard.html:341-360,711-731`
**Issue:** Two CSS blocks with identical properties. The child `h4` styles are also duplicated.
**Suggestion:** Reuse `.draft-box` for both contexts, eliminating `.analyze-draft-box`.

---

## Summary

| Severity | Count | Key Themes |
|---|---|---|
| P2 | 6 | Duplicated data shaping, missing auth, inconsistent auth handling in client, full re-render |
| P3 | 8 | CSS duplication, naming inconsistency, code duplication, non-null assertions |
