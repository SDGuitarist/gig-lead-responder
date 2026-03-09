---
title: "fix: Global Express Error Middleware"
type: fix
status: active
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

**Total:** ~30 lines across 3 files.

## What Must Not Change?

- `POST /api/analyze` — has its own try-catch-finally for SSE streaming. Do NOT
  wrap with `asyncHandler`. Its error handling is intentionally SSE-specific.
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

The `asyncHandler` wrapper is standard and well-understood. The most likely
mistake would be accidentally wrapping `/api/analyze` and breaking its SSE
error handling. The scope fence explicitly prevents this.

A subtler risk: the `POST /api/leads/:id/edit` handler is declared `async` but
contains zero `await` calls. Removing `async` would also fix it (sync handlers
are caught natively). But wrapping with `asyncHandler` is defensive — if
someone later adds an `await`, the protection stays. Worth the one-line cost.

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

  res.status(status).json({ error: "Internal server error" });
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

4. **Generic client message** — Always returns "Internal server error", never
   the raw error. Prevents leaking DB internals (table names, SQL, column names).
   (From brainstorm.)

5. **`_next` parameter required** — Express identifies error middleware by its
   4-parameter signature. Removing `_next` would turn it into regular
   middleware. (Express v4 convention.)

## Acceptance Criteria

- [ ] Global error middleware registered last in `src/server.ts`
- [ ] Unhandled sync route errors return `{ error: "Internal server error" }` with appropriate status
- [ ] Unhandled async route errors (approve, edit) are caught and forwarded to middleware
- [ ] `POST /api/analyze` is NOT wrapped — SSE error handling unchanged
- [ ] `res.headersSent` guard prevents double-response crash
- [ ] `err.status` respected for Express middleware errors (e.g., 400 for malformed JSON)
- [ ] Structured log includes method, path, error message, and stack trace
- [ ] No internal error details exposed to client
- [ ] All 62 existing tests pass
- [ ] No frontend changes required

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
- 404 catch-all handler (follow-up item)
- Request body logging (PII risk)
- Request IDs (YAGNI for single-user app)

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

3. **Least confident about going into the next phase?** The `err.status`
   handling. Returning the middleware-set status (e.g., 400) but always with
   message "Internal server error" is slightly misleading — a 400 suggests the
   client did something wrong, but the message says "server error." For this
   single-user app it's fine, but a future review might want status-appropriate
   messages (400 → "Bad request", 500 → "Internal server error").
