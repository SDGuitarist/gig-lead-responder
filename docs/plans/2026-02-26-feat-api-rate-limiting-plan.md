---
title: "feat: Add per-route rate limiting to cost-sensitive API endpoints"
type: feat
status: active
date: 2026-02-26
origin: docs/brainstorms/2026-02-26-rate-limiting-brainstorm.md
feed_forward:
  risk: "In-memory store resets on Railway deploys — rate limits effectively reset each time"
  verify_first: true
---

# feat: Add per-route rate limiting to cost-sensitive API endpoints

## Enhancement Summary

**Deepened on:** 2026-02-26
**Sections enhanced:** 5 (MVP code, acceptance criteria, middleware order, frontend fix, scope)
**Agents used:** TypeScript reviewer, security sentinel, performance oracle, architecture strategist, code simplicity reviewer, pattern recognition specialist, learnings researcher, Context7 (express-rate-limit docs)

### Key Improvements

1. **Removed `rateLimitBypass` middleware** — original code was a no-op (called `next()` in both branches, never actually skipped the limiter). Simplicity reviewer confirmed bypass is YAGNI: 5/15min is generous for manual dev.
2. **Removed production guard and `DISABLE_RATE_LIMITING` env var** — no bypass means no guard needed. Eliminates `server.ts` changes beyond `trust proxy`.
3. **Fixed `_req` naming** — parameter was used but prefixed with underscore (misleading convention). Renamed to `req`.
4. **Verified XSS safety** — error rendering uses `.textContent` (not `.innerHTML`), so no `esc()` needed. Removed false acceptance criterion.
5. **Added defensive JSON parsing** — frontend handles case where 429 response isn't JSON (belt-and-suspenders for misconfigured handler).

### Findings Considered but Not Incorporated

- **Extract `isProduction()` utility** (TypeScript reviewer) — 3 occurrences of the production check exist, but adding a utility is scope creep for this feature.
- **`standardHeaders: true` removal** (simplicity reviewer) — keeping them. Zero cost, useful for debugging 429s in Railway logs via `RateLimit-Remaining` header.
- **Sanitize Twilio error messages in approve handler** (security sentinel) — pre-existing issue, not caused by rate limiting. Separate fix.
- **Concurrency limiter for simultaneous pipeline runs** (learnings check) — rate limiter counts at request start, so 5 concurrent analyze calls are possible. Acceptable for single-user threat model.

---

### Prior Phase Risk

> **Least confident about going into the next phase?** Whether the in-memory
> store resets on Railway deploys. If the app restarts frequently, rate limits
> effectively reset each time. Acceptable for a single-user app — the limits
> catch sustained abuse, not one-off spikes.

Accepted. In-memory store is sufficient — the threat model is runaway scripts
or leaked credentials making sustained requests, not one-off spikes that slip
through during a deploy restart. Performance oracle confirmed: even with resets
every 15 minutes, a runaway script gets at most 5 requests per restart vs 3,600/hr
without the limiter — a 99.4% reduction in runaway costs.

## Overview

Add `express-rate-limit` middleware to the two API endpoints that call paid
external APIs: `POST /api/analyze` (Anthropic) and `POST /api/leads/:id/approve`
(Twilio). This prevents runaway costs from leaked credentials or buggy scripts.

(see brainstorm: docs/brainstorms/2026-02-26-rate-limiting-brainstorm.md)

## Acceptance Criteria

- [ ] `express-rate-limit` installed as a dependency
- [ ] `POST /api/analyze` limited to **5 requests per 15 minutes**
- [ ] `POST /api/leads/:id/approve` limited to **10 requests per 15 minutes**
- [ ] Rate limit responses return **JSON** `{ error: "..." }` (not default plain text)
- [ ] `app.set("trust proxy", 1)` added to `src/server.ts` before middleware, after `const app = express()`
- [ ] Frontend `runAnalyze()` checks `response.ok` before reading SSE stream
- [ ] Frontend shows error message on 429 (not infinite loading state)
- [ ] Rate limit hits logged with `console.warn`

## MVP

Three files changed, one file created.

### 1. Install dependency

```bash
npm install express-rate-limit
```

### 2. Create `src/rate-limit.ts`

Follows the `src/auth.ts` pattern — exports middleware functions. Multi-export
utility (unlike `auth.ts` which exports one function) because both limiters
share config and belong to the same concern.

```typescript
// src/rate-limit.ts
import rateLimit from "express-rate-limit";
import type { Request, Response } from "express";

// In-memory store resets on process restart (Railway deploys).
// Acceptable for single-user abuse protection — catches sustained
// runaway requests, not one-off spikes during deploys.
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function createLimitHandler(msg: string) {
  return (req: Request, res: Response) => {
    console.warn(`Rate limit hit: ${req.method} ${req.path} from ${req.ip}`);
    res.status(429).json({ error: msg });
  };
}

export const analyzeLimiter = rateLimit({
  windowMs: WINDOW_MS,
  limit: 5,
  handler: createLimitHandler("Too many requests. Please wait before trying again."),
  standardHeaders: true,
  legacyHeaders: false,
});

export const approveLimiter = rateLimit({
  windowMs: WINDOW_MS,
  limit: 10,
  handler: createLimitHandler("Too many requests. Please wait before trying again."),
  standardHeaders: true,
  legacyHeaders: false,
});
```

#### Research Insights

**Changes from original plan:**

| Original | Changed To | Why |
|----------|-----------|-----|
| `max: 5` | `limit: 5` | `limit` is the v7 option name (Context7 docs). `max` still works as alias but `limit` is canonical. |
| `_req` parameter | `req` | Underscore prefix means "unused" by convention, but `req.method`/`req.path`/`req.ip` ARE used. (TypeScript reviewer) |
| `jsonHandler` | `createLimitHandler` | Clearer name — says what it creates, not what format it returns. (TypeScript reviewer) |
| Two different messages | One generic message | "Too many analyze requests" vs "Too many approve requests" — user already knows which button they clicked. One message is simpler. (Simplicity reviewer) |
| `rateLimitBypass` export | Removed | Called `next()` in both branches — never actually skipped the limiter. Also YAGNI: 5/15min is generous for dev. (TypeScript + simplicity + architecture reviewers) |
| `DISABLE_RATE_LIMITING` env var | Removed | No bypass means no env var. (Simplicity reviewer) |
| `import type { Request, Response, NextFunction }` | `import type { Request, Response }` | No `NextFunction` needed with bypass removed. |

**If bypass is needed later:** Use `express-rate-limit`'s built-in `skip` option
(Context7 docs, pattern recognition specialist). This keeps bypass logic inside
each limiter rather than as a separate middleware:

```typescript
export const analyzeLimiter = rateLimit({
  // ...
  skip: () => process.env.DISABLE_RATE_LIMITING === "true",
});
```

Add the corresponding production guard in `server.ts` alongside existing webhook
bypass guards only when this is needed.

### 3. Update `src/server.ts`

One change — add `trust proxy` before middleware registration:

```typescript
const app = express();

// Railway runs behind a reverse proxy. Trust one hop so req.ip
// reflects the real client IP, not the proxy IP.
app.set("trust proxy", 1);

// ... existing middleware below
```

#### Research Insights

**Placement matters:** Must go after `const app = express()` and before any
middleware that reads `req.ip`. Line ~25 of `server.ts`. (TypeScript reviewer,
Context7 docs)

**Value `1` is correct:** Tells Express to trust exactly one proxy hop. Using
`true` would trust all `X-Forwarded-For` headers (spoofable). Railway has one
proxy. (Security sentinel)

**No production guard needed:** Original plan had a `DISABLE_RATE_LIMITING`
guard here. Removed because the bypass was removed. If bypass is added later,
add the guard as a separate `if` block inside the existing production check at
`server.ts:14-18`, matching the existing pattern. (Architecture strategist)

### 4. Update `src/api.ts`

Apply limiters as per-route middleware (after `basicAuth`, before handler):

```typescript
import { analyzeLimiter, approveLimiter } from "./rate-limit.js";

// Per-route only — not router.use(). Only these two routes call paid APIs.
router.post("/api/analyze", analyzeLimiter, async (req, res) => { ... });
router.post("/api/leads/:id/approve", approveLimiter, async (req, res) => { ... });
```

#### Research Insights

**No `router.use()` for limiters.** Original plan applied `rateLimitBypass` via
`router.use()`, which ran on ALL `/api/*` routes including read-only ones that
don't need rate limiting. Per-route application is correct — only the two
cost-sensitive routes get middleware. (Architecture strategist)

**Import uses `.js` extension.** Matches all existing imports in the codebase
(ESM-style TypeScript). Confirmed via pattern check — zero exceptions across
30+ local imports. (Pattern recognition specialist)

### 5. Fix frontend SSE handler in `public/dashboard.html`

Add `response.ok` check in `runAnalyze()` before reading the stream:

```javascript
fetch('/api/analyze', { ... }).then(function (response) {
  if (!response.ok) {
    var contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return response.json().then(function (err) {
        throw new Error(err.error || 'API error ' + response.status);
      });
    }
    return response.text().then(function (text) {
      throw new Error(text || 'API error ' + response.status);
    });
  }
  var reader = response.body.getReader();
  // ... existing SSE reading code
```

#### Research Insights

**Why the content-type check?** If `express-rate-limit`'s custom handler is
misconfigured or the library defaults fire, the response could be plain text
instead of JSON. Calling `response.json()` on plain text throws a parse error,
swallowing the actual 429 message. The content-type sniff prevents this.
(TypeScript reviewer, performance oracle)

**XSS is not a concern here.** The error rendering at `dashboard.html:2069-2070`
uses `.textContent`, not `.innerHTML`. `textContent` is XSS-safe by definition —
it doesn't parse HTML. No `esc()` needed.

**Scope this narrowly.** Only fix `runAnalyze()` in this PR. Other fetch calls
in the dashboard may have the same missing `response.ok` check, but those are
pre-existing bugs and separate concerns. (Architecture strategist)

## Middleware Order

```
Request → basicAuth → [analyzeLimiter|approveLimiter] → handler
```

- Auth fires first — unauthenticated requests get 401, never touch rate limiter
- Rate limiter counts are NOT incremented for 401 responses (limiter never runs)
- This means rate limiting protects against **authenticated misuse** (leaked creds, runaway scripts), not unauthenticated flood
- This matches the brainstorm's threat model

### Research Insights

**Rate limiter + atomic claim interaction (approve route):** The approve handler
uses `claimLeadForSending()` which atomically prevents double-SMS via
`UPDATE ... WHERE status IN ('received', 'sent')`. Rate limiting and the claim
are independent, complementary guards — the claim prevents double-sends, the
limiter prevents cost runaway. Both 409 (claim rejected) and 200 (success)
responses count against the rate limit. This is correct: 10 approve attempts
in 15 minutes is suspicious regardless of outcome. (Learnings check —
`docs/solutions/architecture/atomic-claim-for-concurrent-state-transitions.md`)

**One edge case:** If SMS fails (Twilio error), the lead reverts to previous
status, but the rate limit token is spent. The user might not be able to retry
for up to 15 minutes. With a 10-request limit, this only matters if the user
hits 10 failures in 15 minutes — extremely unlikely. (Security sentinel)

## What's NOT in Scope

- Webhook rate limiting (signature validation is the security layer — see brainstorm)
- Rate limiting read-only endpoints (`GET /api/leads`, `/api/stats`) — no external API cost
- Redis/persistent store — in-memory is fine for single-process Railway deployment
- Frontend display of remaining requests or cooldown timer — generic error message is sufficient
- Refactoring existing webhook bypass guards to match the auth.ts pattern (separate concern)
- `DISABLE_RATE_LIMITING` dev bypass — YAGNI, add only if 5/15min becomes a dev bottleneck
- `isProduction()` utility extraction — 3 occurrences exist but that's a separate refactor
- Sanitizing Twilio error messages in approve handler — pre-existing issue, not caused by this feature

## Performance Notes

**Memory:** Two MemoryStore instances hold ~96 bytes per unique IP. Single user =
~384 bytes total across both stores. Cleanup runs every 15 minutes (window interval).
Even under a hypothetical 10K unique IP attack: ~3.8 MB. (Performance oracle)

**Per-request overhead:** One synchronous Map lookup per rate-limited request — ~0.5
microseconds. Immeasurable at single-user traffic levels. (Performance oracle)

**SSE interaction:** Rate limiter fires before SSE headers are set, returning a
standard 429 JSON response. The SSE stream is never opened. No conflict.
(Performance oracle)

## Sources

- **Origin brainstorm:** [docs/brainstorms/2026-02-26-rate-limiting-brainstorm.md](docs/brainstorms/2026-02-26-rate-limiting-brainstorm.md) — scoped to API-only, `express-rate-limit`, in-memory store, 5/15 and 10/15 limits
- **Institutional pattern:** [docs/solutions/architecture/environment-aware-fatal-guards.md](docs/solutions/architecture/environment-aware-fatal-guards.md) — production guard pattern (retained as reference if bypass added later)
- **Institutional pattern:** [docs/solutions/architecture/silent-failure-escape-hatches.md](docs/solutions/architecture/silent-failure-escape-hatches.md) — dev bypass pattern (retained as reference if bypass added later)
- **Institutional pattern:** [docs/solutions/architecture/escape-at-interpolation-site.md](docs/solutions/architecture/escape-at-interpolation-site.md) — XSS prevention for 429 error message rendering
- **Institutional pattern:** [docs/solutions/architecture/atomic-claim-for-concurrent-state-transitions.md](docs/solutions/architecture/atomic-claim-for-concurrent-state-transitions.md) — approve route claim mechanism (confirmed no conflict with rate limiting)
- **Existing middleware:** `src/auth.ts` — pattern for file structure and middleware export
- **SSE endpoint:** `src/api.ts:279-302` — analyze route with streaming response
- **Approve endpoint:** `src/api.ts:109-159` — approve route with JSON response
- **Frontend handler:** `public/dashboard.html:2029` — `runAnalyze()` function missing `response.ok` check
- **Context7:** express-rate-limit v7 docs — `limit` (not `max`), `handler` signature, `skip` option, trust proxy guidance
- Related issue: #5

## Three Questions

1. **Hardest decision in this session?** Whether to keep the `DISABLE_RATE_LIMITING` bypass. The institutional learnings (environment-aware guards, escape hatches) recommended it, but the simplicity reviewer proved it was YAGNI AND the implementation was broken (called `next()` in both branches). Removed it — the `skip` option provides a clean path to add it later if actually needed.

2. **What did you reject, and why?** A separate `response.ok` check middleware that normalizes all error responses before they reach the SSE reader. Over-engineered for one endpoint — the inline check in `runAnalyze()` is simpler and self-documenting.

3. **Least confident about going into the next phase?** Whether the `createLimitHandler` factory function is worth it over inlining the handler in each limiter. Two call sites with identical messages — the factory saves 3 lines but adds a layer of indirection. Might inline during implementation if it reads better.
