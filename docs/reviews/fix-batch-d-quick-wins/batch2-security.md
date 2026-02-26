# Security Sentinel — Review Findings

**Agent:** security-sentinel
**Branch:** fix/batch-d-quick-wins
**Date:** 2026-02-25
**Files reviewed:** 9 (`src/server.ts`, `src/api.ts`, `src/twilio-webhook.ts`, `src/webhook.ts`, `src/auth.ts`, `src/sms.ts`, `src/leads.ts`, `src/post-pipeline.ts`, `src/run-pipeline.ts` + 3 public HTML files)

## Findings

### [P1] Helmet registered AFTER express.static — static HTML files get no security headers
**File:** `src/server.ts:21-30`
**Issue:** `express.static` is on line 21, `helmet()` on lines 22-30. Express middleware runs in registration order, so static files are served without CSP, X-Content-Type-Options, Strict-Transport-Security, X-Frame-Options, and every other Helmet header. Security headers only apply to API and webhook routes.
**Suggestion:** Move `app.use(helmet(...))` above `app.use(express.static(...))`.

---

### [P2] CSP allows 'unsafe-inline' scripts — XSS mitigation severely weakened
**File:** `src/server.ts:26`
**Issue:** `scriptSrc: ["'self'", "'unsafe-inline'"]` permits any inline script to execute, meaning a successful XSS injection can execute arbitrary JavaScript even with CSP enabled. All three HTML files embed large inline scripts. Acceptable trade-off given single-user Basic Auth dashboard, but largely defeats script-src CSP purpose.
**Suggestion:** Long-term: extract inline scripts to external `.js` files. No immediate code change needed — document as tech debt.

---

### [P2] Error messages leaked via SMS in twilio-webhook.ts catch blocks
**File:** `src/twilio-webhook.ts:197`
**File:** `src/twilio-webhook.ts:210`
**File:** `src/twilio-webhook.ts:219`
**Issue:** Three `.catch()` handlers send raw `err.message` or `String(err)` directly via SMS. Error messages can contain stack traces, API keys from misconfigured env vars, database paths, or Twilio account details. Incomplete application of the error sanitization pattern.
**Suggestion:** Log the full error server-side with `console.error`, send a generic message via SMS.

---

### [P2] Error message leaked via SMS in post-pipeline.ts
**File:** `src/post-pipeline.ts:64-83`
**Issue:** `postPipelineError()` sends truncated (100 chars) raw error message via SMS. Truncation does not prevent leakage — API errors can contain account identifiers within 100 characters. The error is already stored in the DB and logged.
**Suggestion:** Replace with generic SMS notification: "Pipeline failed. Check dashboard for details."

---

### [P2] Static dashboard files served without authentication
**File:** `src/server.ts:21`
**Issue:** `express.static` is registered before any auth middleware. Anyone can access `/dashboard.html` and read the HTML including API endpoint paths, data model structure, and auth mechanism. API calls require Basic Auth but HTML structure is exposed.
**Suggestion:** Either move `express.static` below auth middleware, or accept as low-impact risk since API endpoints are protected.

---

### [P2] No rate limiting on any endpoint
**File:** `src/server.ts` (entire file)
**Issue:** No rate limiting middleware. Critical endpoints vulnerable to abuse: `POST /api/analyze` (Anthropic API costs), `POST /api/leads/:id/approve` (Twilio SMS costs), `POST /webhook/mailgun` (pipeline + SMS costs if validation bypassed).
**Suggestion:** Add `express-rate-limit` on analyze and approve endpoints at minimum.

---

### [P2] Webhook validation bypass flags could be left enabled in production
**File:** `src/twilio-webhook.ts:34`
**File:** `src/webhook.ts:47`
**Issue:** `DISABLE_TWILIO_VALIDATION` and `DISABLE_MAILGUN_VALIDATION` env vars bypass signature validation. No runtime guard prevents these from being left on in production. An attacker could forge webhooks to inject leads or send SMS commands.
**Suggestion:** Add a startup check that refuses to start if bypass flags are enabled in production environment.

---

### [P3] Stored XSS risk via innerHTML with lead data in dashboard
**File:** `public/dashboard.html:1457-1485`
**Issue:** Dashboard renders lead data using `innerHTML` with an `esc()` helper. The `esc()` function is correctly implemented and consistently applied. Lead data originates from inbound emails (attacker-controlled). Current code appears safe — noting the architecture as a watch item.
**Suggestion:** No immediate action. Consider DOM-based templating with auto-escaping for future hardening.

---

### [P3] Basic Auth credentials sent without guaranteed HSTS
**File:** `src/auth.ts` and `src/server.ts`
**Issue:** Basic Auth sends base64 credentials in every request. Helmet enables HSTS by default but the ordering bug means static files don't get this header. On Railway, TLS is at the proxy level so low-risk in production.
**Suggestion:** Fix Helmet ordering (addresses this). Optionally add explicit HTTPS redirect for production.

---

### [P3] No input length limit on text field in /api/analyze
**File:** `src/api.ts:280-281`
**Issue:** `/api/analyze` validates `text` is non-empty string but no max length. Body parser limits to 100KB total but text field could still be very large, increasing API costs.
**Suggestion:** Add explicit length check: `if (text.length > 10000) return 400`.

---

## Summary

| Severity | Count |
|----------|-------|
| P1 | 1 |
| P2 | 5 |
| P3 | 3 |
