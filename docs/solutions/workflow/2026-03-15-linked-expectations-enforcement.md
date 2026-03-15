---
title: "Linked Expectations Enforcement in Plan Gate"
category: workflow
tags: [plan-gate, validation, automation, linked-expectations]
module: src/plan-gate.ts
symptom: "linked_expectations field reserved but unenforced — invisible file dependencies not caught at plan time"
root_cause: "Phase 1 deferred the design decision for what 'linked' means"
---

# Linked Expectations Enforcement in Plan Gate

## Problem

The plan gate validator (`src/plan-gate.ts`) had a `linked_expectations` field
in the automation contract that was validated as an array but never semantically
enforced. Plans could declare file dependencies, but the gate never checked
them. This meant a plan could list `src/types.ts` in `allowed_paths` but forget
`src/prompts/verify.ts` — and the gate would say "eligible" even though
changing one without the other breaks gut check logic.

## Solution

Upgraded `linked_expectations` from `string[]` to a structured format:

```typescript
interface LinkedExpectation {
  files: string[];  // 2+ file paths
  reason: string;   // explains WHY these files are linked
}
```

Added two validation passes:

1. **Shape validation** (before the existing early return at line 178): each
   entry must be an object with `files` (array of 2+ non-empty strings) and
   `reason` (non-empty string). Shape errors accumulate and trigger the
   existing early return, preventing cross-field checks from running on
   malformed entries.

2. **Cross-field validation** (after the existing overlap check): for each
   entry, if any file in `files` is covered by `allowed_paths` (exact match or
   directory prefix), all files must be covered. Groups where no file is in
   `allowed_paths` pass silently (the "neither file touched" case).

## Key Patterns

### 1. Shape-before-semantic validation ordering

The shape validation MUST be inserted before the early return gate (line 178).
If inserted after, malformed entries like `[42]` or `["src/foo.ts"]` (old
string format) reach the cross-field loop and crash on `.files` access. The
early return is the primary guard; the `continue` on malformed entries is
belt-and-suspenders.

**When to apply:** Any time you add validation for a structured field inside an
existing validator with layered checks.

### 2. YAGNI on error message enhancement

The brainstorm and SpecFlow analysis both recommended a `forbidden_paths`
contradiction check (special error when a linked file is in forbidden_paths).
The simplicity reviewer cut it: the existing overlap check catches this one
step later when the plan author tries to add the file to `allowed_paths`. The
slightly better error message wasn't worth ~25 lines of code + a test.

**When to apply:** Before adding "nicer" error messages for edge cases, check
if the existing system already catches the problem. If the user gets a clear
error one step later, the enhancement is YAGNI.

### 3. Bidirectional enforcement with opt-in scope

The enforcement is bidirectional ("if any file in group is allowed, all must
be") but opt-in per plan. Plan authors only include pairs they want enforced.
This avoids the complexity of directed dependencies (source → dependent) while
letting authors skip pairs that don't apply to their specific change.

**When to apply:** When designing a constraint system that might be too strict,
make it opt-in rather than adding complexity to handle exceptions.

### 4. Migration boundary test

Added a test for old-format `string[]` entries to document what happens when
someone uses the pre-upgrade format. The test produces a clear error ("must be
an object with files and reason") instead of a cryptic crash. This is a
one-time cost that documents the breaking change boundary.

**When to apply:** When changing a field's type in a schema, add a test for the
old format to document the migration path.

## Risk Resolution

**Brainstorm risk:** "Whether bidirectional enforcement is too strict for edge
cases." → Resolved: opt-in per plan means authors skip pairs they don't need.
No friction reported.

**Plan risk:** "Shape validation insertion point — if inserted after line 139
early return, malformed entries crash cross-field checks." → Resolved: inserted
before the early return. Old-format migration test (test 6) serves as a
regression test for this ordering.

**Work risk:** "Reason suffix in error messages is a new pattern with no length
cap." → Accepted: CLI tool where plan authors write their own reasons. Monitor
for noisy output; add cap only if needed.

## Files Changed

| File | What changed |
|------|-------------|
| `src/plan-gate.ts` | `LinkedExpectation` interface, shape validation, cross-field validation (~59 lines) |
| `src/plan-gate.test.ts` | 6 new tests (~92 lines) |
| `docs/workflow-templates.md` | Updated template example and field description |

## Remaining Gaps

- **Git diff enforcement** — linked expectations are only checked at plan time,
  not after work is done. A runner could satisfy the gate then edit only one
  file in a pair. Deferred to a future cycle.
- **Global registry** — 15+ real dependency pairs found in the codebase.
  Per-plan definitions work now, but if copy-paste across plans becomes common,
  extract a global `linked-expectations.json` registry.
- **Directed dependencies** — the brainstorm considered source → dependent
  relationships. Not needed yet, but upgrade path exists if bidirectional
  becomes too strict.

## Three Questions

1. **Hardest pattern to extract from the fixes?** The shape-before-semantic
   ordering. It's a load-bearing detail that's easy to miss — inserting at
   line 180 instead of line 175 would silently break the validator on malformed
   inputs. The pattern is: always insert new validation checks BEFORE the early
   return gate, not after.

2. **What did you consider documenting but left out, and why?** The full list
   of 15+ real dependency pairs found during the brainstorm review. They're
   useful context but not actionable until a global registry is built. If
   documented now, they'd go stale as the codebase evolves.

3. **What might future sessions miss that this solution doesn't cover?** The
   interaction between plan-time enforcement and runtime execution. A plan can
   pass the gate with all linked files in `allowed_paths`, but nothing prevents
   the work runner from editing only one file in the pair. Git diff enforcement
   (checking that linked files were actually co-modified) is the missing piece.
