---
status: pending
priority: p2
issue_id: "087"
tags: [roadmap, measurement, draft-quality, module-1-gate]
dependencies: []
unblocks: ["Module 1 start decision"]
sub_priority: 1
---

# 087: Define and score "done enough" for draft quality before Module 1

## Problem Statement

Phase 0 has absorbed weeks of draft-quality work (pricing, venue history, COI, T4 reference, clarification, vague-lead
quote, lead_words). Each cycle has its own pre-registered measurement, but nothing says what level of draft quality
lets Module 1 start. Without a bar, the next defect always looks like a reason to keep going, and the roadmap's Phase 0
exit has no test. This is the question "when is it done enough" asked in the 2026-10-14 session.

## What exists today (do not rebuild)

- Per-cycle measurement scripts: `scripts/clarification-measure.ts`, `scripts/classifier-regression.ts --compare`
  (`src/regression-compare.ts`), `scripts/vague-gate-controls.ts`, `src/route-metrics.ts`, `src/gate-pairing.ts`.
- The roadmap's own success measures (win rate above the 0.6 baseline at 3 months, 80% of GigSalad leads answered within
  1 hour) are Module-level outcomes, not Phase 0 exit criteria.
- The port manifest gate: Module 1 cannot go live with any `UNREVIEWED` or `BLOCKED` row.

## Proposed approach (a plan to write, not a decision)

1. List the lead types the pipeline meets (the 7 regression leads, the 10 made-up vague leads, the venue and COI cases)
   and, for each, the failures that must be zero versus the ones allowed (a false pass is the harm; a false hold is not).
2. Pick a fixed scoring set of real past leads (the port manifest and `baseline.md` are the source) and score drafts on
   a rubric Alex reads: sendable as is, sendable after a small edit, not sendable.
3. State the exit as numbers fixed BEFORE the run (for example: at least N of 20 review-only ramp leads sendable with
   at most one edit, zero wrong prices, zero missing COI or payment sentence).
4. Name who runs it and when: the 20-lead review-only ramp in Module 1 is the natural scoring run; decide whether
   anything must pass BEFORE the ramp starts.

## Acceptance

- A plan in `docs/plans/` with the rubric, the set, the numbers and the owner, reviewed by Codex.
- `docs/END-TO-END-STATUS.md` names the exit criterion on its Phase 0 table.

## Owner and trigger

Alex decides the bar; Claude drafts the plan. Trigger: before Module 1's plan review starts.
