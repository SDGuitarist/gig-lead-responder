# Review Context — Gig Lead Responder

## Risk Chain

**Brainstorm risk:** "Whether bidirectional enforcement ('if any → all') is too strict for edge cases where touching one file in a pair doesn't require touching the other."

**Plan mitigation:** Enforcement is opt-in per plan — authors omit pairs they don't want enforced. Bidirectional accepted for v1; upgrade to directed deps if friction appears.

**Work risk (from Feed-Forward):** "Reason suffix in error messages is a new pattern with no length cap on user-provided text."

**Review resolution:** 0 P1, 0 P2, 6 P3 (4 pre-existing) from 6 agents. All P3s accepted or deferred. PR merged without fixes.

**Compound resolution:** Solution doc written. Four patterns documented: shape-before-semantic ordering, YAGNI on error enhancement, opt-in bidirectional enforcement, migration boundary tests.

## Files to Scrutinize

| File | What changed | Risk area |
|------|-------------|-----------|
| `src/plan-gate.ts` | LinkedExpectation type + shape/cross-field validation | Shape validation insertion point is load-bearing (must be before early return) |
| `src/plan-gate.test.ts` | 6 new tests for linked expectations | Old-format migration test guards insertion ordering |
| `docs/workflow-templates.md` | Updated template + field description | Pass-through semantics must be documented |

## Remaining Gaps (carried forward)

- `linked_expectations` git diff enforcement — plan-time only, no post-work verification
- `linked_expectations` global registry — 15+ real pairs, per-plan only for now
- LLM pipeline behavior never reviewed (prompt injection resilience)
- Accessibility never reviewed
- `npm audit` never run
- Side-effect-free router constraint has no lint enforcement
- External Basic Auth POST clients unverified — deployment verification needed
- Production log detail sufficiency unverified after genericization
- plan-gate P3 bundle: GateResult name collision, setup/teardown pattern, null-as-unknown cast, --json flag, type exports

## Plan Reference

`docs/plans/2026-03-15-feat-linked-expectations-enforcement-plan.md`
