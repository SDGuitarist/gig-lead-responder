# HANDOFF — Gig Lead Responder

**Date:** 2026-03-15
**Branch:** `main`
**Phase:** Brainstorm complete. Ready for Plan phase.

## Current State

Brainstorm for `linked_expectations` enforcement complete (commit c2036f7).
Decided on: named pairs with reason (`{ files, reason }`), plan-time
validation only (no git diff enforcement), per-plan definitions (no global
registry). 75 tests pass, 0 failures.

## Key Artifacts

| Phase | Location |
|-------|----------|
| Brainstorm | `docs/brainstorms/2026-03-15-linked-expectations-enforcement-brainstorm.md` |

## Deferred Items

- **LLM pipeline review** — prompt injection resilience never deeply reviewed
- **Accessibility review** — never reviewed
- **`npm audit`** — never run
- **Side-effect-free router constraint** — no lint enforcement (would surface as test failure)
- **External Basic Auth POST client verification** — rollout risk: unverified locally, needs deployment test
- **Production log detail sufficiency** — genericized server logs may lack detail during incidents
- **Legacy `public/index.html` deletion** — file still exists, retired via redirect only

## Three Questions

1. **Hardest decision in this session?** Entry format — simple pairs vs named
   pairs vs directed dependencies. Named pairs (Option B) hit the sweet spot:
   self-documenting errors without graph complexity.

2. **What did you reject, and why?** Global registry file — right long-term
   but premature for 3-5 known pairs. Also directed dependencies (source →
   dependents) — adds complexity we don't have concrete cases for yet.

3. **Least confident about going into the next phase?** Whether bidirectional
   enforcement ("if any file in group is in allowed_paths, all must be") is
   too strict for edge cases. Mitigated by opt-in per plan — authors skip
   pairs they don't want enforced.

## Prompt for Next Session

```
Read docs/brainstorms/2026-03-15-linked-expectations-enforcement-brainstorm.md.
Plan the implementation of linked_expectations enforcement in plan-gate.ts.
Key files: src/plan-gate.ts, src/plan-gate.test.ts, docs/workflow-templates.md.
Prior risk: bidirectional enforcement may be too strict for edge cases — address
in the plan's "most likely way this plan is wrong" section.
```
