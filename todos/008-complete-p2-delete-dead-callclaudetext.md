---
status: pending
priority: p2
issue_id: "008"
tags: [code-review, simplicity]
dependencies: []
unblocks: []
sub_priority: 4
---

# Delete dead `callClaudeText` function

## Problem

`callClaudeText` function in `claude.ts` (lines 68-89) is exported but never imported or called. All stages use `callClaude<T>`. Flagged by Simplicity reviewer.

## Location

- `src/claude.ts` lines 68-89

## Fix

Delete the function (22 lines).
