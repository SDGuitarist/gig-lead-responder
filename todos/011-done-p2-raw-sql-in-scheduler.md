---
status: done
priority: p2
issue_id: "011"
tags: [code-review, architecture]
dependencies: []
unblocks: []
sub_priority: 4
---

# 011: Scheduler bypasses updateLead with raw SQL

## Problem Statement

`follow-up-scheduler.ts:54-56` calls `initDb().prepare("UPDATE leads SET follow_up_draft = ...")` directly instead of going through `updateLead()` in `leads.ts`. This violates the single-responsibility boundary — if `updateLead()` ever adds validation, audit logging, or field normalization, this raw query will silently skip it.

The WHERE guard on `follow_up_status = 'sent'` is the justification — `updateLead` does not support conditional WHERE clauses. But the query shape should live in `leads.ts` as a named function.

**Found by:** TypeScript Reviewer, Architecture Strategist
**Known pattern:** `docs/solutions/architecture/atomic-claim-for-concurrent-state-transitions.md`

## Proposed Solutions

### Option A: Extract storeFollowUpDraft() in leads.ts (Recommended)
```typescript
export function storeFollowUpDraft(leadId: number, draft: string): boolean {
  const result = db.prepare("UPDATE leads SET follow_up_draft = @draft, updated_at = @now WHERE id = @id AND follow_up_status = 'sent'")
    .run({ id: leadId, draft, now: new Date().toISOString() });
  return result.changes > 0;
}
```
- Effort: Small
- Risk: None

## Technical Details

- **Affected files:** `src/follow-up-scheduler.ts`, `src/leads.ts`

## Acceptance Criteria

- [ ] Scheduler no longer imports `initDb()`
- [ ] All leads table SQL lives in `leads.ts`

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-04 | Created from review cycle 2 | |
