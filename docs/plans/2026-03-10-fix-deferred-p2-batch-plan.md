# Plan: Deferred P2 Batch

**Date:** 2026-03-10
**Source:** HANDOFF.md deferred items (post error-middleware cycle)
**Brainstorm:** Skipped (brainstorm skip gate — exact files, lines, acceptance criteria from prior reviews)

## Prior Phase Risk

> "Least confident about? Test duplication — the test file copies the error handler
> logic instead of importing it. If server.ts middleware changes, the test could
> pass against stale logic."

This batch directly addresses that risk (item 2 below). **Important nuance from
Codex review:** the test duplicate is not an exact copy — it omits the
`console.error` logging that `src/server.ts:104-105` performs. The extraction
must include the logging, which means tests will emit `console.error` output.
See Item 2 for how this is handled.

## Out of Scope

The following HANDOFF.md deferred items are **not** part of this batch:

- **(062) applyDataWidths contract comment** — already done (commit `e6d2be7`)
- **(063) updateLead event_type normalization** — already done (commit `29fb849`)
- **leads.ts structural split** — already effectively done (256 lines, split into 4 files)
- **Workflow automation phase 2 (`linked_expectations`)** — deferred to own brainstorm + plan cycle (Item 4 below)
- **`server.ts` testable factory extraction** — originally deferred, but pulled into this batch during work phase to close the 404 middleware-order test gap. Minimal extraction: `src/app.ts` exports `createApp()` with all middleware; `server.ts` retains env guards, DB init, and listen. See Item 1 verification update below.

---

## Scope

Four deferred items evaluated. Two need code changes, two are resolved/deferred.

### Item 1: 404 Catch-All Handler

**What's changing:** Add a catch-all route in `src/server.ts` that returns
`{ error: "Not found" }` with status 404. Currently Express returns its default
HTML 404 page, which is inconsistent with the JSON API.

**Placement:** After `express.static()` (line 78), after all `app.use(router)`
calls (lines 81-90), after the root redirect (line 96-98), and BEFORE the global
error handler (line 100). This ensures:
- Static assets (`/dashboard.html`, `/dashboard.css`, etc.) are still served by `express.static`
- All router-mounted routes are still matched first
- The error handler still catches thrown errors (catch-all is a normal middleware, not an error handler)

**File:** `src/server.ts` (insert between root redirect at line 98 and error handler at line 100)

**Implementation:**
```typescript
// 404 catch-all — after all routes, before error handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});
```

**What must not change:**
- Existing route registrations and their order
- Static file serving (`/dashboard.html`, `/dashboard.css`, and other assets in `public/`)
- Error handler still catches errors thrown by route handlers

**Verification (updated — factory extraction pulled into this batch):**

The `createApp()` factory extraction (originally deferred) was pulled into this
batch because the review finding specifically required testing the real middleware
order, not a mini app. The extraction was minimal: `src/app.ts` exports
`createApp()` with all middleware and routes; `server.ts` retains env guards, DB
init, and `app.listen()`. No router modules have import-time side effects, so
tests can instantiate the real stack safely.

1. **Automated (integration-level):** One test in `src/error-middleware.test.ts`
   calls `createApp()` from `src/app.ts` and verifies against the real middleware
   stack:
   - `GET /nonexistent` → 404 JSON (`{ "error": "Not found" }`)
   - `GET /dashboard.css` → 200 CSS (static serving not shadowed by catch-all)
   - `GET /health` → 200 JSON (existing route still works)

   This exercises the actual middleware order from `app.ts`, closing the gap the
   mini-app test had.

2. **Manual smoke check (still recommended before merge):** The automated test
   covers the critical ordering scenarios, but a quick `curl` check against the
   dev server confirms the full production path including env guards and DB init:
   - `GET /` → 302 redirect to `/dashboard.html`
   - `GET /dashboard.html` → 200 HTML (nonce injection + static serving)

---

### Item 2: Extract Error Handler to Shared Module

**What's changing:** Extract the error handler function from `src/server.ts` into
`src/utils/error-handler.ts` so the test file imports the real handler instead of
duplicating it. Eliminates the test sync risk.

**Logging difference:** The production handler in `server.ts:101-105` includes
`console.error` logging. The test duplicate at `error-middleware.test.ts:12-33`
omits this. The shared module will include the logging (it's part of the real
handler behavior). **Decision: accept noisy test output.** Stubbing
`console.error` adds test complexity for no safety benefit — the tests are
validating response behavior, not log output. If test noise becomes a problem
later, a `--silent` test runner flag or stderr redirect is the right fix.

**Files:**
- New: `src/utils/error-handler.ts` (extract the full handler including logging)
- Edit: `src/server.ts` (import from new module)
- Edit: `src/error-middleware.test.ts` (import from new module, delete duplicate)

**Implementation:**

`src/utils/error-handler.ts`:
```typescript
import type { Request, Response, NextFunction } from "express";

/**
 * Global Express error handler. Registered last in server.ts.
 * Must have 4 parameters for Express to recognize it as error middleware.
 */
export const errorHandler = (err: unknown, req: Request, res: Response, _next: NextFunction) => {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  console.error(`[ERROR] ${req.method} ${req.path}:`, message);
  if (stack) console.error(stack);

  if (res.headersSent) {
    res.end();
    return;
  }

  const status =
    typeof (err as any).status === "number" &&
    (err as any).status >= 400 &&
    (err as any).status < 600
      ? (err as any).status
      : 500;

  const clientMessage =
    status >= 400 && status < 500 && (err as any).expose === true && message
      ? message
      : "Internal server error";

  res.status(status).json({ error: clientMessage });
};
```

**What must not change:** The handler's response behavior (status codes, JSON
shape, expose gating). Test assertions must pass without modification.

**Acceptance criteria:**
- `src/error-middleware.test.ts` imports from `./utils/error-handler.js`
- No duplicated handler logic in the test file
- All existing error middleware tests pass
- All existing tests pass

---

### Item 3: Analytics Transaction Error Handling

**Decision: No change needed. No edits to `src/db/queries.ts` in this batch.**

**Reasoning:** `getAnalytics()` at `src/db/queries.ts:109` uses `db.transaction()`
with 8 synchronous, read-only queries via `stmt()`. Any thrown error propagates
synchronously up the call stack to the Express route handler at `src/api.ts:224`
(`res.json(getAnalytics())`), which is covered by the global error middleware
added in PR #12. Adding try-catch inside `getAnalytics()` would be redundant.

**Assumption:** `getAnalytics()` is only called from Express request paths where
the global error middleware is present. Confirmed: the only caller is
`src/api.ts:224`, which is behind `apiRouter` mounted on the Express app.

---

### Item 4: Workflow Automation Phase 2 — `linked_expectations` Enforcement

**Decision: Defer.** The `linked_expectations` field exists in the plan gate
schema (`src/plan-gate.ts:23`) and is validated as an array, but its entries are
never enforced. This is a feature requiring design decisions (format, resolution,
pass criteria), not a mechanical fix. Needs its own brainstorm + plan cycle.

**No edits to `src/plan-gate.ts` in this batch.**

---

## Plan Quality Gate

1. **What exactly is changing?** Two things: (a) 404 catch-all route in server.ts
   placed after static middleware and all routes, before the error handler; (b)
   error handler extracted to `src/utils/error-handler.ts` and imported by both
   server.ts and the test file.
2. **What must not change?** Error handler response behavior. Existing route
   registration order. Static file serving (`/dashboard.html`, `/dashboard.css`).
   Test assertions. No edits to `src/db/queries.ts` or `src/plan-gate.ts`.
3. **How will we know it worked?** All existing tests pass, plus one new 404
   integration test using `createApp()`. Test file no longer duplicates handler
   logic. Real middleware ordering verified automatically (404, static CSS,
   healthcheck) plus optional manual smoke check for full production path.
4. **Most likely way this plan is wrong?** Three failure modes: (a) 404 catch-all
   placed before static middleware would break asset serving — mitigated by
   explicit placement rule and automated integration test; (b) importing the real
   error handler into tests introduces `console.error` output — accepted as
   conscious tradeoff; (c) a future router adds import-time side effects that
   break `createApp()` in tests — low risk, would surface immediately as test
   failure. (Original risk (c) — unit test passes but real ordering wrong — is
   now closed by the `createApp()` extraction.)

## Feed-Forward

```yaml
feed_forward:
  risk: "404 catch-all placement relative to static middleware and routers; test logging noise from shared error handler"
  verify_first: true
```

## Three Questions

1. **Hardest decision in this session?** Deciding items 3 and 4 don't need code
   changes. Item 3 is already handled by the error middleware, and item 4 needs
   its own design cycle.
2. **What did you reject, and why?** (a) Adding try-catch inside `getAnalytics()`
   — redundant with the global error handler. (b) Stubbing `console.error` in
   tests — adds complexity for no safety benefit; noisy output is acceptable.
   (c) Wrapping analytics with `runTransaction()` — adds async guards not needed
   for synchronous queries.
3. **Least confident about going into the next phase?** The 404 verification
   relies on a manual smoke check for real middleware ordering because `server.ts`
   can't be imported into tests. The unit test proves the catch-all logic works
   but not its placement. This is honest but leaves a gap that only closes when
   `server.ts` is refactored into a testable factory (deferred).
