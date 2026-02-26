---
title: "Align Derived-Stat Queries on the Same WHERE Scope"
category: database-issues
tags: [analytics, sql, derived-stats, WHERE-clause, data-integrity]
module: leads
symptoms:
  - Dashboard totals don't add up (total != tracked + untracked)
  - Percentage calculations exceed 100% or show negative values
  - Adding a status/category inflates a "remaining" counter
date_documented: 2026-02-25
---

# Align Derived-Stat Queries on the Same WHERE Scope

## Problem

The `getAnalytics()` function runs three SQL queries inside a transaction:

1. **Query 1** — total leads and leads with outcomes (`WHERE status IN ('sent', 'done')`)
2. **Query 2** — breakdown by platform (`WHERE outcome IS NOT NULL`)
3. **Query 3** — breakdown by format (`WHERE outcome IS NOT NULL`)

The Insights tab computes `total_untracked = total_leads - total_with_outcome`.
Because Query 1 included `sent` leads (which can never have outcomes — the API
restricts outcome assignment to `done` leads), `total_untracked` was permanently
inflated. Every lead in `sent` status added 1 to the "untracked" count forever.

Queries 2 and 3 filtered on `outcome IS NOT NULL` with no status filter,
operating on a different population than Query 1.

## Root Cause

Each query was written independently with its own idea of "relevant leads."
When multiple queries feed derived stats in the same UI (totals, breakdowns,
percentages), they must share the exact same base population. Otherwise the
parts don't add up to the whole.

## Solution

All three queries now use `WHERE status = 'done'` as the base filter:

```sql
-- Query 1: totals
SELECT COUNT(*) as total_leads,
       COUNT(outcome) as total_with_outcome
FROM leads WHERE status = 'done';

-- Query 2: by platform
SELECT source_platform, outcome, COUNT(*) as count
FROM leads
WHERE outcome IS NOT NULL AND status = 'done'
GROUP BY source_platform, outcome;

-- Query 3: by format
SELECT ... FROM leads
WHERE outcome IS NOT NULL AND status = 'done'
GROUP BY ...;
```

Now `total_untracked = total_leads - total_with_outcome` is accurate: it counts
only `done` leads that haven't been tracked yet.

## What Was Rejected

- **Keeping `IN ('sent', 'done')` and subtracting sent count separately** —
  More complex, and conceptually wrong: the analytics dashboard is about outcome
  tracking, and only `done` leads are eligible for outcomes.
- **Adding the status filter only to Query 1** — Would still leave Queries 2
  and 3 operating on a different population. All queries must align.

## Risk Resolution

**Flagged by:** Batch A three questions ("the analytics query fix changes what
numbers users see, so it needs careful verification that all three sub-queries
align on the same WHERE clause")

**What happened:** All three queries were updated in a single commit (B-4).
Verified that the base filter `status = 'done'` matches the API's business
rule (only `done` leads can have outcomes set).

**Lesson:** When building an analytics dashboard with derived stats
(subtraction, percentages, breakdowns that must sum to a total), write the
WHERE clause once as a CTE or named scope, then reference it in every query.
Don't let each query define its own filter independently.

## Prevention

- **Review signal:** If an analytics endpoint runs multiple queries, check that
  their WHERE clauses produce the same base population.
- **Derived stats rule:** `A - B = C` is only valid if A and B query the same
  rows. If A includes rows B can never match, C is inflated.
- **CTE pattern:** For 3+ related queries, define the base filter once:
  ```sql
  WITH eligible AS (SELECT * FROM leads WHERE status = 'done')
  SELECT ... FROM eligible ...;
  ```

## Related

- No existing related docs/solutions/ files.
