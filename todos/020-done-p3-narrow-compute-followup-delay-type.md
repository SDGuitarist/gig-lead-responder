---
status: done
priority: p3
issue_id: "020"
tags: [code-review, type-safety, follow-up-pipeline]
dependencies: []
---

# computeFollowUpDelay accepts any number

## Problem Statement

`computeFollowUpDelay(followUpCount: number)` accepts any number but only 0, 1, 2 are valid. Out-of-range values silently fall back to the 7-day delay.

## Findings

- **Source:** TypeScript reviewer (HIGH)
- **File:** `src/leads.ts:269-271`

## Proposed Solutions

### Option A: Narrow parameter type

```typescript
export function computeFollowUpDelay(followUpCount: 0 | 1 | 2): number {
  return FOLLOW_UP_DELAYS_MS[followUpCount];
}
```

- **Effort:** Small (2 min)

## Acceptance Criteria

- [ ] Parameter typed as `0 | 1 | 2`
- [ ] Fallback `?? FOLLOW_UP_DELAYS_MS[2]` removed
- [ ] `tsc --noEmit` passes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-26 | Created from code review | |
