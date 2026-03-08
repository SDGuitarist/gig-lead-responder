---
title: "Plan Gate Foundation — Deterministic Automation Contract Validator"
date: 2026-03-08
category: workflow
problem_type: automation-infrastructure
components:
  - src/plan-gate.ts
  - src/plan-gate.test.ts
  - docs/workflow-templates.md
  - package.json
commits: []
tags:
  - automation
  - plan-quality-gate
  - deterministic-validation
  - workflow-infrastructure
---

# Plan Gate Foundation

## Problem

The compound engineering workflow has no machine-readable way to determine
whether a plan is safe for automated execution. All plans require human judgment
to decide when to start work. The automation ladder (from the Codex discussion)
identified the plan quality gate as the prerequisite before any downstream
automation can be safe.

## Root Cause

Plans are human-readable markdown with no structured contract. There's no way
for a tool to answer "is this plan specific enough to execute without design
decisions?" without reading and interpreting prose.

## Solution

Added a machine-readable `## Automation Contract` section to the plan template
and a deterministic local validator CLI.

**Contract format:** A fenced JSON block inside a named markdown section with 9
required fields: `auto_work_candidate`, `human_signoff_required`, `risk_level`,
`allowed_paths`, `forbidden_paths`, `source_of_truth`, `required_checks`,
`stop_conditions`, `linked_expectations`.

**Validator CLI (`src/plan-gate.ts`):** Reads a plan file, extracts the contract,
validates all fields, and reports one of three statuses:
- `eligible` (exit 0) — valid contract, `auto_work_candidate: true`
- `manual_only` (exit 2) — no contract or `auto_work_candidate: false`
- `invalid` (exit 1) — malformed JSON or failed validation

**Key design decisions:**
- JSON inside a named section (not YAML frontmatter) — parseable with
  `JSON.parse()`, no new dependency
- Legacy plans without contracts are `manual_only`, not `invalid` — gradual
  adoption, no noise
- Source-of-truth files must exist on disk — catches stale references
- Path overlap detection — `allowed_paths` and `forbidden_paths` cannot conflict
- No LLM calls, no semantic scoring — deterministic gate only

**Test coverage:** 13 tests covering eligible, manual_only, invalid states,
malformed JSON, missing keys, path overlap, missing source-of-truth, invalid
risk level, nonexistent files, and dry runs against both real plans.

## Verification

- `npx tsc --noEmit` — clean
- `npm test` — 62/62 pass (49 existing + 13 new)
- `npm run plan:check -- docs/plans/2026-03-08-feat-workflow-automation-phase-1-plan.md` — `manual_only`
- `npm run plan:check -- docs/plans/2026-03-07-test-failure-fixes.md` — `manual_only`

## Risk Resolution

**What was flagged:** "Making the `manual_only` vs `invalid` split obvious in
code and output." — Plan Three Questions #3

**What actually happened:** The split is enforced by code structure: missing
section → `manual_only` (early return before any parsing), malformed JSON or
failed validation → `invalid` (after parsing attempt). Each status has a
specific reason string. Tests cover both paths.

**Lesson learned:** When a system needs a "not applicable" state alongside
"broken," make the not-applicable path return early before the validation logic
even runs. This prevents accidental invalid results from code that was never
meant to evaluate the input.

## Prevention Patterns

1. **Early return for "not applicable" inputs.** If a tool should gracefully
   handle inputs it wasn't designed for (legacy plans), return a benign status
   before entering validation logic.
2. **Exit codes as API contract.** Three exit codes (0, 1, 2) make the validator
   composable with shell scripts and future CI without parsing stdout.

## Cross-References

- [Workflow templates](../../workflow-templates.md) — contract format and guidance
- [Plan: workflow automation phase 1](../../plans/2026-03-08-feat-workflow-automation-phase-1-plan.md) — full plan
- [CLAUDE.md Plan Quality Gate](../../../CLAUDE.md) — the 4-question gate this implements

## Three Questions

1. **Hardest pattern to extract from the fixes?** The early-return pattern for
   `manual_only` vs `invalid`. It's simple in hindsight but easy to get wrong —
   if validation runs on plans without contracts, you get false `invalid` results
   that discourage adoption.

2. **What did you consider documenting but left out, and why?** The full field
   validation logic for each contract field. It's in the code and tests, and
   documenting it here would just be restating the implementation.

3. **What might future sessions miss that this solution doesn't cover?** The
   `linked_expectations` field is reserved but not enforced. When Phase 2 adds
   enforcement, the validator will need to understand what "linked" means
   (e.g., boundary-pair tests that must update together). That design decision
   is deferred.
