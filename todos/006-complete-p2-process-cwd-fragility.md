---
status: pending
priority: p2
issue_id: "006"
tags: [code-review, reliability]
dependencies: []
unblocks: []
sub_priority: 2
---

# Fix `process.cwd()` fragility in context.ts

## Problem

`context.ts` uses `process.cwd()` for docs path. Breaks if run from a different directory (pm2, Docker). Flagged by TypeScript, Architecture, and Performance reviewers.

## Location

- `src/pipeline/context.ts` line 5

## Fix

Use `import.meta.dirname` (already used in `server.ts` line 17).
