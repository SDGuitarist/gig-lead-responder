# Security Sentinel — Review Findings

**Agent:** security-sentinel
**Branch:** feat/follow-up-v2-dashboard
**Date:** 2026-03-02
**Files reviewed:** 10 (api.ts, auth.ts, follow-up-api.ts, follow-up-scheduler.ts, leads.ts, rate-limit.ts, server.ts, twilio-webhook.ts, types.ts, dashboard.html)

## Executive Summary

The codebase demonstrates strong security fundamentals — HMAC-signed cookies, timing-safe comparisons, parameterized SQL, column whitelisting, input validation on API endpoints, CSRF protection on follow-up routes, and rate limiting. The findings below are almost entirely P2/P3 gaps in defense-in-depth rather than exploitable attack surfaces.

**Severity snapshot:** P1: 1 | P2: 5 | P3: 4

## Findings

### [P1] CSRF protection missing on api.ts POST routes
**File:** `src/api.ts:123,175,218,296`
**Issue:** The four POST routes in `api.ts` (`/api/leads/:id/approve`, `/api/leads/:id/edit`, `/api/leads/:id/outcome`, `/api/analyze`) do NOT use the `csrfGuard` middleware. Meanwhile, all four POST routes in `follow-up-api.ts` correctly apply `csrfGuard`. A cookie-authenticated user visiting a malicious page could have state-changing actions triggered on their behalf — specifically, approving and sending an SMS to a client, editing a draft, or setting an outcome. The `apiPost()` function in `dashboard.html` does send the `X-Requested-With: dashboard` header, but the server never checks it on these routes.
**Suggestion:** Add `csrfGuard` middleware to all four POST routes in `api.ts`, matching the pattern already established in `follow-up-api.ts`:
```typescript
import { csrfGuard } from "./auth.js";
router.post("/api/leads/:id/approve", approveLimiter, csrfGuard, async (req, res) => { ... });
router.post("/api/leads/:id/edit", csrfGuard, async (req, res) => { ... });
router.post("/api/leads/:id/outcome", csrfGuard, (req, res) => { ... });
router.post("/api/analyze", analyzeLimiter, csrfGuard, async (req, res) => { ... });
```

---

### [P2] CSP blocks Google Fonts — dashboard broken in production
**File:** `src/server.ts:42-44`
**Issue:** The Content-Security-Policy header is set to `style-src 'self' 'unsafe-inline'` with no allowance for `fonts.googleapis.com`, and there is no `font-src` directive (which defaults to `default-src 'self'`). The dashboard HTML loads Playfair Display from `https://fonts.googleapis.com` (stylesheet) and `https://fonts.gstatic.com` (font files). In any browser that enforces CSP, the font will fail to load silently.
**Suggestion:** Either add the Google Fonts domains to CSP:
```typescript
"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
"font-src 'self' https://fonts.gstatic.com; " +
```
Or self-host the Playfair Display font files and remove the external `<link>` tag.

---

### [P2] No input length limit on `/api/leads/:id/edit` body
**File:** `src/api.ts:175-211`
**Issue:** The `full_draft` field from `req.body` is validated as a non-empty string but has no maximum length check. Express is configured with a 100kb JSON body limit globally, but a single draft could still be up to ~100,000 characters. This value is stored directly in SQLite and later rendered in the dashboard.
**Suggestion:** Add a length check before processing:
```typescript
if (full_draft.length > 5000) {
  res.status(400).json({ error: "full_draft exceeds maximum length (5000 chars)" });
  return;
}
```

---

### [P2] No input length limit on `/api/analyze` text field
**File:** `src/api.ts:296-319`
**Issue:** The `text` field sent to the analyze endpoint is validated as non-empty but has no maximum length. This text is forwarded directly to the Anthropic Claude API. An attacker (or accidental large paste) could send a very large string that results in high token usage and API costs. The rate limiter (5 requests per 15 minutes) mitigates this somewhat.
**Suggestion:** Add a length cap:
```typescript
if (text.length > 10000) {
  res.status(400).json({ error: "Lead text too long (max 10,000 characters)" });
  return;
}
```

---

### [P2] Error messages from pipeline forwarded to client via SSE
**File:** `src/api.ts:313-315`
**Issue:** When the pipeline throws, the full `err.message` is sent to the client as an SSE error event. If the Anthropic SDK or internal code throws an error containing internal details (API keys in URLs, file paths, stack trace fragments), those would be exposed to the browser.
**Suggestion:** Send a generic error message to the client and log the full error server-side:
```typescript
} catch (err: unknown) {
  console.error("Pipeline error:", err);
  sendSSE(res, "error", { error: "Pipeline failed. Check server logs." });
}
```

---

### [P2] Twilio validation bypass flag not restricted to development at function level
**File:** `src/twilio-webhook.ts:38-41`
**Issue:** The server.ts startup check (lines 17-22) correctly blocks `DISABLE_TWILIO_VALIDATION` in production. However, the check in `verifyTwilioSignature()` itself does not verify `NODE_ENV` — it simply trusts the env var. If the production startup check is ever bypassed (e.g., the env var is set after boot, or the code is refactored), anyone could POST to `/webhook/twilio` with forged bodies.
**Suggestion:** Add a production guard inside `verifyTwilioSignature`:
```typescript
if (process.env.DISABLE_TWILIO_VALIDATION === "true") {
  if (process.env.NODE_ENV === "production" || process.env.RAILWAY_ENVIRONMENT) {
    console.error("FATAL: DISABLE_TWILIO_VALIDATION cannot be used in production");
    return false;
  }
  console.warn("Twilio signature validation disabled via DISABLE_TWILIO_VALIDATION");
  return true;
}
```

---

### [P3] `analyzeKvHTML` passes raw HTML as the value parameter
**File:** `public/dashboard.html:2149-2155`
**Issue:** The `analyzeKvHTML` function escapes the label via `esc()` but passes the value directly into `innerHTML`. The callers do escape most values through `esc()`, but the gate status line intentionally injects raw HTML. This pattern is fragile — any future caller that forgets to escape would introduce DOM XSS. Current usage is safe because all data comes from the application's own API.
**Suggestion:** Refactor `analyzeKvHTML` so the value is always escaped by default, and use a separate mechanism for the gate status badge.

---

### [P3] Cookie session has no revocation mechanism
**File:** `src/auth.ts:95-105`
**Issue:** The signed cookie is valid for 90 days with no server-side session store. If credentials are compromised, there is no way to invalidate existing sessions without changing `COOKIE_SECRET` (which invalidates ALL sessions). For a single-user dashboard this is low risk.
**Suggestion:** Document in ops runbook: "To revoke all sessions, rotate COOKIE_SECRET." For future hardening, consider adding a server-side session ID stored in SQLite.

---

### [P3] `trust proxy` set to 1 without documentation of expected proxy chain
**File:** `src/server.ts:32`
**Issue:** `app.set("trust proxy", 1)` trusts the first proxy hop. If the deployment topology changes (e.g., adding Cloudflare in front of Railway), the value needs to change to 2, or rate limiting will use the proxy IP instead of the real client IP. Correctly documented in existing comment.
**Suggestion:** Consider adding a startup log line that prints `trust proxy` value and `NODE_ENV` so topology mismatches are visible in logs.

---

### [P3] `/health` endpoint is not behind auth
**File:** `src/server.ts:68-70`
**Issue:** The `/health` endpoint returns `{ status: "ok" }` without authentication. This is intentional (Railway health checks need unauthenticated access), and the response reveals no sensitive information.
**Suggestion:** No change needed now. If expanded, keep it minimal or add auth-gated `/api/health/detailed`.

---

## Security Checklist

- [x] All inputs validated and sanitized (minor: no length limits on two endpoints)
- [x] No hardcoded secrets or credentials (all via env vars, with production guards)
- [x] Proper authentication on all endpoints (Basic Auth + signed cookie)
- [x] SQL queries use parameterization (better-sqlite3 `@param` syntax + column whitelist)
- [x] XSS protection implemented (`esc()` function, CSP headers, `textContent` for drafts)
- [x] HTTPS enforced where needed (cookie `secure: true` in production)
- [ ] CSRF protection enabled (MISSING on api.ts routes — P1)
- [x] Security headers properly configured (X-Frame-Options, X-Content-Type-Options, CSP)
- [ ] Error messages don't leak sensitive information (pipeline errors forwarded — P2)
- [ ] Dependencies up-to-date (not audited in this scan)

## Recommended Fix Order

| # | Issue | Priority | Why this order | Unblocks |
|---|-------|----------|---------------|----------|
| 1 | CSRF missing on api.ts POST routes | P1 | Root cause — all 4 routes vulnerable | — |
| 2 | Pipeline error messages forwarded to client | P2 | Quick fix, prevents info leak | — |
| 3 | CSP blocks Google Fonts | P2 | Functional bug in production | — |
| 4 | Input length limit on /api/leads/:id/edit | P2 | Defense-in-depth, trivial to add | — |
| 5 | Input length limit on /api/analyze | P2 | Cost protection, trivial to add | — |
| 6 | Twilio validation bypass not production-guarded | P2 | Defense-in-depth, 3 lines | — |
| 7 | analyzeKvHTML raw HTML pattern | P3 | Low risk today, prevents future XSS | — |
| 8 | Cookie session revocation | P3 | Operational awareness only | — |
| 9 | trust proxy documentation | P3 | Operational awareness only | — |
| 10 | /health endpoint scope | P3 | No change needed now | — |
