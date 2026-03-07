# HANDOFF -- Gig Lead Responder

**Date:** 2026-03-07
**Branch:** `main`
**Phase:** Plan (test failure fixes) deepened. Next: Work.

## Current Suite

- **Total tests:** 48 (budget-gap 25, email-parser 12, enrich-generate 11)
- **Passing:** 37 | **Failing:** 11 (8 budget-gap + 3 email-parser)

## Current Priority

- Goal: fix the 11 pre-existing test failures (8 budget-gap, 3 email-parser).
- Stop condition (work): 49/49 tests pass (48 existing + 1 new ReDoS
  regression test), 2 commits landed.
- Read next: `docs/plans/2026-03-07-test-failure-fixes.md`

## What Was Done This Session

### Brainstorm (prior session)
- Traced all 11 failures to root cause via static analysis
- Wrote brainstorm doc with two failure groups, investigation order, rejected options

### Plan (prior session + revised this session)
- Traced all 8 budget-gap tests through `findScopedAlternative()` with current rates.ts values
- Identified that 3 near-miss tests need updated inputs (not just assertions) to preserve coverage
- Two commits planned: (1) email-parser regex + ReDoS regression test, (2) budget-gap test expectations

### Plan Revision (prior review pass)
1. Clarified budget-gap test identity: hybrid design (gap tiers = pure unit
   test, scope-down = integration test against rates.ts)
2. Updated test comments to distinguish synthetic `floor` param from
   rates.ts-dependent scope-down floors; added "(rates.ts)" tag convention
3. Added ReDoS regression test as concrete guardrail for low-confidence
   email-parser regex change (replaces "low-confidence note" with a test that
   locks the security property)
4. Corrected all test counts: 48 total (not 51), 37 pass (not 40), target
   49/49 after fix (48 + 1 new)
5. Verified test count per file: budget-gap 25, email-parser 12,
   enrich-generate 11

### Plan Deepening (this session)
1. Independently re-traced the proposed new inputs for budget-gap tests 5, 6,
   and 7 through `findScopedAlternative()` using current Solo rates:
   confirmed expected results stay `large` with alt prices `650`, `550`, and
   `550`
2. Decided not to add a second malicious regex input for the new EVENT DATE
   pattern; documented why the new pattern has no nested or overlapping
   quantifiers that would create exponential backtracking
3. Closed the near-miss boundary gap without increasing suite count: reused
   the existing passing boundary test as the current-rate exact-tolerance fail
   case (`detectBudgetGap(475, 650, "solo", 2, "T2D")` → `no_viable_scope`)
4. Audited the 17 currently-passing budget-gap tests and added five
   comment-only fixes to the plan for stale Solo-rate references
5. Updated the plan’s acceptance criteria, commit guidance, and changed-files
   summary to reflect the deeper review

### Key Decisions

**Budget-gap test identity:** Tests are hybrid — gap-tier classification is a
pure unit test (floor is a synthetic param), but scope-down is an integration
test against rates.ts. Comments must not claim synthetic floors match rates.ts.
Scope-down expectations must match current rates.ts. Tagged with "(rates.ts)".

**Near-miss test inputs:** Tests 5-7 all become `no_viable_scope` with current
rates if only assertions are updated. Updated inputs instead so near-miss
tolerance feature retains passing test coverage.

**Email-parser guardrail:** ReDoS regression test added (Step 1b). Uses the
malicious input from the March 5 security review (10,000 `<td` repetitions).
Locks the non-backtracking property regardless of fixture accuracy.

**Near-miss boundary coverage:** Reuse the existing exact-tolerance fail test
instead of adding a brand-new 50th test. This keeps the planned suite count at
49 while covering both current-rate boundary directions: just-barely-pass and
exact-tolerance fail.

**Arithmetic verification:** The proposed inputs for tests 5-7 were checked
directly against the current `detectBudgetGap()` implementation after tracing
the helper logic by hand. Remaining arithmetic uncertainty is now removed from
the plan.

**Passing comment cleanup:** Passing budget-gap tests still carried stale Solo
rate comments even when their assertions passed. The plan now calls out five
comment-only fixes so the work phase does not leave misleading docs in the
test file.

**Write-time normalization:** Confirmed unrelated to both failure groups.

## Key Artifacts

| Phase | Location |
|-------|----------|
| Brainstorm (test failures) | `docs/brainstorms/2026-03-07-test-failure-investigation-brainstorm.md` |
| Plan (test failures) | `docs/plans/2026-03-07-test-failure-fixes.md` |
| Brainstorm (dashboard) | `docs/brainstorms/2026-03-05-lead-analytics-dashboard-brainstorm.md` |
| Plan (dashboard) | `docs/plans/2026-03-05-feat-lead-analytics-dashboard-plan.md` |
| Review (Cycle 15) | `docs/reviews/cycle-15/REVIEW-SUMMARY.md` |
| Review (email-parser security) | `docs/reviews/email-parser-security/REVIEW-SUMMARY.md` |
| Solution (Cycle 15) | `docs/solutions/logic-errors/2026-03-06-dashboard-defensive-patterns-normalization-and-loop-guards.md` |

## Deferred Items

**From Cycle 15 review:**
- 061 -- Deferred P3 bundle (CSS newline, Cache-Control, fillMonthlyGaps location, stale data, CSP)

**From prior cycles (still open):**
- 023 -- XSS unescaped LLM values (pre-existing P1)
- 024 -- No input size guard webhook/LLM (pre-existing P1)
- 025 -- Prompt injection chain (pre-existing P1)
- Analytics transaction error handling -- untested failure paths

**Structural debt:**
- dashboard.html at 1,596 lines (JS extraction threshold: ~2,500)
- leads.ts structural split (brainstorm+plan exist)
- LLM pipeline behavior never reviewed

## Three Questions

1. **Hardest decision in this session?** Whether to add a brand-new
   current-rate exact-tolerance fail test or repurpose the existing passing
   boundary test. Chose to repurpose the existing test so near-miss coverage
   improves without changing the planned suite count.

2. **What did you reject, and why?** (a) Adding a second malicious regex
   payload for the new EVENT DATE pattern. Rejected because the pattern has no
   nested or overlapping quantifiers, so a second crafted string would not add
   meaningful coverage. (b) Leaving the old passing near-miss boundary test as
   comment-only. Rejected because it no longer exercised the current-rate
   exact-tolerance edge. (c) Leaving stale Solo-rate comments in passing tests.
   Rejected because they would keep the test file misleading even after the
   assertions were fixed.

3. **Least confident about going into the next phase?** The real Bash HTML
   structure is still unverified. The regression test protects against ReDoS,
   and the arithmetic for budget-gap tests is now independently verified, but
   the `</td><td>` fixture shape is still an assumption until a live sample is
   seen.

## Feed-Forward

- **Hardest decision:** Reuse existing boundary test vs. add a new one
- **Rejected alternatives:** Second malicious regex input, leaving stale passing comments, adding a 50th boundary test
- **Least confident:** Real Bash HTML structure for the EVENT DATE cell boundary

### Prompt for Next Session (Work)

```
Read HANDOFF.md, CLAUDE.md, and docs/plans/2026-03-07-test-failure-fixes.md.
Implement the plan in commit order.

Relevant files:
- src/email-parser.ts
- src/email-parser.test.ts
- src/budget-gap.test.ts

Required checks:
- npm test -- --test-name-pattern='parseEmail'
- npm test -- --test-name-pattern='detectBudgetGap'
- npm test

Important constraints:
- Preserve the March 5 security hardening; keep the EVENT DATE pattern non-backtracking.
- Add exactly one new parseEmail ReDoS regression test.
- Keep the planned suite target at 49/49.
- Update the existing near-miss boundary test to the current-rate exact-tolerance fail case instead of adding a new budget-gap test.
- Fix the five stale comments called out in the plan.
- If real Bash HTML evidence appears to contradict the fixture, stop and document it before broadening the parser change.

Stop when:
- both commits are made
- all 49 tests pass
- HANDOFF.md is updated for the work phase
```
