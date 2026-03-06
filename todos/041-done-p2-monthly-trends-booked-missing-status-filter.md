---
status: pending
priority: p2
issue_id: "041"
tags: [code-review, analytics, sql, solution-doc-violation]
dependencies: []
unblocks: []
sub_priority: 1
---

# Monthly Trends `booked` Count Missing `status='done'` Filter

## Problem Statement

The Monthly Trends query (Query 5 in `getAnalytics()`) intentionally omits `status = 'done'` on the `received` count to measure total incoming volume. However, the `booked` SUM in the same query also lacks the `status = 'done'` filter, which violates the pattern documented in `docs/solutions/database-issues/align-derived-stat-queries.md`.

In practice this is harmless today because the API only allows setting `outcome = 'booked'` on `done` leads, so `outcome = 'booked'` implies `status = 'done'`. But it violates the documented invariant: "all outcome-related queries must use `WHERE status = 'done'`."

## Findings

- **Location:** `src/db/queries.ts` lines 137-145
- **Agent:** kieran-typescript-reviewer
- **Evidence:** The CASE expression `SUM(CASE WHEN outcome = 'booked' THEN 1 ELSE 0 END)` operates on the unfiltered `leads` table, not the `status = 'done'` subset
- **Solution doc reference:** `docs/solutions/database-issues/align-derived-stat-queries.md` — "When multiple queries feed derived stats in the same UI, they must share the exact same base population"

## Proposed Solutions

### Option A: Add status filter to CASE expression (Recommended)
```sql
SUM(CASE WHEN status = 'done' AND outcome = 'booked' THEN 1 ELSE 0 END) AS booked
```
- **Pros:** One-line fix, keeps `received` as total volume (intentional), protects `booked` count
- **Cons:** None
- **Effort:** Small
- **Risk:** None — same results today, defensive for future

### Option B: Leave as-is with a comment
- **Pros:** No code change
- **Cons:** Violates documented pattern, future risk if outcomes can be set on non-done leads
- **Effort:** None
- **Risk:** Low now, higher if business rules change

## Recommended Action

Option A — one-line fix that aligns with the solution doc.

## Technical Details

- **Affected files:** `src/db/queries.ts`
- **Components:** getAnalytics() Query 5

## Acceptance Criteria

- [ ] Monthly Trends `booked` SUM includes `status = 'done'` in CASE expression
- [ ] `received` count remains unfiltered (intentional deviation, documented)
- [ ] Existing query results unchanged (no behavioral difference with current data)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-05 | Created from review cycle 14 | Solution doc compliance is a P2 even when harmless today |

## Resources

- Solution doc: `docs/solutions/database-issues/align-derived-stat-queries.md`
- Plan: `docs/plans/2026-03-05-feat-lead-analytics-dashboard-plan.md` (Step 2, line 105-106)
