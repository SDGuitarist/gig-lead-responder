---
status: pending
priority: p2
issue_id: "026"
tags: [code-review, performance, database]
dependencies: []
unblocks: ["034"]
sub_priority: 1
---

# 026: updateLead does 3 DB round-trips per update instead of 1

## Problem Statement

Every `updateLead` call performs: (1) `getLead(id)` to check existence, (2) `UPDATE ... SET`, (3) `getLead(id)` to return the updated row. This means 3 queries per update. Callers like `postPipeline` call `updateLead` twice (6 queries) and `completeApproval` chains through `updateLead` + `scheduleFollowUp` for 5+ queries in one transaction.

**Found by:** Performance Oracle

## Findings

- `src/leads.ts:281-321` -- updateLead pattern: getLead + UPDATE + getLead
- `src/post-pipeline.ts:17,47` -- calls updateLead twice per pipeline completion (6 queries)
- `src/leads.ts:554-569` -- completeApproval: updateLead + scheduleFollowUp (5+ queries)
- better-sqlite3 supports SQLite `RETURNING *` clause (SQLite 3.35+)

## Proposed Solutions

### Solution A: Use RETURNING * clause (Recommended)
**Effort:** Small | **Risk:** Low
```typescript
const row = initDb()
  .prepare(`UPDATE leads SET ${setClauses.join(", ")} WHERE id = @id RETURNING *`)
  .get(params) as LeadRecord | undefined;
return row ? normalizeRow(row) : undefined;
```
Cuts every update from 3 queries to 1. Cascades to simplify completeApproval and postPipeline.

## Acceptance Criteria

- [ ] updateLead uses RETURNING * instead of pre/post getLead calls
- [ ] completeApproval query count reduced
- [ ] All existing tests pass
- [ ] Manual test: approve a lead, verify DB state is correct

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-05 | Created from final verification review | Cascade fix -- resolves 034 partially |
