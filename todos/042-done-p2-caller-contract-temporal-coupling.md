---
status: pending
priority: p2
issue_id: "042"
tags: [code-review, architecture, temporal-coupling, follow-up-pipeline]
dependencies: []
unblocks: []
sub_priority: 2
---

# CALLER CONTRACT Temporal Coupling — Compose Into Single Function

## Problem Statement

`setLeadOutcome()` in `src/db/leads.ts` has a CALLER CONTRACT comment requiring callers to also call `skipFollowUp(id)` when `outcome !== null`. This is a temporal coupling contract — two operations that must happen together but are not atomically enforced. Currently there is only one call site (`src/api.ts` line 219) and it correctly calls both, but a future caller could forget the second step, silently corrupting follow-up effectiveness analytics.

## Findings

- **Location:** `src/db/leads.ts` lines 205-211 (comment), `src/api.ts` lines 218-221 (implementation)
- **Agents:** architecture-strategist, kieran-typescript-reviewer
- **Evidence:** The comment explicitly warns about "silently corrupting follow-up effectiveness analytics" — this is the failure mode a comment cannot prevent
- **Current state:** One call site, correctly implemented. Risk is future-facing.

## Proposed Solutions

### Option A: Compose at DB layer (Recommended)
Create `setLeadOutcomeAndFreeze()` in `queries.ts` (which can import both `leads.ts` and `follow-ups.ts` without cycles):
```typescript
export function setLeadOutcomeAndFreeze(id, outcome, options) {
  return runTransaction(() => {
    const updated = setLeadOutcome(id, outcome, options);
    if (updated && outcome !== null) skipFollowUp(id);
    return updated;
  });
}
```
Remove raw `setLeadOutcome` from barrel export.
- **Pros:** Eliminates the contract entirely — callers cannot forget
- **Cons:** New function, barrel export change
- **Effort:** Small
- **Risk:** Low — wraps existing tested functions

### Option B: Runtime safety net in scheduler
Add a check in the follow-up scheduler: if a lead has `outcome !== null` AND `follow_up_status IN ('pending', 'sent')`, auto-skip and log error.
- **Pros:** Catches violations regardless of source
- **Cons:** Does not prevent the bug, only detects it. Adds complexity to scheduler.
- **Effort:** Medium
- **Risk:** Low

### Option C: Keep comment as-is
- **Pros:** No code change, one call site today
- **Cons:** Comments are not guardrails
- **Effort:** None
- **Risk:** Medium — future call sites may not see the comment

## Recommended Action

Option A — small, clean, eliminates the temporal coupling entirely.

## Technical Details

- **Affected files:** `src/db/queries.ts` (new function), `src/db/index.ts` (barrel export), `src/api.ts` (call site)
- **Components:** outcome recording, follow-up pipeline

## Acceptance Criteria

- [ ] `setLeadOutcomeAndFreeze()` exists and wraps both operations in a transaction
- [ ] `api.ts` calls the composed function instead of calling both separately
- [ ] Raw `setLeadOutcome` is not exported from barrel (or clearly marked internal)
- [ ] CALLER CONTRACT comment removed or updated

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-05 | Created from review cycle 14 | Temporal coupling contracts should be composed, not commented |

## Resources

- Architecture review: Focus Area 2 — Mediator pattern analysis
- Follow-up pipeline doc: `docs/solutions/architecture/follow-up-pipeline-human-in-the-loop-lifecycle.md`
