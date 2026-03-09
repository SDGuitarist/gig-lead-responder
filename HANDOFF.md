# HANDOFF — Gig Lead Responder

**Date:** 2026-03-08
**Branch:** `main`
**Phase:** Plan complete for global error middleware. Ready for plan review.

## Current State

Plan complete for global Express error middleware. No code changes yet.

- Brainstorm: `docs/brainstorms/2026-03-08-global-error-middleware-brainstorm.md`
- Plan: `docs/plans/2026-03-08-fix-global-express-error-middleware-plan.md`
- All 62 tests passing. No code changes yet.

## Current Suite

- **Total tests:** 62 (budget-gap 25, email-parser 13, enrich-generate 11, plan-gate 13)
- **Passing:** 62 | **Failing:** 0

## Key Artifacts

| Phase | Location |
|-------|----------|
| Brainstorm (error middleware) | `docs/brainstorms/2026-03-08-global-error-middleware-brainstorm.md` |
| Plan (error middleware) | `docs/plans/2026-03-08-fix-global-express-error-middleware-plan.md` |
| Plan (P3 bundle 061) | `docs/plans/2026-03-08-fix-p3-bundle-061-plan.md` |
| Review (P3 bundle 061) | `docs/reviews/p3-bundle-061/REVIEW-SUMMARY.md` |
| Solution (P3 bundle 061) | `docs/solutions/architecture/2026-03-08-p3-bundle-061-csp-migration-patterns.md` |

## Deferred Items

- **leads.ts structural split** — brainstorm+plan exist, do before next feature
- **fillMonthlyGaps relocation** — single caller, deferred
- **dashboard.html** at ~1,604 lines (JS extraction threshold: ~2,500)
- **LLM pipeline behavior** never reviewed
- **Workflow automation phase 2** — `linked_expectations` enforcement
- **404 catch-all handler** — Express returns HTML for unmatched routes (identified during plan)

## Three Questions

1. **Hardest decision in this session?** Whether to wrap `/api/analyze` with
   `asyncHandler`. It's async and would benefit from the safety net, but its
   try-catch-finally is designed for SSE streaming. Wrapping risks
   double-response. Decided not to wrap.

2. **What did you reject, and why?** Removing the `async` keyword from
   `/api/leads/:id/edit` instead of wrapping it. Simpler today, but fragile —
   if someone adds an `await` later, protection vanishes silently.

3. **Least confident about going into the next phase?** The `err.status`
   handling. Returning 400 (from `express.json()` parse errors) but with
   message "Internal server error" is slightly misleading. Fine for a
   single-user app, but a reviewer should weigh in.

### Prompt for Plan Review (Codex / External Agent)

```
Review the plan at docs/plans/2026-03-08-fix-global-express-error-middleware-plan.md
in the context of a Node.js/Express v4.21.x app (better-sqlite3 for sync DB).

Focus on these 3 risk areas flagged during planning:

1. **err.status + generic message mismatch** — The middleware respects
   err.status (e.g., 400 for malformed JSON from express.json()) but always
   returns { error: "Internal server error" }. Is a 400 with message "Internal
   server error" acceptable, or should the message vary by status class
   (4xx → "Bad request", 5xx → "Internal server error")?

2. **Decision NOT to wrap /api/analyze** — This SSE endpoint (line 228 of
   src/api.ts) is async with a comprehensive try-catch-finally. The plan
   excludes it from asyncHandler wrapping. Is there any code path where an
   error could escape the try block after res.flushHeaders()? Read src/api.ts
   lines 228-255 and verify.

3. **asyncHandler completeness** — Only 2 routes are wrapped (approve, edit).
   Are there any other async handlers in the codebase that were missed? Check
   src/api.ts, src/follow-up-api.ts, src/webhook.ts, src/twilio-webhook.ts.

Also validate:
- Does the plan pass the 4-question quality gate? (What changes / what must
  not change / how to verify / most likely failure mode)
- Is the scope fence appropriate? Any gaps?
- Is ~30 lines of change the right size, or is something missing?

Key files to read: src/server.ts, src/api.ts (lines 50-120, 228-255),
src/follow-up-api.ts, src/webhook.ts, src/twilio-webhook.ts
```

### Prompt for Next Session (after plan review)

```
Read docs/plans/2026-03-08-fix-global-express-error-middleware-plan.md and
HANDOFF.md. Apply any plan-review findings. Then run /workflows:work.
Relevant files: src/server.ts, src/api.ts, src/utils/ (new async-handler.ts).
```
