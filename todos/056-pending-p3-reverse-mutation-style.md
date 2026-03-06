---
status: pending
priority: p3
issue_id: "056"
tags: [code-review, style, queries]
dependencies: []
unblocks: []
sub_priority: 1
---

# 048: monthlyTrends.reverse() mutates array in place

## Problem Statement

In `src/db/queries.ts:214`, `.reverse()` mutates the `monthlyTrends` array in place. Functionally safe since it's a local variable never reused, but looks like a mutation inside a pure transformation chain. Prefer `.toReversed()` (Node 20+) or `[...monthlyTrends].reverse()`.

**Found by:** TypeScript Reviewer, Performance Oracle (confirmed non-issue)

## Proposed Solutions

One-line change: `monthlyTrends.toReversed().map(...)` or `[...monthlyTrends].reverse().map(...)`.

- **Effort:** Trivial
- **Risk:** None

## Acceptance Criteria

- [ ] Reverse does not mutate the original array

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-05 | Created from review | Style-only, functionally safe as-is |
