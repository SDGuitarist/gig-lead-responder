---
status: pending
priority: p3
issue_id: "053"
tags: [code-review, typescript, correctness]
dependencies: []
unblocks: []
sub_priority: 5
---

# avg_price Uses Falsy Check Instead of Null Check

## Problem Statement

In `queries.ts` line 223, `avg_price` uses a falsy check that would treat `0` as null:
```typescript
avg_price: r.avg_price ? Math.round(r.avg_price) : 0,
```
Should be: `r.avg_price != null ? Math.round(r.avg_price) : 0`

Harmless in practice (SQLite AVG won't return 0 for this query), but inconsistent with `avg_actual_price` on line 195 which correctly uses `!== null`.

## Technical Details

- **Affected files:** `src/db/queries.ts` line 223
- **Effort:** Small (one-line fix)

## Acceptance Criteria

- [ ] `avg_price` uses `!= null` check instead of falsy check
