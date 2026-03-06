---
status: pending
priority: p2
issue_id: "051"
tags: [code-review, performance, database, analytics]
dependencies: []
unblocks: []
sub_priority: 5
---

# 045: LOWER(TRIM(event_type)) GROUP BY prevents index use

## Problem Statement

In `src/db/queries.ts` Query 6 (Revenue by Event Type), the `GROUP BY LOWER(TRIM(event_type))` expression wraps the column in functions, preventing SQLite from using an index. This forces a full table scan of all matching rows. Negligible at current scale (<1000 rows) but grows linearly with booked leads.

**Found by:** Performance Oracle

## Proposed Solutions

### Option A: Normalize at write time (Recommended)
Apply `LOWER(TRIM(...))` to `event_type` when inserting/updating leads. Then GROUP BY the raw column.
- **Effort:** Medium (touch insert/update code paths)
- **Risk:** Low -- also fixes data quality at the source
- **Timeline:** Before 5,000 booked leads accumulate

### Option B: Expression index
```sql
CREATE INDEX idx_leads_event_type_lower ON leads(LOWER(TRIM(event_type)));
```
- **Effort:** Small (one migration line)
- **Risk:** Low -- doesn't fix underlying data inconsistency

## Recommended Action

Defer to next cycle. Not blocking at current scale. Option A preferred when addressed.

## Technical Details

- **File:** `src/db/queries.ts:149`

## Acceptance Criteria

- [ ] GROUP BY on event_type can use an index (either via normalized data or expression index)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-05 | Created from review | Not blocking at <1000 rows |
