---
status: pending
priority: p2
issue_id: "012"
tags: [code-review, performance]
dependencies: ["005"]
unblocks: []
sub_priority: 8
---

# Parallelize Stages 2 and 3

## Problem

Pricing (Stage 2) and Context Assembly (Stage 3) run sequentially but have no dependency on each other -- both only need the classification result. Flagged by Performance reviewer.

## Location

- `src/index.ts`, `src/server.ts` (will be in `run.ts` after 005)

## Fix

```ts
const [pricing, context] = await Promise.all([lookupPrice(...), selectContext(...)]);
```
