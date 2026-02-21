# Security Sentinel — Review Findings

**Agent:** compound-engineering:review:security-sentinel
**Branch:** main
**Date:** 2026-02-20
**Files reviewed:** 5 (+ full src/ directory security scan)

## Findings

### [P2] DISABLE_MAILGUN_VALIDATION bypass allows unauthenticated webhook forgery
**File:** `src/webhook.ts:63`
**Issue:** When `DISABLE_MAILGUN_VALIDATION=true`, any attacker who knows the `/webhook/mailgun` endpoint can inject fake leads. This triggers the full AI pipeline (burning Anthropic API credits) and sends SMS alerts. This is a denial-of-wallet and spam vector. Same concern applies to `DISABLE_TWILIO_VALIDATION` in `src/twilio-webhook.ts:36`, though the `ALEX_PHONE` check limits blast radius.
**Suggestion:** (1) Add a startup warning that logs ONCE when escape hatch is active. (2) Consider time-bounded auto-disable (`DISABLE_MAILGUN_VALIDATION_UNTIL` timestamp). (3) Add rate limiting to the webhook endpoint.

---

### [P2] SQL injection via dynamic column names in updateLead
**File:** `src/leads.ts:152`
**Issue:** `updateLead` interpolates column names directly into SQL via `setClauses.push(\`${key} = @${key}\`)`. Currently all callers pass hardcoded field objects, so not externally exploitable today. But the function signature accepts any object keys — if a future API endpoint passes user-controlled keys, this becomes a SQL injection vector.
**Suggestion:** Add a column whitelist check at the top of the function. Throw if a key is not in the allowed set.

---

### [P3] No timestamp replay protection on Mailgun webhook
**File:** `src/webhook.ts:25-47`
**Issue:** The HMAC is validated correctly, but the timestamp is never checked for freshness. Mailgun recommends rejecting requests older than ~5 minutes. If an attacker captures a valid webhook request, they can replay it indefinitely. The `external_id` idempotency check mitigates exact replays, but not replays of different valid requests.
**Suggestion:** Add a timestamp freshness check: reject if age > 300 seconds.

---

### [P3] Dashboard authentication silently disabled when env vars missing
**File:** `src/dashboard.ts:13-17`
**Issue:** If `DASHBOARD_USER` or `DASHBOARD_PASS` are not set, the entire `/leads` dashboard is publicly accessible without authentication. The dashboard exposes lead records, client names, raw email content, AI drafts, and pricing.
**Suggestion:** Require these env vars in production (check `NODE_ENV=production`) and refuse to start without them, or log a loud startup warning.

---

### [P3] No rate limiting on any endpoint
**File:** `src/server.ts` (entire file)
**Issue:** No rate limiting middleware. The `/webhook/mailgun`, `/webhook/twilio`, and `/api/analyze` endpoints are public-facing. An attacker can flood `/api/analyze` to burn API credits, flood webhooks to spam the DB, or brute-force Basic Auth.
**Suggestion:** Install `express-rate-limit` with sensible limits per endpoint.

---

### [P3] No security headers (missing Helmet or equivalent)
**File:** `src/server.ts`
**Issue:** No security headers set (CSP, X-Frame-Options, X-Content-Type-Options, HSTS). The dashboard renders inline HTML without CSP protection.
**Suggestion:** Install `helmet` middleware.

---

### [P3] innerHTML used with pipeline output in frontend
**File:** `public/index.html:224,237,249`
**Issue:** The `kvHTML` function constructs HTML from Claude API output (classification and gate values) and sets it via `innerHTML` without escaping. This is a stored XSS vector if Claude returns HTML/script tags (e.g., from prompt injection in lead email). Risk is low since data comes from Claude, not direct user input, and only Alex views the dashboard.
**Suggestion:** Add an `escapeHtml()` function to sanitize values in `kvHTML`.

---

### [P3] Basic Auth credential comparison vulnerable to timing attacks
**File:** `src/dashboard.ts:29`
**Issue:** Uses `===` for password comparison, which leaks timing information. Risk is very low due to network jitter and the limited value behind the auth.
**Suggestion:** Use `timingSafeEqual` from `node:crypto` for credential comparison.
