---
status: pending
priority: p2
issue_id: "005"
tags: [code-review, architecture]
dependencies: []
unblocks: ["010"]
sub_priority: 1
---

# Extract `runPipeline` to eliminate orchestration duplication

## Problem

Pipeline orchestration is duplicated in `index.ts` (lines 34-65) and `server.ts` (lines 41-87). A future automation layer would be a third copy. Flagged by Architecture, Agent-Native, and Simplicity reviewers.

## Location

- `src/index.ts`
- `src/server.ts`

## Fix

Extract `runPipeline(rawText, hooks?)` into `src/pipeline/run.ts`. Server passes SSE hooks, CLI passes nothing. Already designed in the automation plan.
