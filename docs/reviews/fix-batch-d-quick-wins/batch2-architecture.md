# Architecture Strategist — Review Findings

**Agent:** architecture-strategist
**Branch:** fix/batch-d-quick-wins
**Date:** 2026-02-25
**Files reviewed:** 2 (`src/server.ts`, `src/api.ts`)

## Findings

### [P1] Helmet middleware registered AFTER express.static — static files receive no security headers
**File:** `src/server.ts:21-30`
**Issue:** Express middleware executes in registration order. `express.static` is on line 21, `helmet()` on lines 22-30. When a request matches a static file, `express.static` sends the response immediately and never reaches Helmet. The dashboard HTML files — the primary user-facing surface — are served without any security headers.
**Suggestion:** Move `helmet()` above `express.static` so it runs on every response.

---

### [P1] Error sanitization is incomplete — twilio-webhook.ts sends raw error messages via SMS (3 locations)
**File:** `src/twilio-webhook.ts:197,210,219`
**Issue:** The branch sanitized error responses in `api.ts` but the same pattern remains unsanitized in `twilio-webhook.ts` at three locations where raw error messages are forwarded via SMS. Internal errors can contain credentials, URLs, or infrastructure details that should not leave the server boundary regardless of transport.
**Suggestion:** Apply the same sanitization pattern: log the full error server-side, send a generic message via SMS.

---

### [P2] Error sanitization applied per-route rather than as a cross-cutting concern
**File:** `src/api.ts` (multiple) and `src/twilio-webhook.ts` (multiple)
**Issue:** The current approach sanitizes errors at each individual catch block — a "shotgun surgery" pattern. Every new route must remember to sanitize independently. The system has at least 7 catch blocks across files, with inconsistent sanitization. The boundary between "safe to expose" and "must be redacted" is scattered across every catch block.
**Suggestion:** For HTTP: consider an Express error-handling middleware as the single enforcement point. For SMS: create a small `safeSmsError` helper. This concentrates policy in two places instead of scattering it.

---

### [P2] CSP allows `'unsafe-inline'` for scripts without documented justification or migration plan
**File:** `src/server.ts:25`
**Issue:** `'unsafe-inline'` substantially weakens CSP — it allows XSS payloads injected into the page to execute. The three HTML files each contain one `<script>` tag that could be extracted to external `.js` files. Classified as P2 because the dashboard is behind Basic Auth and doesn't render user-supplied content in script contexts.
**Suggestion:** Extract inline scripts to `.js` files in a future session. For now, add a TODO comment documenting the tech debt.

---

### [P2] post-pipeline.ts sends truncated but unsanitized error messages via SMS
**File:** `src/post-pipeline.ts:76`
**Issue:** `postPipelineError()` sends first 100 characters of raw error via SMS. API error messages can contain account identifiers or internal URLs within 100 characters. Architecturally inconsistent with the sanitization pattern in `api.ts`.
**Suggestion:** Replace with generic message — the full error is already in the database and logs.

---

### [P3] No `engines` field enforced at runtime
**File:** `package.json`
**Issue:** `"engines": { "node": ">=20" }` is declared but npm doesn't enforce this by default. Code uses `import.meta.dirname` (Node 20.11+). If deployed to Node 18, the app would fail at runtime.
**Suggestion:** Add `.npmrc` with `engine-strict=true` or a startup check in `server.ts`.

---

### [P3] Health endpoint and static files are unauthenticated — acceptable but worth documenting
**File:** `src/server.ts:42-48`
**Issue:** `/health` and static files are mounted outside `basicAuth`. For `/health`, this is intentional (Railway health checks). For static files, the HTML/CSS/JS is publicly viewable; only the data API is protected. Acceptable for single-operator tool but worth a comment.
**Suggestion:** Add a brief comment above `express.static` documenting this as a conscious decision.

---

## Summary

| Severity | Count | Key Theme |
|----------|-------|-----------|
| P1 | 2 | Helmet ordering; incomplete error sanitization |
| P2 | 3 | Scattered error handling; CSP unsafe-inline; post-pipeline SMS leaks |
| P3 | 2 | Engine enforcement; unauthenticated static files |
