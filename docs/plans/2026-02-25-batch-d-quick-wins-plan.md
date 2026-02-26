# Batch D Quick Wins — Plan

**Date:** 2026-02-25
**Brainstorm:** `docs/brainstorms/2026-02-25-batch-d-quick-wins-brainstorm.md`
**Branch:** `fix/batch-d-quick-wins`

```yaml
feed_forward:
  risk: "Helmet's default CSP blocks inline scripts in dashboard.html"
  verify_first: true
```

### Prior Phase Risk

> **Least confident about going into the next phase?** Helmet's default CSP vs.
> inline dashboard code. If defaults block inline scripts, the fix could spiral
> from "one line of code" into CSP policy configuration or JS/CSS extraction.

**Resolution:** Researched Helmet 8.x defaults. Default CSP sets
`script-src 'self'` (blocks inline scripts) but `style-src 'self' https: 'unsafe-inline'`
(allows inline styles). The dashboard has one `<script>` block at line 1090
(~1,000 lines of inline JS). Fix: override `scriptSrc` to include `'unsafe-inline'`.
No need to extract JS/CSS or disable CSP entirely.

---

## Scope

3 changes across 2 files. No new files, no new dependencies beyond `helmet`.

| # | Fix | File | Lines changed |
|---|-----|------|---------------|
| 1 | Helmet security headers | `src/server.ts` | ~5 |
| 2 | SMS error sanitization | `src/api.ts` (line 144) | ~3 |
| 3 | Analyze error sanitization | `src/api.ts` (line 297-298) | ~3 |

## 1. Helmet Security Headers

**Install:**

```bash
npm install helmet
```

**Add to `src/server.ts`** — after `express.static`, before routes:

```typescript
import helmet from "helmet";

// After express.static, before routes
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        scriptSrc: ["'self'", "'unsafe-inline'"],
      },
    },
  })
);
```

**Why this config:**
- `scriptSrc: ["'self'", "'unsafe-inline'"]` — overrides the default
  `script-src 'self'` to allow the dashboard's inline `<script>` block.
  All other default directives remain (including `style-src 'self' https: 'unsafe-inline'`
  which already allows inline styles and Google Fonts).
- All other Helmet middlewares use defaults: X-Frame-Options SAMEORIGIN,
  X-Content-Type-Options nosniff, HSTS 365 days, Referrer-Policy no-referrer, etc.
- Google Fonts `<link>` works because default `font-src` includes `https:` and
  default `style-src` includes `https:`.

**Why `'unsafe-inline'` instead of extracting JS:** The dashboard is a 2,092-line
monolith. Extracting JS to a separate file is a refactor, not a quick win. The
dashboard is behind Basic Auth with a single user — `'unsafe-inline'` is an
acceptable tradeoff for a non-public page.

## 2. SMS Error Sanitization

**File:** `src/api.ts`, line 140-145 (POST `/api/leads/:id/approve` catch block)

**Current code:**

```typescript
const message = err instanceof Error ? err.message : String(err);
res.status(500).json({ error: `SMS failed: ${message}` });
```

**Problem:** `err.message` from Twilio SDK may contain account SIDs or API keys
in error messages (e.g., "Account SID AC1234... is not authorized").

**Fix:**

```typescript
console.error(`Lead ${id}: SMS send failed:`, err);
res.status(500).json({ error: "SMS delivery failed" });
```

Log the real error server-side (visible in Railway logs), return a generic
message to the client.

## 3. Analyze Endpoint Error Sanitization

**File:** `src/api.ts`, line 296-298 (POST `/api/analyze` catch block)

**Current code:**

```typescript
const message = err instanceof Error ? err.message : String(err);
sendSSE(res, "error", { error: message });
```

**Problem:** `err.message` from the Anthropic SDK may contain API keys, rate
limit details, or internal error formats.

**Fix:**

```typescript
console.error("Analyze pipeline failed:", err);
sendSSE(res, "error", { error: "Analysis failed — check server logs" });
```

Same pattern: log real error server-side, return generic message to client.

---

## Implementation Order

1. `npm install helmet` + add to `src/server.ts` (commit)
2. SMS error sanitization in `src/api.ts` (commit)
3. Analyze error sanitization in `src/api.ts` (commit)

Each step is independent — can commit after each one.

## Verification

After all 3 changes:

1. `npm run build` — confirm TypeScript compiles
2. `curl -I http://localhost:3000/dashboard.html` — verify Helmet headers present
   (X-Content-Type-Options, X-Frame-Options, Strict-Transport-Security,
   Content-Security-Policy with `'unsafe-inline'` in script-src)
3. Load dashboard in browser — confirm inline JS still works (page renders, lead
   list loads, buttons work)
4. Run test leads through `/api/analyze` — confirm SSE errors show generic message

## Three Questions

### 1. Hardest decision in this session?

Whether to use `'unsafe-inline'` for `scriptSrc` or disable CSP entirely.
`'unsafe-inline'` is weaker than strict CSP but still provides value: the other
directives (`default-src`, `object-src 'none'`, `frame-ancestors 'self'`, etc.)
remain enforced. Disabling CSP entirely would lose all of that. Since the
dashboard is behind Basic Auth with one user, `'unsafe-inline'` for scripts is
the right tradeoff.

### 2. What did you reject, and why?

Rejected extracting the dashboard's inline JS to a separate file. That would
allow strict `script-src 'self'` (no `'unsafe-inline'`), but it's a refactor
that changes file structure, adds a new static asset, and risks breaking the
dashboard. Not appropriate for a "quick wins" batch.

### 3. Least confident about going into the next phase?

Whether Helmet's `contentSecurityPolicy.directives` merge strategy works as
expected — specifically, that overriding `scriptSrc` only replaces `script-src`
while preserving all other defaults. The Helmet docs say it does, and the
research confirmed it, but this should be verified by inspecting the actual
response headers after implementation.
