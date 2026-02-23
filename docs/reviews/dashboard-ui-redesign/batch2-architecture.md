# Architecture Strategist — Review Findings

**Agent:** architecture-strategist
**Branch:** main (commits ddb515d..d5b34fe)
**Date:** 2026-02-22
**Files reviewed:** 6

## Findings

### [P1] `/api/analyze` has no authentication

**File:** `src/server.ts:51`
**Issue:** The `/api/analyze` endpoint is mounted directly on the Express app outside the `apiRouter` and its `basicAuth` middleware. Every other `/api/*` route is protected. This endpoint calls `runPipeline()`, which invokes the Anthropic API and consumes real API credits. Anyone who discovers the endpoint can burn through the API key.
**Suggestion:** Move `/api/analyze` into `src/api.ts` and protect it with the same `basicAuth` middleware. Update the client-side `runAnalyze()` to send the auth header.

---

### [P2] Authentication is applied piecemeal across three locations

**File:** `src/api.ts:8-9`, `src/dashboard.ts:8`, `src/server.ts:51`
**Issue:** Auth is sprinkled in three places with no single point of control: per-path in `api.ts` (lines 8-9), per-path in `dashboard.ts` (line 8), and missing entirely for `/api/analyze` in `server.ts`. Every new route requires the developer to remember to add auth. This is the kind of setup where a future route silently ships without auth.
**Suggestion:** Apply `basicAuth` once at the router level in `api.ts` (`router.use(basicAuth)`), covering all routes in that router. Move `/api/analyze` into `api.ts` as well.

---

### [P2] `src/dashboard.ts` is dead weight (185 lines of superseded code)

**File:** `src/dashboard.ts` (all 185 lines)
**Issue:** The old server-rendered dashboard is fully superseded by the new SPA. The root route redirects `/` to `/dashboard.html`. Keeping `dashboard.ts` alive preserves a dependency chain to `listLeads()` (potentially dead code) and adds 185 lines of dead rendering code with duplicate helpers.
**Suggestion:** Delete `dashboard.ts` and remove its import/mount from `server.ts`, or convert `/leads` to a redirect to `/dashboard.html`.

---

### [P2] `listLeads()` may be dead code; `getLeadsByStatus()` still needed by Twilio webhook

**File:** `src/leads.ts:210-219` (`listLeads`), `src/leads.ts:126-135` (`getLeadsByStatus`)
**Issue:** `listLeads()` is imported only by `dashboard.ts` (the superseded dashboard). `listLeadsFiltered()` is a strict superset. `getLeadsByStatus()` is still used by the Twilio webhook and is NOT dead code.
**Suggestion:** If `dashboard.ts` is removed, delete `listLeads()`. Leave `getLeadsByStatus()` alone or optionally replace with `listLeadsFiltered({ status })`.

---

### [P2] `shapeLead()` manually maps 25+ fields creating a brittle serialization layer

**File:** `src/api.ts:22-72`
**Issue:** 50-line function hand-maps 25+ fields with no named return type. Every column added to `leads` must also be added here or it silently disappears. The return type is an anonymous inferred object — no compile-time contract between server and client. A rename silently breaks the client.
**Suggestion:** Define a named `LeadApiResponse` interface in `src/types.ts` and type `shapeLead()` against it.

---

### [P2] SSE endpoint mounts inline in `server.ts`, breaking the router separation pattern

**File:** `src/server.ts:46-75`
**Issue:** `server.ts` is the composition root — it should wire together routers and middleware, not implement business logic. Lines 46-75 contain `sendSSE()` helper and the `/api/analyze` handler with input validation, SSE setup, and pipeline orchestration. Every other route lives in a router module; this is the only exception.
**Suggestion:** Move `/api/analyze` and `sendSSE()` into `src/api.ts`. This also naturally solves the auth gap.

---

### [P2] 735 lines of inline CSS + 665 lines of inline JS in `dashboard.html`

**File:** `public/dashboard.html:8-735` (CSS), `public/dashboard.html:890-1556` (JS)
**Issue:** 1394 lines of CSS+JS in a single HTML file with actual markup being only ~150 lines. No cache benefit (inline CSS/JS re-downloads every load), no linting, and growing complexity (file grew from 876 to 1558 lines across four chunks).
**Suggestion:** Extract CSS to `public/dashboard.css` and JS to `public/dashboard.js`. Low-priority refactor for a future cleanup session.

---

### [P2] `renderAnalyzeResults()` accesses deeply nested properties without null guards

**File:** `public/dashboard.html:1427-1480`
**Issue:** Accesses `data.classification`, `data.pricing`, `data.gate.gut_checks`, `data.gate.gate_status` etc. without null checks. If the SSE `complete` event delivers a partial payload, the function throws an uncaught TypeError and the results panel stays blank. The HANDOFF doc itself flagged this risk.
**Suggestion:** Add a top-level guard at the start of `renderAnalyzeResults` and use `|| []` fallbacks for nested arrays.

---

### [P3] `dashboard.html` loads Google Fonts externally

**File:** `public/dashboard.html:7`
**Issue:** Loads Playfair Display from Google Fonts CDN. If unavailable, FOUT occurs. Minor privacy consideration for a business tool.
**Suggestion:** Accept as-is or self-host fonts in `public/fonts/`. Cosmetic issue.

---

### [P3] `server.ts` hardcodes the redirect target `/dashboard.html`

**File:** `src/server.ts:37-39`
**Issue:** Root route redirects to hardcoded filename. Minor coupling. Could rename to `index.html` and let `express.static` serve it automatically.
**Suggestion:** Low priority. Accept the coupling or rename to `index.html`.

---

### [P3] No rate limiting on `/api/analyze`

**File:** `src/server.ts:51`
**Issue:** Even once auth is added, no rate limiting exists. A user or bug could fire dozens of concurrent analyze requests, each consuming Anthropic API credits.
**Suggestion:** Add a simple in-memory semaphore preventing concurrent pipeline runs.

---

## Summary

| Severity | Count | Key themes |
|----------|-------|------------|
| P1 | 1 | Unauthenticated endpoint burning paid API credits |
| P2 | 7 | Piecemeal auth, dead code, brittle serialization, inline business logic in composition root, monolithic HTML, missing null guards |
| P3 | 3 | External font dependency, hardcoded redirect, no rate limiting |
