---
status: done
priority: p2
issue_id: "013"
tags: [code-review, quality, follow-up-pipeline]
dependencies: []
---

# Transaction inconsistency in SEND handler

## Problem Statement

In `handleFollowUpSend()`, the non-terminal path (schedule next follow-up) wraps `updateLead()` in `runTransaction()`, but the terminal path (set exhausted) does not. Both paths call a single `updateLead()` — a single SQL UPDATE statement that is already atomic in SQLite. The `runTransaction()` wrapper adds no safety benefit but creates a false impression that one path has different concurrency requirements than the other.

## Findings

- **Source:** TypeScript reviewer (CRITICAL), Architecture strategist (MEDIUM), Simplicity reviewer, Security sentinel (LOW)
- **File:** `src/twilio-webhook.ts:180-199`
- **Evidence:** Terminal path (line 182-186) has no transaction; non-terminal path (lines 192-198) wraps a single `updateLead` in `runTransaction()`. Both are single-statement updates, both are equally atomic.
- **Consensus:** All 4 agents that reviewed this agreed the `runTransaction()` is unnecessary and should be removed for consistency.

## Proposed Solutions

### Option A: Remove runTransaction from non-terminal path (Recommended)

```typescript
} else {
  const delay = computeFollowUpDelay(newCount);
  const dueAt = new Date(Date.now() + delay).toISOString();
  updateLead(lead.id, {
    follow_up_status: "pending",
    follow_up_count: newCount,
    follow_up_due_at: dueAt,
  });
}
```

- **Pros:** Both paths are consistent, removes misleading code
- **Cons:** None
- **Effort:** Small (2 min)
- **Risk:** None — single `updateLead` is already atomic

## Recommended Action

Option A.

## Technical Details

- **Affected files:** `src/twilio-webhook.ts` (remove `runTransaction` wrapper around lines 192-198)

## Acceptance Criteria

- [ ] Neither path in `handleFollowUpSend()` uses `runTransaction()`
- [ ] `runTransaction` import can be removed from twilio-webhook.ts if no other uses exist
- [ ] `tsc --noEmit` passes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-26 | Created from code review | All 4 reviewing agents agreed: single updateLead call doesn't need transaction wrapping |
