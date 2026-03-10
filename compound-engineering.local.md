# Review Context — Gig Lead Responder

## Risk Chain

**Brainstorm risk:** "Async error handling. Express v4 doesn't automatically catch rejected promises in async route handlers. Our DB calls are synchronous (better-sqlite3), but POST /api/analyze and webhook handlers are async."

**Plan mitigation:** Full async-route inventory across 4 files. 2 routes need wrapping. `/api/analyze` self-handled (SSE). `asyncHandler` wrapper created.

**Work risk (from Feed-Forward):** "If a future middleware sets `err.expose = true` on a 5xx error, the raw message would leak."

**Review resolution:** 0 P1, 0 P2, 2 P3 from in-conversation review. Feed-Forward risk fully addressed — `err.expose` gated to 4xx only with explicit test. P3-1: test duplicates error handler (sync risk). P3-2: no test for non-Error throws.

**Compound resolution:** Solution doc written. Risk chain closed — 4xx-only expose gate + test.

## Files to Scrutinize

| File | What changed | Risk area |
|------|-------------|-----------|
| `src/server.ts` | Global error middleware (lines 100-130) | Must stay registered last, 4-param signature required |
| `src/utils/async-handler.ts` | New — asyncHandler wrapper | Must be used on all future async routes |
| `src/api.ts` | 2 routes wrapped with asyncHandler | `/api/analyze` intentionally NOT wrapped |
| `src/error-middleware.test.ts` | New — 6 tests, duplicated error handler | Must stay in sync with server.ts middleware |

## Remaining Gaps (carried forward)

- `linked_expectations` field reserved but not enforced — Phase 2 work
- Analytics transaction error handling (8 queries, what if one throws?)
- LLM pipeline behavior never reviewed (prompt injection resilience)
- Accessibility never reviewed
- `npm audit` never run
- P2 follow-ups: applyDataWidths contract comment (062), updateLead event_type normalization (063)
- leads.ts structural split (brainstorm+plan exist)
- 404 catch-all handler (Express returns HTML for unmatched routes)
- Test file duplicates error handler logic (sync risk if middleware changes)

## Plan Reference

`docs/plans/2026-03-08-fix-global-express-error-middleware-plan.md`
