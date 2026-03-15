# createApp() Factory Extraction and 404 Catch-All

**Date:** 2026-03-10
**PR:** #13 (`fix/deferred-p2-batch`)
**Category:** Architecture / Testability

## Problem

Three related issues:

1. **No JSON 404 response.** Express returned its default HTML 404 page for
   unmatched routes, inconsistent with the JSON API contract.

2. **Test duplication.** The error middleware test (`error-middleware.test.ts`)
   copy-pasted the error handler from `server.ts` instead of importing it.
   The copy omitted `console.error` logging — if the real handler changed,
   the test would pass against stale logic.

3. **Middleware order untestable.** `server.ts` had import-time side effects
   (env guards, DB init, `app.listen()`), so tests couldn't instantiate the
   real middleware stack. The 404 catch-all's correctness depends entirely on
   its placement relative to `express.static`, all routers, and the error
   handler — a unit test with a mini app couldn't verify this.

## Solution

### 1. `createApp()` factory (`src/app.ts`)

Extracted all middleware and route registration from `server.ts` into a pure
factory function. `server.ts` retains env guards, DB init, and `app.listen()`.

**Why this works:** `createApp()` has no side effects — tests call it to get
the real middleware stack without starting a server or requiring env vars.

### 2. 404 catch-all

Added after all routes and static middleware, before the error handler:

```typescript
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});
```

**Placement is the entire contract.** The catch-all is a 2-param middleware
(not an error handler), so Express runs it for any request that wasn't matched.
If it were placed before `express.static`, it would shadow CSS/JS assets.

### 3. Error handler extraction (`src/utils/error-handler.ts`)

Moved the error handler to a shared module imported by both `app.ts` and the
test file. Test no longer duplicates handler logic.

**Accepted tradeoff:** The real handler includes `console.error` logging, so
tests produce stderr output. This is noise, not a problem — the tests validate
response behavior, not log output.

## Pattern: Factory Extraction for Express Testability

When `server.ts` has import-time side effects (env checks, DB init, listen),
extract the app construction into a factory:

```
src/app.ts    → createApp(): builds middleware + routes, no side effects
src/server.ts → env guards, initDb(), createApp(), app.listen()
```

Tests call `createApp()` directly. This lets integration tests verify the
real middleware ordering without mocking.

**When to use:** Any time you need to test middleware placement, route priority,
or the interaction between middleware layers (e.g., "does the 404 catch-all
shadow static files?").

**When NOT to use:** If your tests only need to verify individual route handler
logic, a mini test app is simpler and faster.

## Pattern: Middleware Ordering as Testable Contract

Express middleware order determines behavior. The 404 catch-all test verifies
three ordering properties against the real stack:

1. `GET /nonexistent` → 404 JSON (catch-all works)
2. `GET /dashboard.css` → 200 CSS (static serving not shadowed)
3. `GET /health` → 200 JSON (existing route still works)

If someone reorders middleware in `app.ts`, these tests fail immediately.

## Risk Resolution

**Flagged risk (plan phase):** "The 404 verification relies on a manual smoke
check for real middleware ordering because `server.ts` can't be imported into
tests."

**What actually happened:** The `createApp()` extraction was pulled into the
batch specifically to close this gap. The 404 test now runs against the real
middleware stack, not a mini app.

**Lesson learned:** When a review flags a testability gap, the fix is often a
small structural extraction, not more manual testing. The `createApp()` factory
was 93 lines and zero design decisions — the code already existed, it just
needed to move.

## Three Questions

1. **Hardest pattern to extract from the fixes?** Distinguishing "middleware
   ordering as contract" from general integration testing. The insight is that
   Express middleware order IS the behavior — testing it isn't optional, it's
   the primary assertion.

2. **What did you consider documenting but left out, and why?** The analytics
   transaction error handling decision (Item 3 — no change needed). It's a
   non-change, and documenting why you didn't change something has diminishing
   returns unless it's a recurring temptation.

3. **What might future sessions miss that this solution doesn't cover?** If a
   new router module introduces import-time side effects (e.g., eagerly
   connecting to an external service), `createApp()` in tests would break.
   Current routers are all side-effect-free, but there's no enforcement
   mechanism — it would surface as a test failure, not a lint error.
