---
status: pending
priority: p2
issue_id: "041"
tags: [code-review, typescript, null-handling, analytics]
dependencies: []
unblocks: []
sub_priority: 1
---

# 041: avg_price uses truthiness check instead of null check

## Problem Statement

In `src/db/queries.ts:223`, the `avg_price` field uses a truthiness check (`r.avg_price ? ... : 0`) instead of the explicit null check pattern (`!== null` or `!= null`) used everywhere else in the file. If `avg_price` is `0` (valid value), the truthiness check falls to the `0` branch -- correct by coincidence but inconsistent with the established pattern.

**Found by:** TypeScript Reviewer, corroborated by Pattern Recognition Specialist

## Findings

- Existing pattern at lines 195-196: `core.avg_actual_price !== null ? Math.round(core.avg_actual_price) : null`
- New code at line 223: `r.avg_price ? Math.round(r.avg_price) : 0`
- A $0 average price is effectively impossible in practice (booked gigs with `actual_price IS NOT NULL`) but the pattern should be consistent regardless

## Proposed Solutions

### Option A: Fix to null check (Recommended)
```typescript
avg_price: r.avg_price != null ? Math.round(r.avg_price) : 0,
```
- **Effort:** One-line change
- **Risk:** None

## Technical Details

- **File:** `src/db/queries.ts:223`

## Acceptance Criteria

- [ ] `avg_price` uses `!= null` check, not truthiness

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-05 | Created from review | Two agents independently flagged the same inconsistency |
