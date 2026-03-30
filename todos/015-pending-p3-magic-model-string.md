---
status: pending
priority: p3
issue_id: "015"
tags: [code-review, maintainability]
dependencies: []
unblocks: []
sub_priority: 2
---

# Magic Model String Hardcoded

## Problem

Default model "claude-sonnet-4-6" hardcoded in two function signatures in claude.ts. When upgrading models, requires find-and-replace.

## Location

- `src/claude.ts` lines 23 and 76

## Fix

Extract to a `DEFAULT_MODEL` constant.
