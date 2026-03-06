---
status: pending
priority: p1
issue_id: "040"
tags: [code-review, typescript, type-safety, analytics]
dependencies: []
unblocks: []
sub_priority: 1
---

# 040: Unsafe type assertion on lossReasons bypasses mapping pattern

## Problem Statement

In `src/db/queries.ts:232`, the `lossReasons` query result is cast directly with `as LossReasonEntry[]` instead of being mapped through a transformer like every other query result in `getAnalytics()`. `LossReasonEntry.reason` is typed as `LossReason | "unspecified"` (a 5-value union), but the SQL returns `reason: string`. The `as` cast silently trusts that the database value matches the union type. If a freeform string enters `outcome_reason` (bypassing API validation), it would violate the type contract downstream.

**Found by:** TypeScript Reviewer, corroborated by Pattern Recognition Specialist

## Findings

- Every other query result in `getAnalytics()` uses `.map((r): TypeName => ({...}))` to explicitly transform and validate fields
- `lossReasons` is the only one that skips the mapping step and casts directly
- The `LOSS_REASONS` constant (`["price", "competitor", "cancelled", "other"]`) exists in `src/types.ts:209` and can be used for runtime validation
- `COALESCE(outcome_reason, 'unspecified')` in the SQL means "unspecified" is a valid value, but any other string should be coerced

## Proposed Solutions

### Option A: Map with runtime validation (Recommended)
```typescript
loss_reasons: lossReasons.map((r): LossReasonEntry => ({
  reason: LOSS_REASONS.includes(r.reason as any)
    ? (r.reason as LossReason)
    : "unspecified",
  count: r.count,
})),
```
- **Pros:** Consistent with all other mappings, runtime-safe, handles edge cases
- **Cons:** 5 extra lines
- **Effort:** Small
- **Risk:** None

### Option B: Map without validation
```typescript
loss_reasons: lossReasons.map((r): LossReasonEntry => ({
  reason: r.reason as LossReason | "unspecified",
  count: r.count,
})),
```
- **Pros:** Pattern-consistent, minimal change
- **Cons:** Still trusts the database value
- **Effort:** Small
- **Risk:** Low (same trust level as current, but pattern-consistent)

## Recommended Action

Option A -- adds runtime validation and pattern consistency.

## Technical Details

- **File:** `src/db/queries.ts:232`
- **Import needed:** `LOSS_REASONS` from `../types.js` (already imported as type, need the const value)

## Acceptance Criteria

- [ ] `lossReasons` mapped through `.map()` like all other query results
- [ ] Unknown reason values coerced to `"unspecified"` at runtime
- [ ] TypeScript compiles without errors

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-05 | Created from review | TypeScript Reviewer flagged pattern inconsistency |

## Resources

- PR branch: feat/lead-analytics-dashboard
- Pattern reference: queries.ts lines 196-230 (all other mappings)
