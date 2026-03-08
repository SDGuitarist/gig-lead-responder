---
title: "Fix 11 Pre-Existing Test Failures (Email-Parser Regex + Budget-Gap Expectations)"
date: 2026-03-07
category: test-failures
problem_type: stale-test-expectations-and-overly-restrictive-regex
components:
  - src/email-parser.ts
  - src/email-parser.test.ts
  - src/budget-gap.test.ts
symptoms:
  - "3 email-parser tests failing: EVENT DATE regex cannot cross </td><td> cell boundary"
  - "8 budget-gap tests failing: scope-down expectations reference stale rate values from rates.ts"
  - "11 of 48 tests failing (37 passing) — pre-existing since before Cycle 15"
root_causes:
  - "March 5 ReDoS hardening replaced .*? with [^<]* in EVENT DATE regex, but [^<]* cannot cross the </td><td> boundary between label and value cells in The Bash HTML"
  - "Solo rate floors in src/data/rates.ts increased since budget-gap tests were written (e.g., 1hr T2D: 450->550, 2hr T2P: 400->550), causing findScopedAlternative() to return different results than test expectations"
commits:
  - a0a947e
  - 23ee092
related_cycles:
  - "Cycle 15 (not causal — confirmed unrelated to write-time normalization)"
  - "March 5 security hardening (ReDoS fix that introduced the email-parser regression)"
tags:
  - regex
  - ReDoS
  - rate-table-drift
  - scope-down
  - near-miss-tolerance
  - security-hardening-regression
  - test-maintenance
---

# Fix 11 Pre-Existing Test Failures

## Problem

**Group A (8 failures in `budget-gap.test.ts`):** Tests for `detectBudgetGap()`
scope-down behavior were failing because `findScopedAlternative()` reads live
values from `src/data/rates.ts`. Solo rate floors had increased since the tests
were written (e.g., Solo 1hr T2D: 450 to 550, Solo 2hr T2P: 400 to 550), so
expected `alt.price` values and tier outcomes no longer matched reality.

**Group B (3 failures in `email-parser.test.ts`):** The March 5 ReDoS security
hardening replaced `.*?` with `[^<]*` in the EVENT DATE regex. But in the HTML
structure, `EVENT DATE:` sits in its own `<td>` cell and the date value is in
the *next* `<td>`. The `[^<]*` quantifier cannot cross the `</td><td>` boundary,
so the regex stopped matching entirely.

## Root Cause

**Group A:** The budget-gap tests are integration tests by design —
`findScopedAlternative()` intentionally queries the real rate table. When rate
values were updated in `rates.ts`, the scope-down lookup returned different
floor prices. Three tests that previously found a viable scope-down alternative
now returned `no_viable_scope` because the higher floors exceeded the near-miss
tolerance (budget + $75).

**Group B:** The regex `/EVENT DATE:[^<]*<td[^>]*>([^<]*)<\/td>/is` expected the
date value after `EVENT DATE:` with only non-`<` characters between them. But
the HTML is `<td>EVENT DATE:</td><td>Saturday, February 28, 2026</td>` — after
`EVENT DATE:`, the next characters are `</td><td>`, which contain `<` and cannot
be consumed by `[^<]*`.

## Solution

**Group B fix (runtime — commit a0a947e):** One regex on line 123 of
`src/email-parser.ts`:

```
Before: /EVENT DATE:[^<]*<td[^>]*>([^<]*)<\/td>/is
After:  /EVENT DATE:<\/td>\s*<td[^>]*>([^<]*)<\/td>/is
```

Explicitly matches the `</td>` closing tag and `<td>` opening tag. Every segment
uses literal strings, `[^<]*`, or `[^>]*` — no nested quantifiers, no
backtracking risk. A ReDoS regression test feeds 10,000 repeated `<td` strings
and asserts `parse_error` without hanging.

**Group A fix (test-only — commit 23ee092):** Updated all 8 failing test
expectations to match current `rates.ts` values. Three tests needed new inputs
to keep exercising their original intent (e.g., test 5 "price is floor, not
anchor" changed from `detectBudgetGap(550, 700, ...)` to
`detectBudgetGap(600, 700, ...)` so scope-down still succeeds). The existing
boundary test was refreshed to exercise the current-rate exact-tolerance edge
($475 + $75 = $550 = floor, so scope-down fails by exactly $0). Six passing
tests got comment-only fixes removing stale rate references. All scope-down
floor references now include "(rates.ts)" for searchability.

## Verification

- `npm test -- --test-name-pattern='parseEmail'` — 13/13 pass
- `npm test -- --test-name-pattern='detectBudgetGap'` — 25/25 pass
- `npm test` — 49/49 pass, 0 failures
- No changes to `src/pipeline/price.ts` or `src/data/rates.ts`
- Codex review of both commits: no code fixes needed

## Risk Resolution

**What was flagged:** "Fixture accuracy for the `</td><td>` boundary remains an
assumption." — Plan feed-forward risk

**What actually happened:** No real Bash HTML sample was found in the project.
The `</td><td>` structure is modeled on confirmed format but remains unverified
against a live email. Codex review found no issues.

**Lesson learned:** When fixing regex patterns for third-party HTML, separate
the *security property* (non-backtracking) from the *correctness property*
(matches real input). The ReDoS regression test locks the security property
permanently — it passes regardless of fixture accuracy. If a real Bash email
later reveals a different structure, only the regex and fixture need updating;
the regression test still guards against backtracking. Tag unverified fixtures
with a dated comment so future maintainers know the assumption.

## Prevention Patterns

1. **Tag dependent expectations.** Any test asserting a value from a shared data
   file must include a comment citing the source — e.g., `// (rates.ts)`. Before
   committing a data-file change, grep for the tag and update every hit.
2. **Regex hardening needs boundary tests.** When tightening a regex for
   security, add a test for every real-world input format it must still match —
   especially multi-element boundaries like `</td><td>`. Security fixes that
   skip integration-level assertions create silent regressions.

## Detection

- **Rate changes:** `grep -rn "(rates.ts)" src/*.test.ts` — if the diff touches
  `rates.ts` and this grep has hits, flag for review.
- **Regex changes:** Any PR modifying a regex in a parser file must include at
  least one test with input that crosses a structural boundary.

## Key Takeaways

- **Stale expectations:** Tests coupled to live data need traceable breadcrumbs
  back to their source so changes propagate.
- **Over-restrictive regex:** Every regex hardening is a potential feature
  regression — pair the security test with a boundary-crossing integration test.

## Cross-References

- [Email-parser security review](../../reviews/email-parser-security/REVIEW-SUMMARY.md) — the review that produced the March 5 ReDoS hardening
- [Cycle 3 security hardening](../architecture/review-fix-cycle-3-security-hardening.md) — sanitization patterns extended by these fixes
- [Cycle 4 hardening and cleanup](../architecture/review-fix-cycle-4-hardening-and-cleanup.md) — prior regex/security precedent
- [Cycle 12 full-codebase hardening](../architecture/review-fix-cycle-12-full-codebase-hardening.md) — webhook hardening context
- [Plan: Fix 11 Pre-Existing Test Failures](../../plans/2026-03-07-test-failure-fixes.md) — full arithmetic traces and decision rationale

## Three Questions

1. **Hardest pattern to extract from the fixes?** The "separate security
   property from correctness property" insight. Both the regex fix and the
   budget-gap updates involved tests that conflated two concerns — the ReDoS
   regression test cleanly separates them, but the budget-gap tests still couple
   gap-tier logic to live rate data by design.

2. **What did you consider documenting but left out, and why?** The full
   arithmetic traces for all 8 budget-gap tests. They're already in the plan
   doc and duplicating them here would bloat the solution doc without adding
   searchable value. The plan is cross-referenced above.

3. **What might future sessions miss that this solution doesn't cover?** If
   `rates.ts` changes again, someone might update the budget-gap test values but
   forget to update the near-miss boundary tests (tests 6, 7, and the
   exact-tolerance test). The "(rates.ts)" tag helps, but the *relationship*
   between these tests (they form a boundary pair) isn't enforced by anything
   except the comments.
