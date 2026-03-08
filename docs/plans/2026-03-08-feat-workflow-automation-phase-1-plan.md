---
title: "feat: Workflow automation phase 1 - plan gate foundation"
type: feat
status: active
date: 2026-03-08
origin: HANDOFF.md + docs/workflow-templates.md + CLAUDE.md + Codex automation roadmap discussion
feed_forward:
  risk: "If `rates.ts` changes again, someone might update budget-gap test values but forget the near-miss boundary tests. The relationship between boundary-pair tests is not enforced."
  verify_first: true
---

# feat: Workflow automation phase 1 - plan gate foundation

## Prior Phase Risk

> "If `rates.ts` changes again, someone might update budget-gap test values but
> forget the near-miss boundary tests (tests 6, 7, and exact-tolerance test).
> The '(rates.ts)' tag helps but the relationship between boundary-pair tests
> isn't enforced."
> - HANDOFF.md, Three Questions #3

This plan addresses that risk by making source-of-truth files, linked
expectations, and stop conditions machine-readable. Phase 1 does not automate
work yet; it builds the gate that can block unsafe automation later.

---

## What This Part Of The Project Does

This project already uses documents to control the compound workflow:
brainstorm, plan, work, review, and compound. This feature turns part of that
human-readable workflow into something a local tool can validate before work
starts.

---

## What The Real Task Is

Build the smallest safe automation foundation:

1. Define a machine-readable automation contract inside plan docs.
2. Add a local validator CLI that reads the contract and reports whether a plan
   is automation-ready, manual-only, or invalid.
3. Update the workflow template so future plans can opt into the contract.

Do not automate code edits, review synthesis, CI enforcement, or merge steps in
this phase.

---

## Overview

One docs change, one local tool, one test file, one package script.

**Why this slice first:** it gives you the control point that matters most. If
the plan is weak, the system should stop before any coding starts.

**Files expected to change in the implementation phase:**

- `docs/workflow-templates.md`
- `package.json`
- `src/plan-gate.ts`
- `src/plan-gate.test.ts`

**Files that should NOT change in phase 1:**

- `src/pipeline/*`
- `src/data/*`
- `src/server.ts`
- `public/*`
- `.claude/commands/*`

---

## Smallest Safe Plan

### Chunk 1 - Define the automation contract format

**File:** `docs/workflow-templates.md`

Add a required `## Automation Contract` section to the plan template. Use a
fenced `json` block rather than nested YAML frontmatter so the first validator
can parse it with plain `JSON.parse()` and no new dependency.

**Required contract fields:**

```json
{
  "auto_work_candidate": false,
  "human_signoff_required": true,
  "risk_level": "medium",
  "allowed_paths": [
    "docs/workflow-templates.md",
    "package.json",
    "src/plan-gate.ts",
    "src/plan-gate.test.ts"
  ],
  "forbidden_paths": [
    "src/pipeline",
    "src/data",
    "public",
    ".claude/commands"
  ],
  "source_of_truth": [
    "docs/plans/2026-03-08-feat-workflow-automation-phase-1-plan.md",
    "docs/workflow-templates.md",
    "CLAUDE.md"
  ],
  "required_checks": [
    "npx tsc --noEmit",
    "npm test",
    "npm run plan:check -- docs/plans/2026-03-08-feat-workflow-automation-phase-1-plan.md"
  ],
  "stop_conditions": [
    "Stop if implementation requires editing any file outside allowed_paths.",
    "Stop if the validator cannot determine status without LLM judgment.",
    "Stop if the contract format has to change mid-implementation."
  ],
  "linked_expectations": []
}
```

**Field meanings:**

- `auto_work_candidate`: whether a future work runner is allowed to execute
  from this plan.
- `human_signoff_required`: whether a human must still approve after automated
  work or review.
- `risk_level`: plain safety label for future routing (`low`, `medium`, `high`).
- `allowed_paths`: exact files the implementation may edit.
- `forbidden_paths`: paths that must stay untouched.
- `source_of_truth`: files the reviewer or gate should compare against.
- `required_checks`: commands that must pass before work is considered complete.
- `stop_conditions`: exact reasons the runner must stop and hand control back
  to a human.
- `linked_expectations`: reserved for dependency pairs like boundary tests that
  should be updated together later.

**Acceptance criteria:**

- Every new plan can include a parseable contract block.
- The template explains when to set `auto_work_candidate` to `false`.
- The template explains that missing contract means manual-only workflow.

---

### Chunk 2 - Build the validator CLI

**File:** `src/plan-gate.ts`

Create a local CLI that takes one markdown file path and prints a clear result:

- `eligible` -> contract is valid and `auto_work_candidate = true`
- `manual_only` -> plan is readable but not eligible for automation
- `invalid` -> contract exists but is malformed

**Validator responsibilities:**

1. Read the markdown file from disk.
2. Find the `## Automation Contract` section.
3. Extract the first fenced `json` block in that section.
4. Parse the JSON.
5. Validate:
   - all required keys exist
   - arrays are non-empty where required
   - `allowed_paths` and `forbidden_paths` do not overlap
   - every `source_of_truth` file exists
   - every `allowed_paths` file either exists now or is one of the files this
     plan explicitly intends to create
   - `risk_level` is one of the allowed values
6. Return a clear report with reasons.

**Exit codes:**

- `0` = eligible
- `2` = manual_only
- `1` = invalid

**Important simplification for phase 1:**

- No LLM calls.
- No semantic scoring of prose.
- No CI integration.
- No diff inspection.

This is a deterministic local gate only.

**Acceptance criteria:**

- Running the CLI on a valid candidate plan returns `eligible`.
- Running it on a valid human-only plan returns `manual_only`.
- Running it on a plan with no contract returns `manual_only` with a clear
  reason.
- The output names the exact missing or bad field instead of a vague failure.

---

### Chunk 3 - Add tests and npm script

**Files:** `src/plan-gate.test.ts`, `package.json`

Add a test file that covers the smallest important cases using inline markdown
fixtures or temporary files created during the test.

**Minimum test cases:**

1. Valid contract with `auto_work_candidate: true` -> `eligible`
2. Valid contract with `auto_work_candidate: false` -> `manual_only`
3. Missing `## Automation Contract` section -> `manual_only`
4. Bad JSON -> `invalid`
5. Missing required key -> `invalid`
6. Overlap between allowed and forbidden paths -> `invalid`
7. Missing source-of-truth file -> `invalid`

Add a package script:

```json
"plan:check": "tsx src/plan-gate.ts"
```

**Acceptance criteria:**

- `npm run plan:check -- <plan-path>` works locally.
- The validator is covered by the existing test runner.
- No new npm dependency is added just to parse the contract.

---

### Chunk 4 - Dry run against real plans

**Files:** none new beyond the validator and tests

Run the validator against two real plan types:

1. This new phase-1 plan -> should report `manual_only`
2. A legacy plan with no contract, such as `docs/plans/2026-03-07-test-failure-fixes.md`
   -> should report `manual_only` with a clear reason in the output

**Decision for legacy plans:** Treat them as `manual_only`, not broken. This
lets the repo adopt the gate gradually without labeling old plans as failures.

**Acceptance criteria:**

- The repo can keep old plans without backfilling them immediately.
- The CLI clearly says why a legacy plan is not automation-eligible.

---

## Rejected Options And Why

1. **Automate work and review immediately**
   Rejected because the workflow still needs a reliable gate before code or
   review sessions can run safely without human judgment.

2. **Use nested YAML frontmatter for the contract**
   Rejected for phase 1 because it would likely require a YAML parser package or
   a fragile custom parser. JSON inside a named section is simpler and easier to
   validate.

3. **Use an LLM to judge plan quality in phase 1**
   Rejected because it adds non-determinism at the exact point where the system
   should be strict and predictable.

4. **Update `.claude/commands` now**
   Rejected because command-level automation is downstream of the gate. Phase 1
   should prove the contract and validator first.

5. **Fail all legacy plans immediately**
   Rejected because it would make adoption noisy and discourage use. Legacy docs
   should stay readable and manual-only until they are upgraded.

---

## Risks And Unknowns

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Contract schema is too weak to help later automation | Medium | Medium | Keep phase 1 small but include allowed paths, forbidden paths, checks, stop conditions, and source-of-truth fields from day one |
| Contract schema is too ambitious and slows adoption | Medium | Medium | Keep the first version to a single JSON block with a short required field list |
| Legacy plan handling becomes confusing | Medium | Low | Pick one rule (`manual_only`) and document it in the CLI output and tests |
| The validator starts trying to judge prose quality | Low | Medium | Keep phase 1 deterministic; do not add natural-language scoring |
| Linked boundary expectations stay under-specified | High | Low | Add `linked_expectations` as a reserved field now, but defer enforcement to a later phase |

---

## Acceptance Criteria

Phase 1 is complete when all of these are true:

1. The plan template in `docs/workflow-templates.md` includes a documented
   `## Automation Contract` block.
2. `src/plan-gate.ts` can read a plan and report `eligible`, `manual_only`, or
   `invalid`.
3. The validator reports concrete reasons, not generic pass/fail output.
4. `src/plan-gate.test.ts` covers the core contract states and failure modes.
5. `package.json` includes a `plan:check` script.
6. No runtime pipeline files or UI files are touched in this phase.

---

## Tests Or Checks

Required checks for the implementation session:

```bash
npx tsc --noEmit
npm test
npm run plan:check -- docs/plans/2026-03-08-feat-workflow-automation-phase-1-plan.md
npm run plan:check -- docs/plans/2026-03-07-test-failure-fixes.md
```

Expected outcomes:

- TypeScript compiles cleanly
- Existing test suite still passes
- The new plan reports `manual_only`
- The legacy plan reports `manual_only`

---

## Rollback Plan

If the validator or contract design causes friction:

1. Remove `plan:check` from the active workflow and go back to manual plan
   review.
2. Keep the new plan doc as design history, but do not require the contract for
   work sessions.
3. Revert `docs/workflow-templates.md`, `package.json`, `src/plan-gate.ts`, and
   `src/plan-gate.test.ts` together.
4. Do not half-keep the contract without the validator; that would create
   documentation debt without enforcement.

---

## Claude Code Handoff Prompt

```text
Read docs/plans/2026-03-08-feat-workflow-automation-phase-1-plan.md.

Implement workflow automation phase 1 only.

Scope:
- Update docs/workflow-templates.md to add the Automation Contract section to the plan template.
- Add src/plan-gate.ts as a deterministic local validator CLI.
- Add src/plan-gate.test.ts covering the core eligible/manual_only/invalid cases.
- Update package.json with a plan:check script.

Do not change:
- src/pipeline/*
- src/data/*
- src/server.ts
- public/*
- .claude/commands/*

Required checks:
- npx tsc --noEmit
- npm test
- npm run plan:check -- docs/plans/2026-03-08-feat-workflow-automation-phase-1-plan.md
- npm run plan:check -- docs/plans/2026-03-07-test-failure-fixes.md

Stop conditions:
- Stop if implementation needs files outside the allowed list.
- Stop if the validator needs LLM judgment to continue.
- Stop if legacy plan handling cannot be kept manual_only.
```

---

## Three Questions

1. **Hardest decision in this session?** Choosing a contract format that is
   strict enough for tooling but still simple enough to adopt. JSON in a named
   markdown section won over YAML-frontmatter expansion for that reason.

2. **What did you reject, and why?** I rejected immediate auto-work,
   auto-review, and LLM-based plan scoring because they add risk before the repo
   has a deterministic gate.

3. **Least confident about going into the next phase?** The exact boundary
   between `manual_only` and `invalid` for older plans. The implementation
   should make that decision explicit early and test it, so adoption stays
   predictable.
