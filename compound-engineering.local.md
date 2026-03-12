# Review Context — Gig Lead Responder

## Risk Chain

**Brainstorm risk:** Skipped (brainstorm skip gate — inputs from prior review with exact files/lines/acceptance criteria)

**Plan mitigation:** Four deferred items evaluated. Two needed code, two resolved/deferred. 404 placement specified exactly (after static, after all routers, before error handler). Error handler extraction eliminates test sync risk.

**Work risk (from Feed-Forward):** "404 catch-all placement relative to static middleware and routers; test logging noise from shared error handler"

**Review resolution:** PR #13 merged. `createApp()` factory extraction pulled into batch to close testability gap flagged in plan. Integration test verifies real middleware ordering (404, static CSS, healthcheck). Test logging noise accepted as conscious tradeoff.

**Compound resolution:** Solution doc written. Two patterns documented: factory extraction for Express testability, middleware ordering as testable contract.

## Files to Scrutinize

| File | What changed | Risk area |
|------|-------------|-----------|
| `src/app.ts` | New — `createApp()` factory with all middleware + routes | Side-effect-free constraint — if a future router adds import-time effects, tests break |
| `src/server.ts` | Simplified to env guards + DB init + `createApp()` + listen | Must stay thin — no middleware registration here |
| `src/utils/error-handler.ts` | New — extracted error handler shared by app.ts and tests | Single source of truth — no duplicates allowed |
| `src/error-middleware.test.ts` | Imports shared handler + uses `createApp()` for 404 test | Tests real middleware order, not mini app |

## Remaining Gaps (carried forward)

- `linked_expectations` field reserved but not enforced — needs own brainstorm+plan
- LLM pipeline behavior never reviewed (prompt injection resilience)
- Accessibility never reviewed
- `npm audit` never run
- Side-effect-free router constraint has no lint enforcement

## Plan Reference

`docs/plans/2026-03-10-fix-deferred-p2-batch-plan.md`
