---
title: "Fix 11 Pre-Existing Test Failures"
type: plan
date: 2026-03-07
revised: 2026-03-07
brainstorm: docs/brainstorms/2026-03-07-test-failure-investigation-brainstorm.md
scope: budget-gap.test.ts (8 failures), email-parser.test.ts (3 failures)
feed_forward:
  risk: "Email-parser regex fix — if real Bash HTML structure differs from fixture, we'd be fixing a test to match a wrong fixture"
  verify_first: true
---

# Plan: Fix 11 Pre-Existing Test Failures (Revised)

## Prior Phase Risk

> "The email-parser regex fix. If the real Bash HTML structure differs from the
> fixture (e.g., they changed their email template), the regex fix could be
> correct but the fixture wrong — and we'd be 'fixing' a test to match a wrong
> fixture."
> — Brainstorm, Three Questions #3

This plan **accepts** that risk with a concrete guardrail: Step 1b adds a ReDoS
regression test that locks the security property regardless of fixture accuracy.
If a real Bash sample later contradicts the fixture, only the regex and fixture
need updating — the regression test still protects against backtracking.

---

## Current Suite Counts

| Metric | Value |
|--------|-------|
| Total tests | **48** |
| Passing | **37** |
| Failing | **11** (8 budget-gap + 3 email-parser) |
| Test files | 3 (`budget-gap.test.ts` 25, `email-parser.test.ts` 12, `enrich-generate.test.ts` 11) |

---

## Overview

Two independent root causes, four implementation steps.

| Group | Files to change | Root cause |
|-------|----------------|------------|
| A (8 failures) | `src/budget-gap.test.ts` | Scope-down helper reads real rate tables; rates changed since tests were written |
| B (3 failures) | `src/email-parser.ts`, `src/email-parser.test.ts` | Hardened regex too restrictive — `[^<]*` can't cross `</td><td>` boundary |

**Runtime code changes:** Only `src/email-parser.ts` line 120 (one regex).
**No changes to:** `src/pipeline/price.ts`, `src/data/rates.ts`.

---

## Budget-Gap Test Identity (Finding 1)

`detectBudgetGap()` is a **hybrid** function:

- **Gap-tier classification** (small / large / no_viable_scope) is a **pure
  unit test** — the `floor` parameter is passed directly, so the caller
  controls it. These tests do NOT depend on `rates.ts`.
- **Scope-down behavior** (`findScopedAlternative`) is an **integration test**
  — it looks up the real rate table for the next-shorter duration. These tests
  DO depend on `rates.ts`.

The 8 failing tests all involve scope-down. They fail because
`findScopedAlternative` reads current `rates.ts` values, which are higher than
the values the tests were written against.

**Decision:** Keep the integration-style design. These tests intentionally
verify that scope-down works with real pricing. Mocking would hide the exact
class of bug they caught (stale rate expectations).

**Consequence:** The `floor` parameter in each test call is synthetic (the
caller picks any value to create the desired gap size). The comments must NOT
claim the synthetic floor matches a `rates.ts` entry — it doesn't need to.
Only the scope-down lookup hits real rates, and those expectations must match
the current `rates.ts`.

---

## Step 1a: Fix email-parser regex (Group B — verify_first)

The brainstorm flagged this as lowest-confidence, so tackle it first.

### Current regex (line 120 of `src/email-parser.ts`)

```
/EVENT DATE:[^<]*<td[^>]*>([^<]*)<\/td>/is
```

### Problem

Fixture HTML: `<td>EVENT DATE:</td><td>Saturday, February 28, 2026</td>`

After `EVENT DATE:`, the next characters are `</td><td>`. The `[^<]*` matches
zero characters, then expects `<td` but finds `</td>` — no match.

### Fix

```
/EVENT DATE:<\/td>\s*<td[^>]*>([^<]*)<\/td>/is
```

This explicitly expects the closing `</td>` and opening `<td>` — no
backtracking, no `.*?`. Every segment uses `[^<]*` or `[^>]*` (single-class
negation). ReDoS protection preserved.

### Add a comment above the regex

```ts
// EVENT DATE: appears in its own <td>, value is in the next <td>.
// Pattern: EVENT DATE:</td><td>value</td>
// Fixture modeled on confirmed real format; no live sample available (2026-03-07).
// If fixture is wrong, update regex + fixture — ReDoS regression test protects the security property.
```

---

## Step 1b: ReDoS regression test (email-parser guardrail)

**Why:** The regex change is low-confidence (no real Bash sample). Even if the
regex or fixture needs further adjustment later, the ReDoS protection must
never regress. A dedicated test locks this property.

### Add to `src/email-parser.test.ts` (inside the "The Bash" describe block)

```ts
it("EVENT DATE regex does not backtrack on malicious input", () => {
  // Regression test for March 5 ReDoS fix (finding 001).
  // Input that caused a 27-second hang with the old .*? pattern.
  const maliciousHtml =
    "EVENT DATE:" + "<td".repeat(10_000);
  const result = parseEmail({
    ...THEBASH_FIELDS,
    "body-html": maliciousHtml,
  });
  // Must return quickly (parse_error, not hang). If this test times out,
  // the regex has regressed to a backtracking-vulnerable pattern.
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, "parse_error");
  }
});
```

This test will pass regardless of whether the regex matches `</td><td>` or
`[^<]*` — it only checks that malicious input doesn't hang. It survives any
future regex adjustment.

No second malicious input is needed. The new pattern has no nested or
overlapping quantifiers: `\s*` only spans contiguous whitespace between fixed
tags, and `[^>]*` / `[^<]*` each advance monotonically to a single delimiter,
so repeated `<td` fragments or attributes do not create exponential
backtracking paths.

### Verify

```bash
npm test -- --test-name-pattern='parseEmail'
```

Expected: all 13 parseEmail tests pass (3 that were failing + 9 that already
passed + 1 new ReDoS regression).

### Commit (Steps 1a + 1b together)

```
fix(email-parser): adjust EVENT DATE regex to cross </td><td> boundary

The March 5 security hardening replaced .*? with [^<]* to prevent
ReDoS (27-second hang confirmed). But [^<]* can't cross the </td><td>
boundary between the label cell and value cell in The Bash HTML.
Explicitly match the cell boundary.

Non-backtracking property preserved: all segments use [^<]* or [^>]*.

Adds a ReDoS regression test with the original malicious input to
lock the security property against future regex changes.

Note: no real Bash HTML sample available — fixture is modeled on
confirmed real format. If fixture is later found inaccurate, update
regex + fixture; the regression test still protects against ReDoS.
```

---

## Step 2: Update budget-gap test expectations (Group A)

### Current rate values used by scope-down

These are the values `findScopedAlternative` looks up from `src/data/rates.ts`.
The `floor` parameter passed to `detectBudgetGap` is synthetic — it does NOT
need to match these. Only the scope-down result depends on these values.

| Format | Duration | Tier | Floor (current rates.ts) |
|--------|----------|------|--------------------------|
| Solo | 1hr | T2D | **550** |
| Solo | 1hr | T2P | **450** |
| Solo | 2hr | T2D | **650** |
| Solo | 2hr | T2P | **550** |
| Solo | 3hr | T2D | **795** |
| Solo | 3hr | T2P | **700** |

### Near-miss rule reminder

`findScopedAlternative` returns null (no viable scope-down) when:
`shorterFloor >= budget + NEAR_MISS_TOLERANCE` (i.e., `shorterFloor >= budget + 75`)

It returns an alternative when: `shorterFloor < budget + 75`

### Independent arithmetic verification for tests 5-7

Using the current Solo duration keys `[1, 2, 3, 4]` from `src/data/rates.ts`,
the helper always looks one step shorter:

- Test 5: duration `3` → shorter duration `2` → `SOLO_RATES["2"].T2D.floor = 650`
- Test 6: duration `2` → shorter duration `1` → `SOLO_RATES["1"].T2D.floor = 550`
- Test 7: duration `2` → shorter duration `1` → `SOLO_RATES["1"].T2D.floor = 550`

Each proposed input below was also checked directly against the current
`detectBudgetGap()` implementation to confirm the expected tier and
`alt.price`.

### Recomputed expectations for each failing test

#### Test 1 (lines 60-71): "gap exactly $75 — tier: large"

- Call: `detectBudgetGap(425, 500, "solo", 2, "T2D")`
- gap = 500 - 425 = 75 → large range (75 <= 200)
- Scope-down: Solo 1hr T2D floor = **550**. Check: 550 >= 425 + 75 = 500? **Yes** → null
- **Correct result:** `tier: "no_viable_scope"`, gap: 75
- **Change:** Update description to "gap $75, scope-down floor too high →
  no_viable_scope". Update assertions. Remove stale comment referencing old
  1hr T2D floor of 450. The synthetic floor (500) stays — it creates the
  desired gap size.

#### Test 2 (lines 73-84): "gap $75 with successful scope-down"

- Call: `detectBudgetGap(525, 600, "solo", 3, "T2P")`
- gap = 600 - 525 = 75 → large range
- Scope-down: Solo 2hr T2P floor = **550**. Check: 550 >= 525 + 75 = 600? **No** → alt returned
- **Correct result:** `tier: "large"`, gap: 75, alt = { duration_hours: 2, price: **550** }
- **Change:** Update `alt.price` from 400 to **550**. Update comment: "Solo
  2hr T2P: floor = 550 (rates.ts)". Tier and duration correct as-is.

#### Test 3 (lines 86-92): "gap exactly $200 — tier: large"

- Call: `detectBudgetGap(400, 600, "solo", 3, "T2P")`
- gap = 600 - 400 = 200 → large range (200 <= 200)
- Scope-down: Solo 2hr T2P floor = **550**. Check: 550 >= 400 + 75 = 475? **Yes** → null
- **Correct result:** `tier: "no_viable_scope"`, gap: 200
- **Change:** Update expected tier from "large" to "no_viable_scope". Update
  description. Comment: scope-down fails because budget $400 is too far below
  the shorter-duration floor of $550.

#### Test 4 (lines 121-129): "scoped alternative uses same tier_key"

- Call: `detectBudgetGap(500, 600, "solo", 3, "T2P")`
- gap = 600 - 500 = 100 → large range
- Scope-down: Solo 2hr T2P floor = **550**. Check: 550 >= 500 + 75 = 575? **No** → alt returned
- **Correct result:** `tier: "large"`, alt = { duration_hours: 2, price: **550** }
- **Change:** Update `alt.price` from 400 to **550**. Update comment: "Solo
  2hr T2P: floor = 550 (rates.ts)".

#### Test 5 (lines 131-138): "scoped alternative price is floor, not anchor"

- Call: `detectBudgetGap(550, 700, "solo", 3, "T2D")`
- gap = 700 - 550 = 150 → large range
- Scope-down: Solo 2hr T2D floor = **650**. Check: 650 >= 550 + 75 = 625? **Yes** → null
- **Correct result:** `tier: "no_viable_scope"`, gap: 150
- **Problem:** This test exists to prove the alt uses floor, not anchor. With
  current rates, scope-down fails entirely — the test no longer exercises what
  it claims.
- **Change:** Update inputs to a combo where scope-down succeeds:
  `detectBudgetGap(600, 700, "solo", 3, "T2D")`. gap = 100. Solo 2hr T2D
  floor = 650. Check: 650 >= 600 + 75 = 675? **No** → alt = { duration_hours: 2,
  price: **650** }. Assert `alt.price === 650` (floor, not the anchor of 700).
  Comment: "Solo 2hr T2D: anchor = 700, floor = 650 (rates.ts)".
- **findScopedAlternative trace:** `allDurations = [1, 2, 3, 4]` →
  `currentIdx = 2` for duration `3` → `shorterDuration = 2` →
  `shorterRates.floor = 650` → `650 >= 675` is false → return
  `{ duration_hours: 2, price: 650 }`.

#### Test 6 (lines 146-154): "near-miss: budget close to shorter-duration floor → large"

- Call: `detectBudgetGap(400, 500, "solo", 2, "T2D")`
- Scope-down: Solo 1hr T2D floor = **550**. Check: 550 >= 400 + 75 = 475? **Yes** → null
- **Problem:** All three near-miss tests (6, 7, 8) become no_viable_scope with
  current rates. This leaves near-miss tolerance with zero passing coverage.
- **Change:** Update inputs to exercise near-miss with current rates:
  `detectBudgetGap(500, 650, "solo", 2, "T2D")`. gap = 650 - 500 = 150.
  Solo 1hr T2D floor = 550. Check: 550 >= 500 + 75 = 575? **No** → alt
  returned = { duration_hours: 1, price: **550** }.
  Comment: "Budget $500 vs 1hr T2D floor $550 — gap $50 is within tolerance
  $75, so scope-down succeeds. (rates.ts: solo 1hr T2D floor = 550)"
- **findScopedAlternative trace:** `allDurations = [1, 2, 3, 4]` →
  `currentIdx = 1` for duration `2` → `shorterDuration = 1` →
  `shorterRates.floor = 550` → `550 >= 575` is false → return
  `{ duration_hours: 1, price: 550 }`.

#### Test 7 (lines 156-163): "near-miss: budget at tolerance boundary → large"

- Call: `detectBudgetGap(376, 500, "solo", 2, "T2D")`
- Scope-down: Solo 1hr T2D floor = **550**. Check: 550 >= 376 + 75 = 451? **Yes** → null
- **Change:** Update inputs to exercise boundary:
  `detectBudgetGap(476, 650, "solo", 2, "T2D")`. gap = 650 - 476 = 174.
  Solo 1hr T2D floor = 550. Check: 550 >= 476 + 75 = 551? **No** → alt
  returned = { duration_hours: 1, price: **550** }.
  Comment: "Budget $476 + tolerance $75 = $551 > floor $550 — just barely
  passes the near-miss check. (rates.ts: solo 1hr T2D floor = 550)"
- **findScopedAlternative trace:** `allDurations = [1, 2, 3, 4]` →
  `currentIdx = 1` for duration `2` → `shorterDuration = 1` →
  `shorterRates.floor = 550` → `550 >= 551` is false by $1 → return
  `{ duration_hours: 1, price: 550 }`.

#### Existing passing boundary test (lines 165-170): refresh to current-rate exact-tolerance failure

- **Decision:** Do not add a new budget-gap test. Reuse the existing
  no-viable-scope boundary test so the suite keeps the same total count.
- **Current passing test:** `detectBudgetGap(375, 500, "solo", 2, "T2D")`
  still returns `no_viable_scope`, but it no longer exercises the current-rate
  exact-tolerance boundary.
- **Change:** Update that existing test to:
  `detectBudgetGap(475, 650, "solo", 2, "T2D")`
- **Expected result:** `tier: "no_viable_scope"`, gap = `650 - 475 = 175`
- **Show your work:** Solo 1hr T2D floor = **550**. Check:
  `550 >= 475 + 75 = 550`? **Yes** → `findScopedAlternative()` returns null.
- **New description:** `"$475 budget vs $550 1hr floor (gap $75 = tolerance) → no_viable_scope"`
- **Why this matters:** After the updates, near-miss coverage includes both
  sides of the current-rate boundary:
  - Test 7: just barely passes (`550 < 476 + 75 = 551`)
  - Existing boundary test: just barely fails (`550 >= 475 + 75 = 550`)

#### Test 8 (lines 189-191): "injection string parsed as number (400)"

- Call: `detectBudgetGap(400, 500, "solo", 2, "T2D")`
- Same scope-down as Test 6 → no_viable_scope
- **Change:** Update expected tier from "large" to "no_viable_scope". The test
  still proves that a sanitized injection value (400) enters normal processing
  — the exact tier doesn't matter for the security property being tested.
  Update comment to note the security property, not the tier.

### Summary of changes

| Test | Change type | New expected tier | New alt.price | Comment update |
|------|------------|-------------------|---------------|----------------|
| 1 (line 60) | Assertions + description | no_viable_scope | — | Remove stale floor reference |
| 2 (line 73) | alt.price + comment | large (unchanged) | 550 | "Solo 2hr T2P: floor = 550 (rates.ts)" |
| 3 (line 86) | Tier + description | no_viable_scope | — | Note scope-down failure reason |
| 4 (line 121) | alt.price + comment | large (unchanged) | 550 | "Solo 2hr T2P: floor = 550 (rates.ts)" |
| 5 (line 131) | Inputs + assertions + comment | large | 650 | "Solo 2hr T2D: anchor = 700, floor = 650 (rates.ts)" |
| 6 (line 146) | Inputs + assertions + comment | large | 550 | "rates.ts: solo 1hr T2D floor = 550" |
| 7 (line 156) | Inputs + assertions + comment | large | 550 | "rates.ts: solo 1hr T2D floor = 550" |
| Existing boundary test (line 165) | Inputs + description + comment | no_viable_scope | — | Current-rate exact-tolerance fail case |
| 8 (line 189) | Tier assertion + comment | no_viable_scope | — | Security property note |

### Comment conventions for updated tests

- Comments that reference a scope-down floor MUST include "(rates.ts)" to
  signal they depend on the current rate table.
- The synthetic `floor` parameter does NOT need a rates.ts reference — it's
  chosen by the test author to create a specific gap size.
- If rates.ts changes again, search for "(rates.ts)" in the test file to find
  all comments that need updating.

### Passing-tests audit (comment-only fixes)

Audit result: the currently-passing budget-gap tests need **five comment-only
fixes** plus the one exact-tolerance boundary refresh above.

- Gap-tier suite header (line 37): remove `Solo 2hr T2D: floor = 500` and say
  these tests use synthetic floors to exercise gap thresholds only.
- `gap $201` test (lines 94-98): remove `Solo 3hr T2P: floor = 600` as if it
  were current pricing; keep only the synthetic gap explanation.
- `solo at 1hr` test (lines 113-118): remove stale `Solo 1hr T2P: floor = 400`
  wording; keep the minimum-duration behavior explanation.
- Near-miss suite header (line 144): replace `floor 500 → 1hr 450` with
  wording that matches the updated current-rate near-miss cases.
- `no shorter duration available` test (lines 173-180): remove stale
  `Solo 1hr T2D: floor = 450` wording; keep only the minimum-duration logic.

---

## Step 3: Write-time normalization cross-check

**Already confirmed in brainstorm (Step 3).** Neither failure group is related
to the Cycle 15 write-time normalization changes:

- `detectBudgetGap` receives numeric inputs — string normalization irrelevant.
- `parseEmail` operates on raw `EmailFields` before any database write.

Add a one-line note in the commit message: "Verified: unrelated to Cycle 15
write-time normalization."

---

## Step 4: Run all checks and commit

### Verify Group A

```bash
npm test -- --test-name-pattern='detectBudgetGap'
```

Expected: all 25 detectBudgetGap tests pass (0 failures).

### Commit Group A

```
fix(tests): update budget-gap scope-down expectations for current rates

findScopedAlternative() reads real rate tables. Solo floors increased
since these tests were written (e.g., 1hr T2D: 450 → 550, 2hr T2P:
400 → 550). Updated scope-down expectations and near-miss inputs to
match current rates.ts values.

Tests 5-7 got independent arithmetic verification in the plan. The
existing exact-tolerance fail test is also refreshed to current-rate
values, so near-miss coverage now includes both just-barely-pass and
just-barely-fail cases.

Passing comments that quoted stale rate values are corrected, and
scope-down floor references now tag "(rates.ts)" so future rate
changes can be found with a search.

Verified: unrelated to Cycle 15 write-time normalization.
```

### Final check

```bash
npm test
```

Expected: **49/49 pass, 0 failures.** (48 existing + 1 new ReDoS regression
test.)

---

## Commit Order

1. **email-parser regex + ReDoS regression test** — runtime change +
   guardrail, verify_first (risk item)
2. **budget-gap test expectations** — test-only changes, no runtime risk

Two commits, each independently verifiable.

---

## Acceptance Criteria

- [ ] All 49 tests pass (`npm test` exits 0)
- [ ] `npm test -- --test-name-pattern='detectBudgetGap'` — 25 pass, 0 fail
- [ ] `npm test -- --test-name-pattern='parseEmail'` — 13 pass, 0 fail
- [ ] No changes to `src/pipeline/price.ts`
- [ ] No changes to `src/data/rates.ts`
- [ ] EVENT DATE regex remains non-backtracking (no `.*?` patterns)
- [ ] ReDoS regression test exists and passes (malicious input returns
  parse_error, does not hang)
- [ ] Near-miss tolerance coverage includes both current-rate boundary cases:
  just-barely-pass and exact-tolerance fail
- [ ] Test comments that reference scope-down floors include "(rates.ts)"
- [ ] Passing budget-gap comments no longer quote stale Solo rate values
- [ ] March 5 security hardening preserved

---

## Rollback

- Email-parser: revert `src/email-parser.ts` line 120 + remove new test
- Budget-gap: `git checkout -- src/budget-gap.test.ts`
- Both are single-file changes with no cross-dependencies

---

## Files Changed

| File | Type of change |
|------|---------------|
| `src/email-parser.ts` | Runtime — one regex on line 120 |
| `src/email-parser.test.ts` | Test — 1 new ReDoS regression test |
| `src/budget-gap.test.ts` | Test — 8 failing cases updated, 1 existing passing boundary case refreshed, 5 passing comment-only fixes |

---

## Three Questions

1. **Hardest decision in this session?** Whether to add a brand-new
   current-rate exact-tolerance fail test or repurpose the existing passing
   boundary test. Chose to repurpose the existing test so coverage improves
   without changing the planned suite count.

2. **What did you reject, and why?** (a) Adding a second malicious regex input.
   Rejected because the new pattern has no nested or overlapping quantifiers,
   so a second crafted string would not add meaningful coverage. (b) Keeping
   the old passing near-miss boundary test as comment-only. Rejected because it
   no longer exercised the current-rate exact-tolerance edge. (c) Leaving
   passing comments with stale Solo floors. Rejected because they would keep
   the plan internally inconsistent.

3. **Least confident about going into the next phase?** The real Bash HTML
   structure is still unverified. The regression test protects against ReDoS,
   and the arithmetic for budget-gap tests is now independently re-traced, but
   fixture accuracy for the `</td><td>` boundary remains an assumption.
