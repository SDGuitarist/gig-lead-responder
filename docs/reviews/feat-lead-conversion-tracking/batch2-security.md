# Security Sentinel — Review Findings

**Agent:** compound-engineering:review:security-sentinel
**Branch:** feat/lead-conversion-tracking
**Date:** 2026-02-25
**Files reviewed:** 4 (src/types.ts, src/leads.ts, src/api.ts, public/dashboard.html)

## Positive Findings (no issues)

- **SQL Injection:** All SQL uses parameterized queries via `better-sqlite3` prepared statements. `UPDATE_ALLOWED_COLUMNS` whitelist prevents column name injection. CHECK constraints on outcome fields.
- **Hardcoded Secrets:** No API keys, tokens, or credentials in changed files.
- **Authentication Coverage:** All `/api/*` routes go through `basicAuth` middleware with `timingSafeEqual`.
- **XSS in Lead Data:** `esc()` function applied consistently to user-controlled strings in rendering.

## Findings

### [P1] XSS: `g.gate_status` injected into innerHTML without escaping
**File:** `public/dashboard.html:1997-1998`
**Issue:** The `analyzeKvHTML` function inserts its value argument directly into `innerHTML`. On line 1997-1998, `g.gate_status.toUpperCase()` is interpolated **without** calling `esc()`. The `gate_status` field comes from the `/api/analyze` SSE stream, which originates from LLM output parsed as JSON. If the pipeline ever produces a malformed `gate_status` containing HTML (due to prompt injection or parsing bug), it executes as DOM content.
**Suggestion:** Escape the value: `esc(g.gate_status).toUpperCase()`. Also consider escaping the label column in `analyzeKvHTML` as defense-in-depth.

---

### [P1] Missing body guard — `req.body` can be `undefined` when Content-Type header is absent
**File:** `src/api.ts:218-224`
**Issue:** When a request arrives without `Content-Type: application/json`, `express.json()` skips parsing and `req.body` is `undefined`. The destructuring on line 218 (`const { outcome, actual_price, outcome_reason } = req.body`) throws an unhandled exception, crashing the request and leaking a stack trace. The current validation checks handle `outcome: undefined` correctly when body IS parsed, but fail catastrophically when body is absent entirely.
**Suggestion:** Add an early guard: `if (!req.body || typeof req.body !== 'object') { res.status(400).json({ error: 'Request body must be JSON' }); return; }`.

---

### [P2] No security headers (no helmet, no CSP, no X-Frame-Options)
**File:** `src/server.ts:17-20`
**Issue:** The Express app sets no security headers: no Content-Security-Policy (inline scripts/styles unrestricted), no X-Frame-Options (dashboard can be iframed for clickjacking — user could be tricked into clicking "Approve & Send" or setting an outcome), no X-Content-Type-Options, no HSTS. Previously flagged in dashboard-ui-redesign review but remains unaddressed. Now higher risk because outcome endpoint allows state-changing actions.
**Suggestion:** Install `helmet` and add `app.use(helmet())`. At minimum, add `X-Frame-Options: DENY` and `X-Content-Type-Options: nosniff` manually.

---

### [P2] No CSRF protection on state-changing endpoints
**File:** `src/api.ts:200` (and lines 108, 162)
**Issue:** POST/PATCH endpoints rely solely on Basic Auth (sent automatically by the browser). No CSRF token. A malicious page can submit a `fetch()` or form POST and the browser attaches cached Basic Auth credentials. Combined with missing X-Frame-Options, an attacker could clickjack the dashboard or submit cross-origin requests to `/api/leads/:id/outcome`.
**Suggestion:** Short term: add a custom header check (`X-Requested-With` that `fetch` can set but forms cannot). Long term: switch to token-based auth or add CSRF token mechanism.

---

### [P2] Semantic mismatch allows inapplicable sub-fields without rejection
**File:** `src/api.ts:226-240`
**Issue:** Validation checks that `actual_price` and `outcome_reason` are valid *if provided*, but does not enforce that `actual_price` should only accompany `outcome: "booked"` or `outcome_reason` only `outcome: "lost"`. The storage layer silently drops inapplicable fields. An attacker probing the API receives no error for semantically invalid combinations, which violates fail-fast principles.
**Suggestion:** Reject `actual_price` when outcome is not `"booked"`, reject `outcome_reason` when outcome is not `"lost"`.

---

### [P3] `error_message` exposed in API response may leak internal details
**File:** `src/api.ts:55`
**Issue:** `shapeLead()` returns `lead.error_message` directly. This field contains pipeline errors which may include Anthropic API error messages, stack traces, or internal path information. Dashboard renders with `esc()` (no XSS), but information leakage risk.
**Suggestion:** Sanitize before returning — truncate to generic message or strip content after first newline and cap length.

---

### [P3] SMS error message forwarded to client
**File:** `src/api.ts:142-143`
**Issue:** When SMS fails, raw error from Twilio SDK is forwarded: `SMS failed: ${message}`. Could leak account SIDs, phone numbers, or API-specific error codes.
**Suggestion:** Log full error server-side, return generic message to client: `{ error: "SMS delivery failed. Please try again." }`.

---

### [P3] Basic Auth credentials stored in JavaScript variable in memory
**File:** `public/dashboard.html:1152,1221,1245`
**Issue:** `authHeader` variable stores Base64-encoded `user:pass` in a JavaScript closure for the page lifetime. If XSS is exploited (see P1 above), attacker can read `authHeader` and obtain credentials. Inherent to Basic Auth in browser context.
**Suggestion:** Consider migrating to cookie-based session auth with `HttpOnly` cookies, which would be immune to JavaScript-based credential extraction. At minimum, this increases the urgency of fixing the P1 XSS finding.

---

### [P3] `analyzeKvHTML` label values are not escaped
**File:** `public/dashboard.html:1947`
**Issue:** The label parameter `p[0]` is inserted into innerHTML without `esc()`. Currently all labels are hardcoded strings (safe today), but any future dynamic label would be an XSS vector.
**Suggestion:** Add `esc(p[0])` as defense-in-depth.

---

### [P3] `/api/analytics` has no rate limiting or result pagination
**File:** `src/leads.ts:304-378`
**Issue:** The analytics endpoint runs 3 SQL queries with no date filter, pagination, or rate limit. As leads grow, this creates a denial-of-service vector since `better-sqlite3` is synchronous on the main Node.js thread.
**Suggestion:** Add an index on `outcome` column and consider adding a `WHERE created_at >= ?` date filter parameter.
