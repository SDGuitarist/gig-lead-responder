---
title: "fix: Global Express Error Middleware"
type: fix
status: completed
date: 2026-03-08
origin: docs/brainstorms/2026-03-08-global-error-middleware-brainstorm.md
feed_forward:
  risk: "Async error handling — Express v4 doesn't catch rejected promises from async handlers. POST /api/leads/:id/approve and /edit are async without full try-catch."
  verify_first: true
---

# fix: Global Express Error Middleware

## Prior Phase Risk

> **Least confident about going into the next phase?** Async error handling.
> Express v4 doesn't automatically catch rejected promises in async route
> handlers. Our DB calls are synchronous (better-sqlite3), but
> `POST /api/analyze` and webhook handlers are async. The plan should clarify
> whether we need an async wrapper or if existing try-catch coverage is
> sufficient for async routes.

**Resolution:** Yes, an `asyncHandler` wrapper is needed — but only for 2
routes. Full analysis below in Step 2.

## Overview

There is no global Express error-handling middleware anywhere in the app. When
any route handler throws an unhandled error, Express returns its default HTML
error page instead of the `{ error: string }` JSON the dashboard expects. This
breaks the dashboard's error display.

The fix is two components:
1. A global error-handling middleware in `src/server.ts` (registered last)
2. An `asyncHandler` wrapper in `src/utils/async-handler.ts` for Express v4
   async routes

(See brainstorm: `docs/brainstorms/2026-03-08-global-error-middleware-brainstorm.md`)

## What Exactly Is Changing?

| File | Change |
|------|--------|
| `src/server.ts` | Add global error middleware after all routes (after line 97, before `app.listen`) |
| `src/utils/async-handler.ts` | **New file** — 8-line `asyncHandler` wrapper |
| `src/api.ts` | Wrap 2 async route handlers with `asyncHandler` (lines 50, 101) |

**Total:** ~30 lines of production code across 3 files. Tests are additional
(not counted in this estimate).

## What Must Not Change?

- **SSE framing, stream lifecycle, and `/api/analyze` behavior** — this route
  has its own try-catch-finally for SSE streaming. Do NOT wrap with
  `asyncHandler`. Do not change `res.flushHeaders()`, `sendSSE()`, or
  `res.end()` calls. The SSE error format (`event: error`) is intentionally
  different from the JSON `{ error }` format the global middleware returns.
- **Normal sync-route behavior** — sync routes using better-sqlite3 already
  throw into Express natively. The global middleware catches these without any
  wrapping. Do not add `asyncHandler` to sync routes.
- `src/webhook.ts` and `src/twilio-webhook.ts` — sync at Express level with
  fire-and-forget async chains. Already protected by `.catch()`.
- `src/follow-up-api.ts` — all 4 routes are synchronous. Global middleware
  catches them natively. No changes needed.
- Dashboard HTML/JS — already handles `{ error: string }` responses.
- Database layer — continues to throw on error. No changes.
- Existing try-catch blocks — leave in place. They handle specific cases
  (SMS errors, SSE formatting) that the global middleware shouldn't override.

## How Will We Know It Worked?

1. **Manual test:** Stop the DB (rename the file), hit `GET /api/analytics` →
   should return `{ error: "Internal server error" }` with status 500, not HTML.
2. **Console output:** Error log should include method, path, error message, and
   stack trace.
3. **Existing tests pass:** All 62 tests still green (no behavioral changes to
   happy paths).
4. **SSE endpoint unchanged:** `POST /api/analyze` still returns SSE error
   events on failure, not JSON.

## Most Likely Way This Plan Is Wrong

Two concrete failure modes, ranked by likelihood:

1. **Missed async route.** If a future session adds an async route handler
   without `asyncHandler`, the global middleware never sees its rejections. The
   async-handler inventory below makes the current state explicit so review can
   catch drift.

2. **Post-flush SSE error path.** If `/api/analyze` somehow reaches the global
   middleware after `res.flushHeaders()`, the `res.headersSent` guard must
   prevent a double-response crash. This is a safety net — the SSE route's own
   try-catch-finally covers all post-flush code (verified: lines 244–254 in
   `src/api.ts`). But if someone later adds code between `flushHeaders` and
   `try`, the guard becomes load-bearing.

A subtler risk: the `POST /api/leads/:id/edit` handler is declared `async` but
contains zero `await` calls. Removing `async` would also fix it (sync handlers
are caught natively). But wrapping with `asyncHandler` is defensive — if
someone later adds an `await`, the protection stays. Worth the one-line cost.

## Async-Route Inventory

Every async handler across the 4 named files, whether it is wrapped, and why.

### src/api.ts

| Handler | Line | Async? | Protected? | Action |
|---------|------|--------|------------|--------|
| `GET /api/leads` | 23 | No | Sync — Express catches natively | None |
| `GET /api/stats` | 44 | No | Sync — Express catches natively | None |
| `POST /api/leads/:id/approve` | 50 | **Yes** | Partial — try-catch covers SMS only; DB calls before it are bare | **Wrap with `asyncHandler`** |
| `POST /api/leads/:id/edit` | 101 | **Yes** | No try-catch at all | **Wrap with `asyncHandler`** |
| `POST /api/leads/:id/outcome` | 148 | No | Sync — Express catches natively | None |
| `GET /api/analytics` | 222 | No | Sync — Express catches natively | None |
| `POST /api/analyze` | 228 | **Yes** | Full try-catch-finally (SSE-specific) | **Do NOT wrap** (see SSE decision below) |

### src/follow-up-api.ts

| Handler | Line | Async? | Protected? | Action |
|---------|------|--------|------------|--------|
| `POST .../follow-up/approve` | 31 | No | Sync via `handleAction` | None |
| `POST .../follow-up/skip` | 35 | No | Sync via `handleAction` | None |
| `POST .../follow-up/snooze` | 39 | No | Sync inline | None |
| `POST .../follow-up/replied` | 80 | No | Sync via `handleAction` | None |

### src/webhook.ts

| Handler | Line | Async? | Protected? | Action |
|---------|------|--------|------------|--------|
| `POST /webhook/mailgun` | 42 | No | Sync handler; pipeline is fire-and-forget with `.catch()` | None |

### src/twilio-webhook.ts

| Handler | Line | Async? | Protected? | Action |
|---------|------|--------|------------|--------|
| `POST /webhook/twilio` | 220 | No | Sync handler; returns TwiML immediately, async work via `.catch()` | None |

**Summary:** 3 async handlers exist. 2 need wrapping. 1 (SSE) is self-handled.
All other handlers are sync and caught natively by Express.

## SSE Decision: Why `/api/analyze` Stays Self-Handled

In plain English: once an SSE response starts streaming (`res.flushHeaders()`
on line 242), the HTTP headers — including status code and content-type — are
already sent to the client. You can't change the status code or switch to JSON
after that point. So the SSE route **must** handle its own errors by writing
an SSE `event: error` message into the stream, not by calling `next(err)`.

The global middleware's `res.headersSent` guard is a safety net for this case:
if an error somehow reaches the global handler after headers are flushed, it
calls `res.end()` instead of trying to send JSON. But this should never
actually fire, because the SSE route's try-catch-finally (lines 244–254)
covers every code path after `flushHeaders`. There is no code between
`res.flushHeaders()` (line 242) and the `try` block (line 244) that could
throw and escape.

## Public Error-Body Rule

The global middleware uses `err.expose` (set by `http-errors`, which
`express.json()` uses internally) to decide the client-facing message:

- **`err.expose === true`** (4xx errors from Express middleware like
  `express.json()`): return `err.message` — e.g., `"Unexpected token x in
  JSON at position 0"`. These messages come from Node's `JSON.parse` and do
  not contain server internals.
- **`err.expose !== true`** (5xx errors, application throws): return
  `"Internal server error"`. Never leak DB table names, SQL, column names, or
  stack traces to the client.

This means a malformed JSON request gets `{ error: "Unexpected token..." }`
with status 400 — not `{ error: "Internal server error" }` with status 400.

## Proposed Solution

### Step 1: Create `asyncHandler` wrapper

**File:** `src/utils/async-handler.ts` (new file)

```typescript
import type { Request, Response, NextFunction } from "express";

/**
 * Wraps an async Express route handler so rejected promises
 * are forwarded to Express error middleware (required for Express v4).
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}
```

Why a utility file: follows existing pattern (`src/utils/sanitize.ts`),
reusable if more async routes are added later.

### Step 2: Wrap async routes in `src/api.ts`

Two routes need wrapping. One does not.

| Route | Async? | Has try-catch? | Wrap? | Why |
|-------|--------|----------------|-------|-----|
| `POST /api/leads/:id/approve` (line 50) | Yes | Partial (SMS only) | **Yes** | DB calls before SMS try-catch are unprotected |
| `POST /api/leads/:id/edit` (line 101) | Yes | No | **Yes** | Entire handler is unprotected |
| `POST /api/analyze` (line 228) | Yes | Full (try-catch-finally) | **No** | SSE error handling is intentional — wrapping risks double-response |

**Changes:**

```typescript
// At top of api.ts
import { asyncHandler } from "./utils/async-handler.js";

// Line 50: wrap approve handler
router.post("/api/leads/:id/approve", approveLimiter, csrfGuard, asyncHandler(async (req, res) => {
  // ... existing handler body unchanged
}));

// Line 101: wrap edit handler
router.post("/api/leads/:id/edit", csrfGuard, asyncHandler(async (req, res) => {
  // ... existing handler body unchanged
}));
```

### Step 3: Add global error middleware in `src/server.ts`

Register **after all routes** (after the root redirect on line 97, before
`app.listen` on line 99).

```typescript
import type { Request, Response, NextFunction } from "express";

// Global error handler — must be registered last, must have 4 parameters
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  // Log structured error info
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  console.error(`[ERROR] ${req.method} ${req.path}:`, message);
  if (stack) console.error(stack);

  // If response already started (e.g., SSE streaming), just close it
  if (res.headersSent) {
    res.end();
    return;
  }

  // Respect status codes set by Express middleware (e.g., 400 from JSON parse)
  const status =
    typeof (err as any).status === "number" &&
    (err as any).status >= 400 &&
    (err as any).status < 600
      ? (err as any).status
      : 500;

  // err.expose is set by http-errors (used by express.json / body-parser).
  // true for 4xx = message is safe to show (e.g., JSON parse error).
  // false/absent for 5xx = hide internals, return generic message.
  const clientMessage = (err as any).expose === true && message
    ? message
    : "Internal server error";

  res.status(status).json({ error: clientMessage });
});
```

**Key design decisions:**

1. **`res.headersSent` guard** — If the SSE endpoint somehow reaches the global
   handler after `res.flushHeaders()`, don't try to send JSON. Just close the
   connection. Prevents "Cannot set headers after they are sent" crash.
   (Identified by SpecFlow analysis.)

2. **`err.status` respect** — Express's `express.json()` sets `err.status = 400`
   on malformed JSON. Returning 500 for parse errors is misleading. Respecting
   the status code follows Express conventions. (Identified by SpecFlow.)

3. **Non-Error throw handling** — JavaScript allows throwing strings, numbers,
   etc. The `err instanceof Error` check handles both cases. (Identified by
   SpecFlow.)

4. **`err.expose`-gated client message** — For 4xx errors from Express
   middleware (e.g., `express.json()`), `err.expose` is `true` and the message
   is safe to show (it comes from Node's `JSON.parse`, not from our code). For
   5xx errors, `err.expose` is absent/false, so we return "Internal server
   error" to prevent leaking DB internals. (Refined from brainstorm based on
   Express conventions.)

5. **`_next` parameter required** — Express identifies error middleware by its
   4-parameter signature. Removing `_next` would turn it into regular
   middleware. (Express v4 convention.)

## Acceptance Criteria

- [x] Global error middleware registered last in `src/server.ts`
- [x] Unhandled sync route errors return `{ error: "Internal server error" }` with status 500
- [x] Unhandled async route errors (approve, edit) are caught and forwarded to middleware
- [x] `POST /api/analyze` is NOT wrapped — SSE error handling unchanged
- [x] `res.headersSent` guard prevents double-response crash
- [x] `err.status` respected for Express middleware errors (e.g., 400 for malformed JSON)
- [x] 400 errors return the `err.message` (via `err.expose`), NOT "Internal server error"
- [x] 500 errors return "Internal server error", never raw error details
- [x] Structured log includes method, path, error message, and stack trace
- [x] All 62 existing tests pass
- [x] No frontend changes required

## Verification Checks

These are the specific scenarios to test during the work phase:

1. **Malformed JSON → 400 with matching message.** Send a POST with invalid
   JSON body to any `express.json()`-protected route. Expect status 400 and
   `{ error: "Unexpected token..." }` (the `JSON.parse` error message), not
   `{ error: "Internal server error" }`.

2. **Wrapped async route rejection → global middleware.** Force an error in
   `/api/leads/:id/approve` or `/edit` (e.g., pass an ID that triggers a DB
   error). Expect status 500 and `{ error: "Internal server error" }`, plus a
   structured console log with method, path, and stack.

3. **SSE route handles its own failure after headers flush.** Trigger a
   pipeline error in `/api/analyze` after `res.flushHeaders()`. Expect an SSE
   `event: error` message in the stream, NOT a JSON response. The global
   middleware should NOT fire (no `[ERROR]` log line for this path).

4. **Sync routes unchanged.** Hit `GET /api/analytics` or `GET /api/leads`
   normally. Expect identical behavior to before — no extra middleware
   overhead, same response shape.

## Scope Fence

**In scope:**
- Global error middleware in `server.ts`
- `asyncHandler` wrapper in `src/utils/async-handler.ts`
- Wrapping 2 async routes in `api.ts`
- Structured `console.error` logging

**Out of scope:**
- Per-route try-catch additions (beyond asyncHandler wrapping)
- Frontend/dashboard changes
- Database layer changes
- External error reporting (Sentry, etc.)
- **404 catch-all handler** — Express returns HTML for unmatched routes. This
  is a known gap but a separate change. Do not add a 404 handler in this work.
- Request body logging (PII risk)
- Request IDs (YAGNI for single-user app)

## Stop Conditions

Stop work and re-evaluate if:

1. You find another async route handler in the named files that this plan did
   not account for. (The inventory above should be exhaustive — if it's not,
   the plan needs updating before continuing.)

2. `/api/analyze` has any post-flush code path outside its try-catch-finally.
   (Verified as of this plan review: it does not. But if the code has changed
   since, re-verify before wrapping other routes.)

## Sources

- **Origin brainstorm:** [docs/brainstorms/2026-03-08-global-error-middleware-brainstorm.md](docs/brainstorms/2026-03-08-global-error-middleware-brainstorm.md) — key decisions: global over per-route, generic client message, no DB layer changes
- **Solution doc:** [docs/solutions/architecture/railway-healthcheck-auth-middleware-ordering.md](docs/solutions/architecture/railway-healthcheck-auth-middleware-ordering.md) — middleware ordering lesson
- **Solution doc:** [docs/solutions/architecture/express-handler-boundary-validation.md](docs/solutions/architecture/express-handler-boundary-validation.md) — boundary validation patterns
- **Existing pattern:** `src/utils/sanitize.ts` — utility file convention

## Three Questions

1. **Hardest decision in this session?** Whether to wrap `/api/analyze` with
   `asyncHandler`. It is async and would benefit from the safety net, but its
   try-catch-finally pattern is intentionally designed for SSE streaming.
   Wrapping it risks double-response if the `res.headersSent` guard has a bug.
   Decided not to wrap — the existing coverage is comprehensive and the SSE
   error format is different from JSON.

2. **What did you reject, and why?** Removing the `async` keyword from
   `/api/leads/:id/edit` instead of wrapping it. Simpler fix for today, but
   fragile — if someone later adds an `await`, the protection vanishes silently.
   `asyncHandler` is defensive and costs one line.

3. **Least confident about going into the next phase?** The `err.expose` gate.
   The plan now uses `err.expose === true` to forward the raw error message for
   4xx errors (e.g., JSON parse errors from `express.json()`). This is the
   Express convention and avoids "Internal server error" on 400 responses. The
   remaining uncertainty: if a future middleware sets `err.expose = true` on a
   5xx error, the raw message would leak. This is unlikely (only `http-errors`
   sets `expose`, and it sets `false` for 5xx), but worth noting.
