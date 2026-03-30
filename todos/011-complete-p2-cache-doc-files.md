---
status: pending
priority: p2
issue_id: "011"
tags: [code-review, performance]
dependencies: []
unblocks: []
sub_priority: 7
---

# Cache doc files at startup

## Problem

Every request reads 4-6 markdown files from disk. These are static reference docs that never change between requests. Flagged by Performance reviewer.

## Location

- `src/pipeline/context.ts`

## Fix

Read docs once at startup and cache in a Map. Total size is ~93KB.
