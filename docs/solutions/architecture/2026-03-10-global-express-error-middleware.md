---
title: "Global Express Error Middleware + asyncHandler"
date: 2026-03-10
tags: [express, error-handling, middleware, async]
origin: docs/plans/2026-03-08-fix-global-express-error-middleware-plan.md
---

# Global Express Error Middleware + asyncHandler

## Problem

No global error-handling middleware existed. When any route handler threw an
unhandled error, Express returned its default HTML error page instead of
`{ error: string }` JSON. The dashboard expects JSON errors and couldn't
display them.

Additionally, Express v4 doesn't catch rejected promises from `async` route
handlers — they silently crash the process.

## Solution

Three changes, ~30 lines of production code:

1. **`src/utils/async-handler.ts`** — Wraps async handlers so `.catch(next)`
   forwards rejections to Express error middleware.

2. **`src/api.ts`** — Wrapped 2 async routes (`POST /approve`, `POST /edit`)
   with `asyncHandler`. Did NOT wrap `/api/analyze` — its try-catch-finally is
   intentionally designed for SSE streaming.

3. **`src/server.ts`** — Global error middleware registered last (4 params).
   Features:
   - `res.headersSent` guard — if SSE headers already flushed, just `res.end()`
   - `err.status` respected for Express middleware errors (e.g., 400 JSON parse)
   - `err.expose` gated to 4xx only — 5xx always returns "Internal server error"
   - Structured `console.error` with method, path, message, stack

## Key Decisions

### Why not wrap `/api/analyze`?

Once `res.flushHeaders()` sends status + headers, you can't change the status
code or switch to JSON. SSE errors must be sent as `event: error` in the
stream. Wrapping with `asyncHandler` risks double-response if the
`res.headersSent` guard has a bug. The existing try-catch-finally covers all
post-flush code paths.

### Why gate `err.expose` to 4xx only?

`http-errors` (used by `express.json()`) sets `err.expose = true` for 4xx and
`false` for 5xx. But if a future middleware incorrectly sets `expose = true` on
a 5xx, the raw error message would leak. The `status < 500` check is a safety
net that costs nothing.

### Why keep `async` on `/api/leads/:id/edit`?

The handler has zero `await` calls — removing `async` would also fix the
problem (sync handlers are caught natively). But if someone later adds an
`await`, the protection vanishes silently. `asyncHandler` is defensive and
costs one line.

## Risk Resolution

**Flagged risk (from plan Feed-Forward):** "If a future middleware sets
`err.expose = true` on a 5xx error, the raw message would leak."

**What actually happened:** Added `status >= 400 && status < 500` gate so
`err.expose` is only honored for 4xx. Test explicitly verifies a 5xx with
`expose = true` still returns "Internal server error".

**Lesson:** When using convention-based flags like `err.expose`, always add a
hard gate for the dangerous direction. Conventions are suggestions — code is
enforcement.

## Patterns to Reuse

1. **asyncHandler wrapper** — Use for any new `async` Express v4 route handler.
   Not needed once migrating to Express v5 (catches promises natively).

2. **4-param error middleware registered last** — Express identifies error
   handlers by the 4-parameter signature `(err, req, res, next)`. Removing any
   parameter (even unused `_next`) breaks it.

3. **`res.headersSent` guard** — Always check before sending error responses in
   global middleware. SSE and streaming routes may have already started
   responding.

## Files Changed

| File | Change |
|------|--------|
| `src/server.ts` | Global error middleware (lines 100-130) |
| `src/utils/async-handler.ts` | New — 13-line wrapper |
| `src/api.ts` | 2 routes wrapped with asyncHandler |
| `src/error-middleware.test.ts` | New — 6 tests |
