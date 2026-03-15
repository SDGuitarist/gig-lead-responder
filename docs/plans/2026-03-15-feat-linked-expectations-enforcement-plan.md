---
title: "feat: Enforce linked_expectations in plan gate"
type: feat
status: completed
date: 2026-03-15
origin: docs/brainstorms/2026-03-15-linked-expectations-enforcement-brainstorm.md
feed_forward:
  risk: "Bidirectional enforcement ('if any → all') may be too strict for edge cases where touching one file in a pair doesn't require touching the other"
  verify_first: true
---

# feat: Enforce linked_expectations in plan gate

## Prior Phase Risk

> "Least confident about going into the next phase? Whether bidirectional
> enforcement ('if any → all') is too strict for edge cases."
> — Brainstorm, 2026-03-15

Addressed: bidirectional is correct for v1. The enforcement is opt-in per plan
— authors omit pairs they don't want enforced. If this becomes friction, we
upgrade to directed dependencies in a future cycle. The plan explicitly
documents this as the "most likely way this plan is wrong" (see below).

## Overview

The plan gate validator (`src/plan-gate.ts`) has a `linked_expectations` field
in `AutomationContract` that is parsed as `string[]` and validated as an array,
but never semantically enforced. This plan upgrades the field to a structured
format and adds enforcement: if any file in a linked group appears in
`allowed_paths`, all files in the group must also appear.

## Enhancement Summary

**Deepened on:** 2026-03-15
**Reviewers used:** kieran-typescript-reviewer, pattern-recognition-specialist,
code-simplicity-reviewer, architecture-strategist, performance-oracle,
learnings-researcher (constants-at-the-boundary, required-nullable-vs-optional)

### Key Improvements from Deepening
1. **P1 fix:** Shape validation must gate cross-field checks — prescribed exact
   insertion point before line 139 early return
2. **P1 fix:** Duplicate check nested inside `else` of string-type check to
   prevent `as string[]` cast on unvalidated data
3. **Simplified:** Removed forbidden_paths contradiction check (YAGNI — existing
   overlap check catches this one step later)
4. **Simplified:** Removed duplicate-files-in-entry check (harmless to
   enforcement logic)
5. **Added:** Test for old-format `string[]` entries (migration boundary)
6. **Added:** Pass-through semantics documented in template

## What exactly is changing?

1. **Type change** in `src/plan-gate.ts`: `linked_expectations: string[]` →
   `linked_expectations: LinkedExpectation[]` where:
   ```typescript
   interface LinkedExpectation {
     files: string[];  // 2+ file paths
     reason: string;   // non-empty — explains WHY these files are linked
   }
   ```

2. **Validation logic** in `validateContract()`: two new validation passes:
   - **Shape validation** (during existing array checks, BEFORE line 139 early
     return): each entry is an object with `files` (array of 2+ non-empty
     strings) and `reason` (non-empty string). Shape errors accumulate into the
     existing `errors[]` array, so the line 139 early return prevents
     cross-field checks from running on malformed entries.
   - **Cross-field validation** (during existing semantic checks, after
     line 154): for each entry, if any file in `files` appears in
     `allowed_paths`, all must.

3. **Tests** in `src/plan-gate.test.ts`: 6 new test cases.

4. **Template** in `docs/workflow-templates.md`: updated format + field
   description + pass-through semantics note.

## What must NOT change?

- `src/types.ts` — `linked_expectations` lives only in plan-gate's local types
- `src/pipeline/` — no pipeline changes
- `src/prompts/` — no prompt changes
- `src/data/` — no rate table changes
- Empty `linked_expectations: []` must remain valid (backward compatible)
- Exit codes (0/1/2) must not change
- All 11 existing tests must still pass

## Proposed Solution

### Step 1: Type + shape validation (`src/plan-gate.ts`)

Add the `LinkedExpectation` interface above `AutomationContract`:

```typescript
interface LinkedExpectation {
  files: string[];
  reason: string;
}
```

Change line 23 from `linked_expectations: string[]` to
`linked_expectations: LinkedExpectation[]`.

Add shape validation after the existing array type check (after line 122),
**BEFORE the line 139 early return.** This is critical — shape errors must
accumulate into `errors[]` so the early return at line 139 prevents cross-field
validation from running on malformed entries. This matches the existing pattern
where type errors gate semantic checks.

When `linked_expectations` is a non-empty array, validate each entry:

```typescript
// Shape validation for linked_expectations entries
const linkedExp = obj.linked_expectations as unknown[];
for (let i = 0; i < linkedExp.length; i++) {
  const entry = linkedExp[i];
  if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
    errors.push(
      `"linked_expectations[${i}]" must be an object with "files" and "reason".`
    );
    continue;
  }
  const e = entry as Record<string, unknown>;
  if (!Array.isArray(e.files) || e.files.length < 2) {
    errors.push(
      `"linked_expectations[${i}].files" must be an array of at least 2 file paths.`
    );
  } else if (e.files.some((f: unknown) => typeof f !== "string" || f === "")) {
    // Only check string types — duplicate files are harmless to enforcement
    errors.push(
      `"linked_expectations[${i}].files" entries must be non-empty strings.`
    );
  }
  if (typeof e.reason !== "string" || e.reason.trim() === "") {
    errors.push(
      `"linked_expectations[${i}].reason" must be a non-empty string.`
    );
  }
}
```

### Research Insights (Shape Validation)

**Why no duplicate-files check:** The simplicity reviewer confirmed that
duplicate files in an entry are harmless — the enforcement logic produces
correct results with or without duplicates. Removing the check saves ~10 lines
and one test case. (see: code-simplicity-reviewer finding)

**Why `else if` instead of nested `else` + separate check:** The TS reviewer
flagged that the original plan's duplicate check used `e.files as string[]`
after the string-type check had already failed and pushed an error. Nesting the
string check as `else if` prevents the cast from running on unvalidated data.
(see: kieran-typescript-reviewer P1 finding #2)

**Insertion point is load-bearing:** The architecture reviewer confirmed that
shape errors added before line 139 trigger the existing early return, which
prevents the cross-field loop from iterating `contract.linked_expectations`
with malformed entries. If shape validation were inserted AFTER line 139, the
cross-field code would crash on entries like `[42]` when accessing `.files`.
(see: architecture-strategist recommendation #2)

### Step 2: Cross-field validation (`src/plan-gate.ts`)

Add after the existing path overlap check (after line 154). For each valid
linked expectation entry, check whether any file in the group is "covered" by
`allowed_paths`. A file is "covered" if it exactly matches an `allowed_paths`
entry OR starts with an entry followed by `/` (directory prefix matching —
consistent with existing overlap check semantics).

```typescript
// Linked expectations enforcement
for (const linked of contract.linked_expectations) {
  const coveredSet = new Set(
    linked.files.filter((f) =>
      contract.allowed_paths.some(
        (a) => a === f || f.startsWith(a + "/")
      )
    )
  );
  if (coveredSet.size > 0 && coveredSet.size < linked.files.length) {
    const missing = linked.files.filter((f) => !coveredSet.has(f));
    for (const m of missing) {
      errors.push(
        `Linked pair violated: "${[...coveredSet][0]}" is in allowed_paths but ` +
        `"${m}" is not. Reason: ${linked.reason}.`
      );
    }
  }
  // "Neither file touched" case: coveredSet.size === 0 → silent pass-through
}
```

**Error accumulation:** All violations are collected (not early-return). The
plan author sees every problem at once. This matches existing validator
behavior.

**Path matching:** Uses the same prefix logic as the existing overlap check.
If `allowed_paths` contains `"src/prompts/"`, then `"src/prompts/verify.ts"`
is considered covered.

### Research Insights (Cross-field Validation)

**Why no forbidden_paths contradiction check:** The simplicity reviewer
confirmed this is YAGNI. If the gate says "add file X to allowed_paths" and the
author tries to do that, the **existing** overlap check (lines 146-154 of
plan-gate.ts) catches the conflict on the next run. The contradiction check
added ~15 lines + 1 test for a slightly better error message on a scenario
already handled one step later. (see: code-simplicity-reviewer finding #1)

**Why Set instead of Array.includes:** The TS reviewer flagged that
`covered.includes(f)` is O(n) per call. Using a Set for `coveredSet` is
consistent with the Set-based duplicate detection in shape validation and
avoids the inconsistency. (see: kieran-typescript-reviewer P3 finding #4)

**Performance is a non-issue:** The performance reviewer confirmed the
validation is trivially fast at all realistic input sizes. The triple-nested
loop processes at most ~200 comparisons. No optimization needed.
(see: performance-oracle full assessment)

**Path matching direction note:** The existing overlap check tests
`allowed.startsWith(forbidden + "/")` (is allowed path under forbidden
directory?). The linked check tests `f.startsWith(a + "/")` (is linked file
under allowed directory?). The direction is reversed but both are correct for
their use case. (see: architecture-strategist risk analysis)

### Step 3: Tests (`src/plan-gate.test.ts`)

Add 6 new tests after the existing "invalid risk_level" test:

| # | Test name | Input | Expected |
|---|-----------|-------|----------|
| 1 | `linked pair — all files in allowed_paths → eligible` | `linked_expectations: [{files: ["src/plan-gate.ts", "src/plan-gate.test.ts"], reason: "source and test"}]`, both in `allowed_paths` | `eligible` |
| 2 | `linked pair violated — one file missing → invalid` | `linked_expectations: [{files: ["src/plan-gate.ts", "src/prompts/verify.ts"], reason: "sync"}]`, only plan-gate.ts in `allowed_paths` | `invalid`, reason includes "Linked pair violated" and "src/prompts/verify.ts" |
| 3 | `linked pair — neither file in allowed_paths → eligible` | `linked_expectations: [{files: ["foo.ts", "bar.ts"], reason: "sync"}]`, neither in `allowed_paths` | `eligible` (pass-through) |
| 4 | `malformed linked entry — missing reason → invalid` | `linked_expectations: [{files: ["a.ts", "b.ts"]}]` | `invalid`, reason includes "reason" |
| 5 | `malformed linked entry — files has 1 item → invalid` | `linked_expectations: [{files: ["a.ts"], reason: "solo"}]` | `invalid`, reason includes "at least 2" |
| 6 | `old-format string entry → invalid` | `linked_expectations: ["src/foo.ts", "src/bar.ts"]` | `invalid`, reason includes "must be an object" |

Each test uses the existing `contractBlock()` helper with overrides.

### Research Insights (Tests)

**Why test 6 (old-format string entry):** The architecture reviewer flagged
that the type change from `string[]` to `LinkedExpectation[]` creates a
migration boundary. While all existing plans use `[]` (verified), a test for
the old `string[]` format documents what happens if someone uses the pre-upgrade
format. This is a migration safety net. (see: architecture-strategist
recommendation #1)

**Why no duplicate-files test:** Removed per simplicity review — duplicates are
harmless to enforcement logic. (see: code-simplicity-reviewer finding #2)

**Why no forbidden_paths contradiction test:** Removed per simplicity review —
the existing overlap check catches this. (see: code-simplicity-reviewer
finding #1)

### Step 4: Template update (`docs/workflow-templates.md`)

Update line 108 from `"linked_expectations": []` to show an example:

```json
"linked_expectations": [
  {
    "files": ["src/types.ts", "src/prompts/verify.ts"],
    "reason": "gut check keys must stay in sync"
  }
]
```

Update lines 123-124 field description from:
> `linked_expectations` — dependency pairs (e.g., boundary tests) that must be
> updated together (reserved for future enforcement)

To:
> `linked_expectations` — file groups that must be edited together. Each entry
> has `files` (2+ paths) and `reason` (why they're linked). If any file in a
> group appears in `allowed_paths`, all files in the group must. Groups where
> no file appears in `allowed_paths` are silently skipped. Use `[]` when the
> plan has no file dependencies.

## Acceptance Criteria

- [x] `LinkedExpectation` interface added to `plan-gate.ts`
- [x] `linked_expectations` type changed from `string[]` to `LinkedExpectation[]`
- [x] Shape validation rejects: missing `files`/`reason`, `files.length < 2`, empty reason, non-string files, old-format string entries
- [x] Cross-field validation enforces: if any file covered by `allowed_paths`, all must be
- [x] Neither-file-touched case silently passes (no error, no warning)
- [x] Empty `linked_expectations: []` still valid
- [x] All 11 existing tests still pass
- [x] 6 new tests pass (per table in Step 3)
- [x] `docs/workflow-templates.md` updated with new format, description, and pass-through note
- [x] `npx tsc --noEmit` passes
- [x] `npm test` passes (all 17+ tests)

## How will we know it worked?

1. `npm test` — all 17+ tests pass (11 existing + 6 new)
2. `npx tsc --noEmit` — no type errors
3. `npm run plan:check -- docs/plans/2026-03-08-feat-workflow-automation-phase-1-plan.md`
   still returns `manual_only` (backward compatible)
4. A new plan with a valid linked expectation where all files are in
   `allowed_paths` returns `eligible`
5. A new plan with a violated linked expectation returns `invalid` with a
   descriptive error naming the missing file and the reason

## What is the most likely way this plan is wrong?

Bidirectional enforcement may be too strict. A valid scenario: plan touches
`src/prompts/verify.ts` to tweak wording (no gut check changes), but a linked
pair `[types.ts, verify.ts]` forces `types.ts` into `allowed_paths`. The
mitigation: plan authors simply omit pairs they don't want enforced. The
enforcement is opt-in per plan, not global. If this friction appears in
practice, upgrade to directed dependencies (Option C from brainstorm) in a
future cycle.

## Dependencies & Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Bidirectional enforcement too strict | Medium | Low | Opt-in per plan; omit pairs you don't need |
| Breaking existing plans | Very Low | Medium | Verified: all existing plans use `[]` |
| Path matching inconsistency | Low | Medium | Use same prefix logic as existing overlap check |
| Global registry needed sooner than expected | Medium | Low | 15+ real pairs found; monitor for copy-paste across plans |

## Automation Contract

```json
{
  "auto_work_candidate": true,
  "human_signoff_required": false,
  "risk_level": "low",
  "allowed_paths": [
    "src/plan-gate.ts",
    "src/plan-gate.test.ts",
    "docs/workflow-templates.md"
  ],
  "forbidden_paths": [
    "src/pipeline",
    "src/prompts",
    "src/data",
    "src/types.ts",
    "src/api.ts",
    "src/app.ts",
    "src/auth.ts",
    "src/server.ts",
    "public"
  ],
  "source_of_truth": [
    "docs/plans/2026-03-15-feat-linked-expectations-enforcement-plan.md",
    "docs/brainstorms/2026-03-15-linked-expectations-enforcement-brainstorm.md"
  ],
  "required_checks": [
    "npx tsc --noEmit",
    "npm test"
  ],
  "stop_conditions": [
    "Stop if implementation requires editing any file outside allowed_paths.",
    "Stop if the type change breaks any existing test.",
    "Stop if the path matching semantics diverge from the existing overlap check."
  ],
  "linked_expectations": []
}
```

Note: This plan's own `linked_expectations` is `[]` because none of the 3
files being changed have implicit dependencies outside the allowed set.

## Sources

- **Origin brainstorm:** [docs/brainstorms/2026-03-15-linked-expectations-enforcement-brainstorm.md](docs/brainstorms/2026-03-15-linked-expectations-enforcement-brainstorm.md) — key decisions: named pairs with reason (Option B), plan-time validation only, per-plan definitions, empty arrays valid
- **Phase 1 solution doc:** [docs/solutions/workflow/2026-03-08-plan-gate-foundation.md](docs/solutions/workflow/2026-03-08-plan-gate-foundation.md) — established contract schema and validator architecture
- **Boundary validation pattern:** [docs/solutions/architecture/express-handler-boundary-validation.md](docs/solutions/architecture/express-handler-boundary-validation.md) — shape guard taxonomy applied to entry validation
- **No-op pattern:** [docs/solutions/architecture/noop-gut-checks-conditional-features.md](docs/solutions/architecture/noop-gut-checks-conditional-features.md) — always-present field, never optional
- **Constants at boundary:** [docs/solutions/logic-errors/constants-at-the-boundary.md](docs/solutions/logic-errors/constants-at-the-boundary.md) — if adding threshold constants, co-locate with source list
- **Required-nullable vs optional:** [docs/solutions/logic-errors/required-nullable-vs-optional-types.md](docs/solutions/logic-errors/required-nullable-vs-optional-types.md) — `linked_expectations` is required (always present), not optional — consistent with this pattern

---

## Plan Quality Gate

1. **What exactly is changing?** Type of `linked_expectations` in plan-gate.ts,
   validation logic in `validateContract()`, 6 new tests, template docs.
2. **What must not change?** `src/types.ts`, pipeline, prompts, rates, existing
   tests, exit codes, empty array validity.
3. **How will we know it worked?** 17+ tests pass, `tsc` clean, backward
   compatible with existing plans.
4. **Most likely way this plan is wrong?** Bidirectional enforcement too strict
   for real usage. Mitigated by opt-in per plan.

---

## Feed-Forward

- **Hardest decision:** Whether to keep or cut the forbidden_paths
  contradiction check. The brainstorm review flagged it, SpecFlow confirmed it
  matters, but the simplicity reviewer showed the existing overlap check
  already catches it one step later. Cut it — YAGNI.

- **Rejected alternatives:** (1) forbidden_paths contradiction check — existing
  overlap check handles this. (2) Duplicate-files-in-entry check — duplicates
  are harmless to enforcement logic. (3) Verbose pass-through logging — adds
  output complexity for marginal debuggability. (4) Skipping path prefix
  matching — would be inconsistent with existing overlap check semantics.

- **Least confident:** The error message pattern extension. Appending
  `Reason: ${linked.reason}` to error messages is new — no existing error
  includes user-provided text. The TS reviewer flagged this as intentional but
  noted there's no length cap on `reason`. If a 500-character reason appears
  in an error message, it'll be noisy. For v1, this is acceptable — plan
  authors write their own reasons and can keep them short. Add a length cap
  only if it becomes a problem.

## Three Questions

1. **Hardest decision in this session?** Cutting the forbidden_paths
   contradiction check after having added it in the original plan. The
   brainstorm review and SpecFlow both said it mattered, but the simplicity
   reviewer's argument was stronger: the existing overlap check catches it,
   adding a better error message for an edge case is YAGNI.

2. **What did you reject, and why?** The original plan had 7 tests, forbidden
   paths contradiction detection, and duplicate-file validation. All three
   were cut during deepening. The 7 tests → 6 because the contradiction and
   duplicate tests tested removed features, and the old-format migration test
   was more valuable (documents the breaking change boundary).

3. **Least confident about going into the next phase?** The shape validation
   insertion point. The plan prescribes "after line 122, BEFORE line 139 early
   return" — but the exact insertion point matters. If the implementer
   accidentally inserts after line 139, malformed entries will reach
   cross-field validation and crash. The test for old-format string entries
   (test 6) should catch this — if `["src/foo.ts"]` reaches cross-field
   validation, it'll crash instead of returning a clean error.
