# Brainstorm: Global Express Error Middleware

**Date:** 2026-03-08
**Status:** Complete
**Next:** Plan

## Context

The `getAnalytics()` function in `src/db/queries.ts` runs 8 SQL queries inside
a better-sqlite3 transaction with zero error handling. The API handler in
`src/api.ts` (line 222) calls it with no try-catch. If any query throws, the
dashboard breaks with an unhandled exception.

Research revealed the problem is broader: **there is no global Express error
middleware anywhere in the app.** This means ANY unhandled throw from ANY route
returns Express's default HTML error page instead of the `{ error: string }`
JSON the dashboard expects.

### Affected routes (no try-catch on DB calls)

- `GET /api/analytics` — 8-query transaction
- `GET /api/stats` — 1 query
- `GET /api/leads` — 2 queries
- `POST /api/leads/:id/approve` — DB calls unprotected (only SMS has try-catch)
- `POST /api/leads/:id/edit` — no try-catch
- `POST /api/leads/:id/outcome` — no try-catch
- All follow-up endpoints in `follow-up-api.ts` — no try-catch

### What already works

- Dashboard `apiFetch`/`apiPost` wrappers expect `{ error: string }` JSON
- Dashboard shows "Failed to load analytics: [message]" on fetch failure
- better-sqlite3 transactions auto-rollback on throw (no manual cleanup needed)

## What We're Building

A global Express error-handling middleware in `src/server.ts` that:

1. Catches any unhandled error from any route
2. Logs the error with structured info (route path, method, error message, stack)
3. Returns `{ error: "Internal server error" }` with status 500
4. Does NOT expose internal error details to the client

## Why This Approach

- **One change fixes all routes.** Instead of adding try-catch to 10+ handlers,
  a single middleware catches everything. Follow Express conventions.
- **Zero frontend changes.** The dashboard already handles JSON error responses.
  It just wasn't getting them because Express was returning HTML on unhandled throws.
- **YAGNI on partial results.** For a single-user dashboard, "analytics failed,
  try again" is fine. Per-query error recovery adds complexity with no real benefit.

## Key Decisions

1. **Global middleware over per-route try-catch** — One place to maintain, follows
   Express's intended error handling pattern.
2. **Structured logging** — Log route path + method + error message + stack so
   production errors are debuggable.
3. **Generic client message** — Return "Internal server error" not the raw error
   message. Avoids leaking DB internals (table names, SQL, etc.).
4. **No changes to DB layer** — Database functions continue to throw on error.
   The middleware is the safety net at the boundary.

## Rejected Alternatives

- **Per-query try-catch with partial results** — Changes the API contract,
  requires frontend changes, complex for a single-user app. YAGNI.
- **Silent fallback to empty data** — Hides real problems. User should know
  when something is broken.
- **Analytics-only try-catch** — Leaves every other route unprotected. Same
  effort as the global solution but narrower coverage.

## Scope Fence

**In scope:**
- Global Express error middleware in `server.ts`
- Structured `console.error` logging

**Out of scope:**
- Per-route try-catch additions
- Frontend changes
- Database layer changes
- External error reporting (Sentry, etc.)
- Async error handling (Express v4 doesn't catch rejected promises in async
  handlers — but our DB calls are synchronous via better-sqlite3)

## Open Questions

None — all resolved during brainstorming.

## Three Questions

1. **Hardest decision in this session?** Whether to scope this to just
   analytics or go global. The research made it clear: the gap is systemic,
   not specific to analytics. One middleware fixes everything.

2. **What did you reject, and why?** Per-query try-catch with partial results
   (Approach C). It would change the API contract, require frontend changes,
   and add complexity that doesn't benefit a single-user dashboard.

3. **Least confident about going into the next phase?** Async error handling.
   Express v4 doesn't automatically catch rejected promises in async route
   handlers. Our DB calls are synchronous (better-sqlite3), but `POST /api/analyze`
   and webhook handlers are async. The plan should clarify whether we need an
   async wrapper or if existing try-catch coverage is sufficient for async routes.
