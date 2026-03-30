---
status: pending
priority: p3
issue_id: "014"
tags: [code-review, typescript]
dependencies: []
unblocks: []
sub_priority: 1
---

# Duplicate `competitor_test` Field

## Problem

`competitor_test` exists as both a top-level boolean on GateResult (line 77) and inside gut_checks (line 89) in types.ts. Confusing — which is source of truth?

## Location

- `src/types.ts` lines 77 and 89

## Fix

Remove top-level field, read from `gut_checks.competitor_test`. Update display in `index.ts`.
