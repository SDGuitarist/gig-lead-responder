# Brainstorm: Linked Expectations Enforcement

**Date:** 2026-03-15
**Status:** Complete
**Next:** Plan

## Context

The plan gate (`src/plan-gate.ts`) has an `AutomationContract` with 9 fields.
Eight are validated and enforced. The ninth — `linked_expectations` — is
reserved but does nothing. It's validated as an array (can be empty), but its
entries are never parsed, checked, or acted on.

The field was deferred during Phase 1 (2026-03-08) because it requires design
decisions: what format should entries have, what does "linked" mean concretely,
and what happens when a link is violated.

### Prior Phase Risk

> "What might future sessions miss that this solution doesn't cover? The
> `linked_expectations` field is reserved but not enforced. When Phase 2 adds
> enforcement, the validator will need to understand what 'linked' means
> (e.g., boundary-pair tests that must update together). That design decision
> is deferred."

This brainstorm addresses exactly that deferred design decision.

---

## What Problem Does This Solve?

When a plan says "change file A," there are sometimes **invisible dependencies**
— files that MUST change alongside A or the system breaks. Examples from this
codebase:

1. **Type + prompt pairs:** If you change a gut check key in `src/types.ts`,
   you must also update `src/prompts/verify.ts` (the gut check instruction)
   and `src/prompts/generate.ts` (the concern traceability instruction). Miss
   one and the gate silently passes/fails on the wrong criteria.

2. **Schema + migration pairs:** If you add a column to a DB table, the
   migration file and the query that reads that column must both change. Miss
   the query and the column is dead.

3. **Contract + template pairs:** If you change the `AutomationContract`
   interface in `plan-gate.ts`, the template in `docs/workflow-templates.md`
   must also update. Otherwise plans written from the template will fail
   validation.

4. **Test + source pairs:** If a plan says "change the behavior of function X,"
   the test for function X must also be in `allowed_paths`. Otherwise the
   automated runner edits the source but doesn't update the test, and the test
   suite fails.

Today, `allowed_paths` and `forbidden_paths` catch some of this — but only if
the plan author remembers to list every dependent file. `linked_expectations`
would make the dependency explicit and machine-checkable.

---

## Key Questions

### 1. What format should a linked expectation entry have?

**Option A: Simple pair (file, file)**
```json
["src/types.ts", "src/prompts/verify.ts"]
```
Meaning: if either file is in `allowed_paths`, the other must be too.

**Option B: Named pair with reason**
```json
{ "files": ["src/types.ts", "src/prompts/verify.ts"], "reason": "gut check keys must stay in sync" }
```
Meaning: same as A, but self-documenting.

**Option C: Directed dependency**
```json
{ "source": "src/types.ts", "dependents": ["src/prompts/verify.ts", "src/prompts/generate.ts"], "reason": "type changes cascade" }
```
Meaning: if `source` is in `allowed_paths`, ALL `dependents` must be too. But
editing a dependent alone doesn't require the source.

**Recommendation: Option B.** Option A loses the "why" — when the gate rejects
a plan, the author won't know what to fix. Option C adds direction, which is
useful but adds complexity we may not need yet (in practice, if you're touching
verify.ts you probably should also check types.ts). Start with B, upgrade to C
if we find real cases where direction matters.

### 2. What does "enforcement" mean concretely?

Two possible enforcement points:

**Point 1: At plan validation time (plan-gate.ts)**
When the gate reads a plan with `linked_expectations`, it checks: for each
pair, if either file appears in `allowed_paths`, the other must too. If not →
the contract is `invalid` with a reason like: `"Linked pair violated:
src/types.ts is in allowed_paths but src/prompts/verify.ts is not. Reason: gut
check keys must stay in sync."`

**Point 2: At review time (post-work diff check)**
After work is done, check the git diff: if a linked file was changed, was its
pair also changed? This catches cases where the plan listed both files but the
implementation only touched one.

**Recommendation: Start with Point 1 only.** Point 2 requires reading git
diffs programmatically, which is a much bigger feature. Point 1 catches the
most common failure mode (plan author forgets to list a dependent file) and
fits cleanly into the existing validator.

### 3. Where do the linked pairs come from?

**Option A: Defined per-plan in the contract**
Each plan author writes their own `linked_expectations` based on what they're
changing. This is flexible but depends on the author knowing the dependencies.

**Option B: Global registry in a project config file**
A file like `linked-expectations.json` at the project root defines all known
dependency pairs. The plan gate reads this file and enforces it against every
plan's `allowed_paths`. Plan authors don't need to know the pairs — the gate
catches violations automatically.

**Option C: Both**
Global registry for known pairs, plus per-plan overrides for one-off
dependencies specific to that plan.

**Recommendation: Option A for now.** A global registry (B) is powerful but
requires maintaining a second file, and we don't have enough pairs yet to
justify it. We have maybe 3-5 known pairs in this codebase. Start with
per-plan definitions. If we find ourselves copying the same pairs across
multiple plans, that's the signal to extract a global registry.

### 4. Should empty `linked_expectations` remain valid?

**Yes.** Many plans touch isolated files with no dependencies. Requiring
linked expectations on every plan would add friction for no benefit. Empty
array = "I've considered dependencies and there are none" or "this plan is
simple enough that it doesn't matter."

### 5. What should the error message look like?

The gate already produces structured error messages. A linked pair violation
should follow the same pattern:

```
Status: invalid
  - Linked pair violated: "src/types.ts" is in allowed_paths but
    "src/prompts/verify.ts" is not. Reason: gut check keys must stay in sync.
```

This tells the plan author exactly what to add and why.

---

## Scope Fences (NOT in this session)

- No global registry file (Option B above) — per-plan only
- No git diff enforcement (Point 2 above) — plan-time validation only
- No directed dependencies (Option C above) — bidirectional pairs only
- No changes to existing plans — only new plans will use the feature
- No changes to the LLM pipeline, prompts, or dashboard
- No changes to `allowed_paths` / `forbidden_paths` logic

---

## Concrete Changes Expected

1. **`src/plan-gate.ts`** — Update `linked_expectations` type from `string[]`
   to an array of `{ files: string[], reason: string }`. Add validation:
   - Each entry must have `files` (array of 2+ strings) and `reason` (string)
   - For each entry, if any file in `files` appears in `allowed_paths`, ALL
     files in the entry must appear in `allowed_paths`
   - Violation → `invalid` status with descriptive reason

2. **`src/plan-gate.test.ts`** — Add tests:
   - Valid plan with linked expectations where all files are in allowed_paths → eligible
   - Linked pair violated (one file missing from allowed_paths) → invalid with descriptive error
   - Empty linked_expectations still valid → eligible
   - Malformed entry (missing reason, files not array) → invalid

3. **`docs/workflow-templates.md`** — Update the template and field
   descriptions to show the new format with an example.

4. **`src/types.ts`** — No changes (linked_expectations is only in plan-gate's
   local types, not the pipeline types).

---

## Feed-Forward

- **Hardest decision:** Whether to use simple file pairs (Option A) or named
  pairs with reason (Option B). Named pairs won because error messages need to
  explain WHY a pair is linked — without the reason, the gate tells you
  something is wrong but not how to think about fixing it.

- **Rejected alternatives:** (1) Directed dependencies (Option C) — adds
  source/dependent distinction that we don't have concrete cases for yet. Can
  upgrade later. (2) Global registry — powerful but premature with only 3-5
  known pairs. (3) Git diff enforcement — much bigger feature, not needed
  until we have an automated work runner that actually edits files
  unsupervised.

- **Least confident:** Whether the `{ files, reason }` format is flexible
  enough. If we find cases where a group of 3+ files are linked but only some
  combinations trigger violations (e.g., changing file A requires B but not
  C, while changing C requires both A and B), we'll need directed
  dependencies. But I think bidirectional "if any → all" is correct for the
  pairs we actually have today.

---

## Three Questions

1. **Hardest decision in this session?** The entry format — simple pairs vs
   named pairs vs directed dependencies. Each adds value but also complexity.
   Named pairs (Option B) hit the sweet spot: self-documenting errors without
   the graph complexity of directed deps.

2. **What did you reject, and why?** Global registry file — it's the right
   long-term answer but premature now. We'd be maintaining a config file for
   3-5 pairs that could just live in the plan contracts. When we catch
   ourselves copy-pasting the same pairs, that's when to extract.

3. **Least confident about going into the next phase?** Whether bidirectional
   enforcement ("if any file in the group is in allowed_paths, all must be")
   is too strict. There might be valid cases where you touch one file in a
   pair without needing to touch the other — e.g., updating a test file
   without changing the source. But the plan author can just not list that
   pair in their contract. The enforcement is opt-in per plan, so strictness
   is scoped.
