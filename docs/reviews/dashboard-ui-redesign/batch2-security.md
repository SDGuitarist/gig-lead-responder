# Security Sentinel — Review Findings

**Agent:** security-sentinel
**Branch:** main (commits ddb515d..d5b34fe)
**Date:** 2026-02-22
**Files reviewed:** 6

## Findings

### [P1] Unauthenticated `/api/analyze` endpoint triggers paid API calls

**File:** `src/server.ts:51`
**Issue:** `POST /api/analyze` has zero authentication. It is mounted directly on the Express app outside any auth-protected router. Anyone who discovers the URL can send arbitrary text and trigger the full `runPipeline()` call chain, which makes multiple Anthropic Claude API calls. This is a direct financial attack vector.
**Suggestion:** Add `basicAuth` middleware: `app.post("/api/analyze", basicAuth, async (req, res) => { ... });` or move the route into `api.ts`.

---

### [P1] Client-side `runAnalyze()` bypasses authentication entirely

**File:** `public/dashboard.html:1491-1494`
**Issue:** `runAnalyze()` uses raw `fetch('/api/analyze', ...)` without the `Authorization` header. Every other API call goes through `apiFetch()` or `apiPost()` which attach `authHeader`. Once auth is added server-side, the client will always fail to authenticate.
**Suggestion:** Include the `authHeader` in the fetch call and add 401-handling logic similar to `apiFetch()`.

---

### [P2] Password comparison uses `===` instead of timing-safe comparison

**File:** `src/auth.ts:23`
**Issue:** String comparison with `===` short-circuits on the first mismatched character, leaking timing information. An attacker can statistically determine the correct password character-by-character. The webhook file (`src/webhook.ts:30`) already uses `timingSafeEqual`, showing the team knows the pattern.
**Suggestion:** Use `crypto.timingSafeEqual` from Node.js with a `safeCompare` helper that handles different-length strings.

---

### [P2] Basic Auth parser breaks on passwords containing colons

**File:** `src/auth.ts:21`
**Issue:** `decoded.split(":")` splits on ALL colons. Per RFC 7617, the password MAY contain colons. A password like `my:secret:pass` would be truncated to `"secret"`, causing auth to always fail — a denial-of-service against legitimate users with colons in passwords.
**Suggestion:** Use `indexOf(":")` and `slice()` instead of `split(":")`.

---

### [P2] Auth bypass when `DASHBOARD_USER` / `DASHBOARD_PASS` are unset

**File:** `src/auth.ts:8-11`
**Issue:** When env vars are not set, `basicAuth` calls `next()` unconditionally — the entire dashboard and all API endpoints become publicly accessible. If Railway deployment loses these env vars, everything including approve/send-SMS actions becomes open.
**Suggestion:** In production, refuse to serve or log a prominent startup warning. Add `NODE_ENV` check.

---

### [P2] No rate limiting on any endpoint

**File:** `src/server.ts` (entire file)
**Issue:** No rate limiting middleware anywhere. Attack vectors: `/api/analyze` (financial drain via Anthropic), `/api/leads/:id/approve` (SMS bombing via Twilio), `/webhook/*` (database fill), Basic Auth endpoints (brute-force).
**Suggestion:** Install `express-rate-limit` with per-endpoint limits.

---

### [P2] No security headers (CORS, CSP, X-Frame-Options, etc.)

**File:** `src/server.ts` (entire file)
**Issue:** Zero security headers set. Vulnerable to clickjacking (no X-Frame-Options), MIME sniffing, XSS amplification (no CSP), and cross-origin attacks (no CORS config). Basic Auth credentials are cached by the browser and sent automatically to any origin.
**Suggestion:** Install and configure `helmet` with appropriate CSP directives for inline script/style and Google Fonts.

---

### [P2] SSE endpoint has no connection timeout or payload size limit

**File:** `src/server.ts:51-75`
**Issue:** No timeout on the HTTP connection. No limit on the `text` field size (`express.json()` defaults to 100KB). An attacker can open many simultaneous SSE connections, each holding a Node.js connection open and an active Anthropic API request.
**Suggestion:** Add a 120s timeout, input length limit (10KB), and concurrency semaphore.

---

### [P2] Error messages in SSE may leak internal details

**File:** `src/server.ts:69-71`
**Issue:** The full `err.message` is sent to the client via SSE. If the error originates from the Anthropic SDK or database layer, this could leak API key prefixes, file paths, or schema details. Same pattern in `src/api.ts:125-126`.
**Suggestion:** Send generic error messages to the client, log full errors server-side.

---

### [P3] No CSRF protection on state-changing endpoints

**File:** `src/api.ts:99`, `src/api.ts:141`
**Issue:** `POST /api/leads/:id/approve` and `POST /api/leads/:id/edit` rely solely on Basic Auth. A malicious website can craft a fetch to the app and the browser will include cached Basic Auth credentials. Practical risk is low (attacker needs valid lead ID), but "approve" sends a real SMS.
**Suggestion:** Add `Origin`/`Referer` header check on state-changing endpoints, or migrate to session-based auth.

---

### [P3] Credentials stored in JavaScript variable, visible in memory

**File:** `public/dashboard.html:936`, `public/dashboard.html:985`
**Issue:** `authHeader` stores Base64-encoded username:password in a global JS variable for the page lifetime. DevTools console can read and decode it. `prompt()` dialogs display password in cleartext.
**Suggestion:** Acceptable for single-user internal tool. For better security, switch to session-based auth with HttpOnly cookies.

---

### [P3] `express.json()` has no explicit body size limit

**File:** `src/server.ts:20`
**Issue:** Defaults to 100KB which may be too generous for `/api/analyze` where only a few KB of lead text is needed.
**Suggestion:** Set explicit limits: `express.json({ limit: "50kb" })`.

---

### [P3] `leads.db` not in `.gitignore`

**File:** `leads.db` (project root, per git status)
**Issue:** `.gitignore` has `/data/` but a `leads.db` in the project root would NOT be ignored. If committed, it exposes all lead data (client names, event details, contact info, raw emails) in git history.
**Suggestion:** Add `*.db` to `.gitignore`.

---

### [P3] Static file serving with no access controls

**File:** `src/server.ts:22`
**Issue:** `express.static` serves everything in `public/` without authentication, including the dashboard HTML with full client-side logic, API endpoint paths, and auth flow details. This information helps attackers understand the API surface.
**Suggestion:** Acceptable for the dashboard entry point. Be careful about what other files end up in `public/`.

---

## Summary

| Severity | Count | Key themes |
|----------|-------|------------|
| P1 | 2 | Unauthenticated API endpoint; client-side auth bypass |
| P2 | 7 | Timing-unsafe password comparison; colon-in-password bug; auth bypass on missing env vars; no rate limiting; no security headers; SSE abuse; error leakage |
| P3 | 5 | No CSRF; credentials in JS memory; no body size limit; leads.db not gitignored; public static serving |
