---
status: pending
priority: p3
issue_id: "016"
tags: [code-review, maintainability]
dependencies: []
unblocks: []
sub_priority: 3
---

# Hardcoded Phone Detection in `ensureContactBlock`

## Problem

`ensureContactBlock` in generate.ts uses hardcoded "(619) 755-3246" to detect if contact block already present, but the full block is defined as a constant on line 5. These will drift apart.

## Location

- `src/pipeline/generate.ts` lines 5 and 44

## Fix

Use the `CONTACT_BLOCK` constant for detection too.
