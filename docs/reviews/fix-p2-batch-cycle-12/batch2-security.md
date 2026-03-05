# Security Sentinel — Review Findings

**Agent:** security-sentinel
**Branch:** fix/p2-batch-cycle-12
**Date:** 2026-03-05
**Files reviewed:** 21

## Severity Snapshot

| Priority | Count |
|----------|-------|
| P1 | 0 |
| P2 | 5 |
| P3 | 7 |

## Findings

### [P2] Dashboard HTML served without authentication
**File:** `src/server.ts:71-74`
**Issue:** The `/dashboard.html` route and `express.static` middleware (line 77) serve the HTML file without `sessionAuth`. Full client-side code, markup structure, API endpoints, request shapes, and CSRF header requirements are exposed to unauthenticated users.
**Suggestion:** Wrap the `dashboard.html` route behind `sessionAuth`.

---

### [P2] No rate limiting on webhook endpoints (Mailgun + Twilio)
**Files:** `src/webhook.ts:42`, `src/twilio-webhook.ts:220`
**Issue:** Neither webhook endpoint has rate limiting. Each Mailgun webhook hit triggers the full LLM pipeline (multiple Claude API calls), making it expensive to process. A DoS using replayed valid signatures within the 5-minute window could exhaust resources.
**Suggestion:** Add rate limiter to both webhook routes (e.g., 30 requests per 15 minutes).

---

### [P2] XSS footgun in analyzeKvHTML raw flag pattern
**File:** `public/dashboard.html:2155-2220`
**Issue:** `analyzeKvHTML` accepts a third tuple element to skip escaping. Currently safe — all user/LLM data passes through `esc()`. But the raw flag pattern is a footgun; one wrong `true` argument on user-influenced data creates stored XSS.
**Suggestion:** Remove the raw-HTML flag from `analyzeKvHTML`. Construct special HTML cases separately.

---

### [P2] Phone number logged in plaintext on unknown sender
**File:** `src/twilio-webhook.ts:233`
**Issue:** Full `From` number logged when SMS arrives from unknown number. PII leak in production log storage.
**Suggestion:** Log only last 4 digits: `***${from.slice(-4)}`.

---

### [P2] Missing explicit body size limit on urlencoded parsing
**File:** `src/server.ts:41-42`
**Issue:** `express.urlencoded({ extended: false })` has no explicit `limit` set. Relies on Express default (100kb). Mailgun webhooks send urlencoded email bodies that could be large. Implicit rather than explicit security boundary.
**Suggestion:** Set explicit limit: `express.urlencoded({ extended: false, limit: "100kb" })`.

---

### [P3] `process.exit(1)` in lazy-initialized `getCookieSecret()` callable at request time
**Files:** `src/auth.ts:14-15`
**Issue:** Lazy evaluation means `process.exit()` can be called during a request if COOKIE_SECRET is unset. Should be caught at startup.
**Suggestion:** Call `getSecret()` eagerly at server startup before `app.listen()`.

---

### [P3] Basic Auth credentials stored in browser memory via `authHeader` variable
**File:** `public/dashboard.html:1408-1430`
**Issue:** `authHeader` retains raw Base64 credentials for page lifetime, sent on every API call even after session cookie is set.
**Suggestion:** Clear `authHeader = null` after first successful API call that sets session cookie.

---

### [P3] No Mailgun webhook token replay protection within validity window
**File:** `src/webhook.ts:42-77`
**Issue:** Validates timestamp freshness and HMAC signature but doesn't track seen tokens. Replay within 5-minute window triggers wasted pipeline runs. Functional impact limited by `processed_emails` dedup.
**Suggestion:** Store seen Mailgun tokens in time-bounded set and reject duplicates.

---

### [P3] `trust proxy` set to 1 without env var configuration
**File:** `src/server.ts:39`
**Issue:** Hardcoded proxy hop count. Infrastructure changes (e.g., adding Cloudflare) could allow IP spoofing.
**Suggestion:** Consider reading from `TRUST_PROXY_HOPS` env var.

---

### [P3] No request body validation on Twilio webhook fields
**File:** `src/twilio-webhook.ts:228-229`
**Issue:** `Body` and `From` fields cast directly with `as string`. No type check before `.trim()`. Malformed payload could throw.
**Suggestion:** Add `typeof req.body.Body === "string"` guard.

---

### [P3] Contact phone number hardcoded in source code
**File:** `src/pipeline/generate.ts:18`
**Issue:** Personal phone number `(619) 755-3246` hardcoded in `CONTACT_BLOCK`. Appears in git history and code review tools.
**Suggestion:** Move to environment variable with dev fallback.

---

### [P3] Venue name logged in console warnings (PII in logs)
**Files:** `src/venue-lookup.ts:47,66`, `src/db/leads.ts:45`
**Issue:** Venue names (potentially client-provided) logged in plaintext. Low priority for single-user app.
**Suggestion:** Note for future multi-tenant considerations.

---

## Security Checklist

- [x] SQL parameterization (better-sqlite3 prepared statements, UPDATE_ALLOWED_COLUMNS whitelist)
- [x] XSS protection (`esc()` helper, CSP with nonces)
- [x] HTTPS enforced (HSTS header)
- [x] CSRF protection (X-Requested-With custom header check)
- [x] Security headers (X-Frame-Options, X-Content-Type-Options, CSP, Referrer-Policy, Permissions-Policy)
- [x] Cookie security (HMAC-SHA256 signing, constant-time comparison, httpOnly/secure/sameSite)
- [x] Webhook signature validation (Mailgun HMAC, Twilio signature)
- [x] Atomic DB operations (claim patterns prevent race conditions)
- [ ] Rate limiting on webhooks
- [ ] Dashboard auth on static serving
- [ ] npm audit for dependency vulnerabilities (not checked)
