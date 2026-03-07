---
title: "Investigation: 11 Pre-Existing Test Failures"
type: investigation
date: 2026-03-07
scope: budget-gap.test.ts (8 failures), email-parser.test.ts (3 failures)
---

# Investigation: 11 Pre-Existing Test Failures

## Goal

Root-cause the 11 pre-existing test failures before any new feature work.
Separate stale expectations from real regressions. Fix tests only — do not
change runtime code unless recomputed expectations prove runtime is wrong.

### Prior Phase Risk

> "The interaction between write-time normalization and pre-existing test
> failures. If test failures are caused by un-normalized data, the fixes might
> have silently addressed a symptom."
> — HANDOFF.md, Cycle 15 compound phase

This brainstorm **directly addresses** that risk. Step 3 of the investigation
order includes a write-time-normalization cross-check to determine whether the
failures predate or postdate the normalization changes.

---

## Failure Group A: budget-gap.test.ts (8 failures)

### Hypothesis: Stale Test Expectations vs. Current Rate Tables

The tests were written against rate values that no longer match `src/data/rates.ts`.
`detectBudgetGap()` receives `floor` as a direct parameter (so input-validation
and gap-tier tests pass fine), but `findScopedAlternative()` looks up the
**actual rate table** for the shorter-duration floor. When rates.ts was updated,
the scope-down expectations went stale.

### Evidence (static analysis — no code run yet)

The test fixture comments reference old floor values. Cross-referencing against
the current `src/data/rates.ts`:

| Test (line) | Format/Duration/Tier | Test expects floor | Actual floor in rates.ts | Scope-down result |
|-------------|---------------------|--------------------|--------------------------|-------------------|
| 60-71 | solo 1hr T2D | 450 | **550** | near-miss rejects → no_viable_scope (test expects large) |
| 73-84 | solo 2hr T2P | 400 | **550** | alt.price wrong (test expects 400, actual 550) |
| 86-92 | solo 2hr T2P | 400 | **550** | near-miss rejects → no_viable_scope (test expects large) |
| 121-129 | solo 2hr T2P | 400 | **550** | alt.price wrong (test expects 400) |
| 131-138 | solo 2hr T2D | 500 | **650** | near-miss rejects → no_viable_scope (test expects large) |
| 146-154 | solo 1hr T2D | 450 | **550** | near-miss rejects → no_viable_scope (test expects large) |
| 156-163 | solo 1hr T2D | 450 | **550** | near-miss rejects → no_viable_scope (test expects large) |
| 189-191 | solo 1hr T2D | — | **550** | security test — scope-down fails, returns no_viable_scope (test expects large) |

All 8 share the same root cause: **the scope-down helper reads real rate tables,
and the test expectations were computed from older, lower rates.** The runtime
code (`detectBudgetGap` + `findScopedAlternative`) is behaving correctly for the
current rates.

### What "fix" looks like

Recompute every scope-down expectation from the current `src/data/rates.ts`
values. The test assertions change; the runtime code does not.

### Files likely to change

- `src/budget-gap.test.ts` — update expected floor values and expected tiers in
  8 scope-down tests

### Files that should NOT change

- `src/pipeline/price.ts` — runtime logic is correct
- `src/data/rates.ts` — rates are the source of truth

---

## Failure Group B: email-parser.test.ts (3 failures)

### Hypothesis: Security Hardening Regression (March 5, 2026)

The email-parser security review (PR from `docs/reviews/email-parser-security/
REVIEW-SUMMARY.md`) hardened the EVENT DATE regex from a backtracking-vulnerable
pattern to a non-backtracking one:

**Before (vulnerable to ReDoS):**
```
/EVENT DATE:.*?<td[^>]*>(.*?)<\/td>/is
```

**After (hardened — finding 001):**
```
/EVENT DATE:[^<]*<td[^>]*>([^<]*)<\/td>/is
```

The hardened `[^<]*` after `EVENT DATE:` refuses to cross any `<` character. But
the test fixture HTML has this structure:

```html
<table><tr><td>EVENT DATE:</td><td>Saturday, February 28, 2026</td></tr></table>
```

After `EVENT DATE:`, the next characters are `</td><td>`. The `[^<]*` matches
zero characters, then expects `<td` but finds `</td>` — **regex fails to
match.**

The old `.*?` pattern would lazily cross `</td>` to find `<td>` — it matched
but was vulnerable to catastrophic backtracking on malicious input.

### Which 3 tests fail

| Test (line) | Description | Why it fails |
|-------------|-------------|--------------|
| 102-114 | Extracts all fields from valid Gig Alert | event_date regex doesn't match → parse_error |
| 127-136 | Birthday Party (Adult) with parentheses | Same regex failure |
| 138-147 | Funeral single-word event type | Same regex failure |

The other 2 Bash tests (skip non-Gig Alert, parse_error missing Gig ID) never
reach the event_date regex, so they pass.

### The real question

**Is the test fixture HTML accurate?** Two possibilities:

1. **Fixture is accurate** (real Bash emails have `</td><td>` between label and
   value) → the hardened regex is too restrictive and needs adjustment while
   preserving the ReDoS fix.
2. **Fixture is inaccurate** (real Bash emails have `EVENT DATE:` immediately
   followed by `<td>` in the same cell) → the fixture needs updating, and the
   hardened regex is correct.

**We cannot answer this without a real, current The Bash HTML sample.** The
fixture says "Synthetic fixtures based on confirmed real formats" (line 5 of
test file), which suggests it was originally modeled on real email structure —
but we don't know if that structure has changed.

### What "fix" looks like (two paths)

**Path A — if fixture is accurate (likely):**
Adjust the regex to safely cross the `</td><td>` boundary without reintroducing
backtracking. For example:

```
/EVENT DATE:<\/td>\s*<td[^>]*>([^<]*)<\/td>/is
```

This explicitly expects the closing `</td>` and opening `<td>` tags — no
backtracking, no `.*?`. The ReDoS protection is preserved because every segment
uses `[^<]*` or `[^>]*` (single-character-class negation, no overlapping match
paths).

**Path B — if fixture is inaccurate:**
Update the fixture to match real HTML structure. Hardened regex stays as-is.

### Files likely to change

- `src/email-parser.ts` line 120 — regex pattern (Path A)
- OR `src/email-parser.test.ts` lines 23-26 — fixture HTML (Path B)

### Constraint

The March 5 security hardening MUST be preserved. Any regex change must remain
non-backtracking (no `.*?` or `(.+?)` patterns that create overlapping match
paths on malicious input).

---

## Investigation Order (smallest safe steps)

### Step 1: Validate The Bash HTML structure

**Action:** Get a real, current The Bash "Gig Alert" email HTML body. Compare
the `EVENT DATE:` section structure against the test fixture.

**If no real sample is available:** Document the gap explicitly. Proceed with
Path A (adjust regex to handle `</td><td>` structure) since the fixture comment
claims it was modeled on real email format. Flag this as low-confidence.

**Evidence needed:** One real The Bash HTML body showing the exact tag structure
around `EVENT DATE:`.

**Expected outcome:** Confirms whether the fixture or the regex needs changing.

### Step 2: Recompute budget-gap expectations

**Action:** For each of the 8 failing budget-gap tests, trace through
`findScopedAlternative()` using the current `src/data/rates.ts` values. Write
down the correct expected tier and scoped_alternative for each test case.

**Do NOT change tests yet** — just compute what the correct expectations should
be. This confirms the hypothesis before any edits.

**Expected outcome:** A table of 8 test cases with corrected expectations. Some
tests that currently expect `tier: "large"` will correctly become
`tier: "no_viable_scope"` because the higher floors make scope-down unviable.

### Step 3: Write-time normalization cross-check

**Action:** Verify that the budget-gap and email-parser failures are NOT caused
by the Cycle 15 write-time normalization changes (moving `trim().toLowerCase()`
from webhook.ts to insertLead in leads.ts).

**How to check:**
- `detectBudgetGap` receives numeric inputs — normalization is irrelevant
  (string trimming/lowercasing doesn't affect numbers). **Confirmed safe.**
- `parseEmail` operates on raw `EmailFields` before any database write —
  normalization in `insertLead` happens downstream. **Confirmed safe.**

**Expected outcome:** Normalization changes are unrelated to both failure groups.
The failures predate the normalization work.

### Step 4: Apply fixes and run checks

After steps 1-3 confirm the hypotheses:

1. Fix the email-parser regex (or fixture) based on Step 1 findings
2. Update budget-gap test expectations based on Step 2 computations
3. Run the required checks:
   - `npm test` (all 51 tests)
   - `npm test -- --test-name-pattern='parseEmail'`
   - `npm test -- --test-name-pattern='detectBudgetGap'`
4. Confirm 0 failures

---

## Rejected Options

1. **Change rates.ts to match old test expectations.** Rejected because rates.ts
   is the business source of truth — tests should reflect reality, not the other
   way around.

2. **Mock rate tables in budget-gap tests.** Considered — would decouple tests
   from rate data. Rejected for now because the tests are integration-style tests
   that intentionally verify behavior against real rate tables. Mocking would
   hide rate-change regressions. Could revisit if rate changes happen frequently.

3. **Revert the EVENT DATE regex hardening.** Rejected — the ReDoS vulnerability
   is a confirmed P1 (27-second hang). The fix must be preserved.

4. **Skip The Bash event_date extraction entirely.** Rejected — event_date is
   used downstream for date-proximity logic in the generate prompt.

5. **Investigate all 11 failures as potentially related to one root cause.**
   Rejected — static analysis shows two clearly independent root causes (stale
   rate expectations vs. regex pattern change). Treating them as separate saves
   investigation time.

---

## Risks and Unknowns

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| No real Bash HTML sample available | Medium | Low-confidence regex fix | Document the gap; proceed with Path A; add a comment noting the fixture source |
| Rate table changes again after fixing tests | Medium | Tests break again | Add a comment in budget-gap.test.ts noting that scope-down tests depend on rates.ts values |
| Hardened regex breaks on other Bash email variants | Low | Missed leads | The regex only needs to handle "Gig Alert" emails; other variants are already filtered by subject line check |
| Some passing tests are passing for the wrong reason | Low | Hidden bugs | Step 2 recomputation will catch any tests that pass coincidentally |

---

## Acceptance Criteria

- [ ] All 51 tests pass (`npm test` exits 0)
- [ ] `npm test -- --test-name-pattern='detectBudgetGap'` — 0 failures
- [ ] `npm test -- --test-name-pattern='parseEmail'` — 0 failures
- [ ] No changes to `src/pipeline/price.ts` (runtime logic untouched)
- [ ] No changes to `src/data/rates.ts` (rates untouched)
- [ ] EVENT DATE regex remains non-backtracking (no `.*?` patterns)
- [ ] March 5 security hardening preserved (ReDoS fix intact)
- [ ] Write-time normalization cross-check documented (step 3 result)

---

## Required Checks

```bash
npm test
npm test -- --test-name-pattern='parseEmail'
npm test -- --test-name-pattern='detectBudgetGap'
```

---

## Rollback

If any fix introduces new failures:
- `git stash` or `git checkout -- src/` to revert all changes
- Budget-gap test changes are isolated to test expectations — no runtime risk
- Email-parser regex change is the only runtime-touching edit; revert just
  `src/email-parser.ts` line 120 if needed

---

## Three Questions

1. **Hardest decision in this session?** Whether the 3 email-parser failures are
   a fixture problem or a regex problem. Without a real Bash HTML sample, the
   answer is low-confidence. The fixture comment ("Synthetic fixtures based on
   confirmed real formats") tips the balance toward "fixture is accurate, regex
   is too restrictive" — but that's an assumption, not proof.

2. **What did you reject, and why?** Mocking rate tables in budget-gap tests.
   It would make tests independent of rate changes, but these are intentionally
   integration-style tests that verify scope-down against real pricing. Mocking
   would hide the exact class of bug they're designed to catch.

3. **Least confident about going into the next phase?** The email-parser regex
   fix. If the real Bash HTML structure differs from the fixture (e.g., they
   changed their email template), the regex fix could be correct but the fixture
   wrong — and we'd be "fixing" a test to match a wrong fixture. Step 1 of the
   investigation order exists specifically to address this, but it depends on
   having a real sample.
