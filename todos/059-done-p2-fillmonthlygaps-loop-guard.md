---
status: done
priority: p2
issue_id: "059"
tags: [code-review, defensive-coding, analytics]
dependencies: []
unblocks: []
sub_priority: 2
---

# 059: Add infinite-loop guard to fillMonthlyGaps()

## Problem Statement

`fillMonthlyGaps()` in `src/db/queries.ts` lines 18-24 uses a while-loop that increments month-by-month from `first` to `last`:

```typescript
let [y, m] = first.split("-").map(Number);
const [endY, endM] = last.split("-").map(Number);
while (y < endY || (y === endY && m <= endM)) {
```

The SQL guarantees `ORDER BY month DESC` so `first` (oldest) is always before `last` (newest). However, `fillMonthlyGaps()` is a pure function with no contract enforcement. If a corrupted row or future caller passes data where `first` is chronologically after `last`, the loop runs forever.

The NaN case (malformed month string) is safe — NaN comparisons evaluate to false, returning an empty array. The danger is the inverted-order case.

**Found by:** TypeScript Reviewer (P2)

## Proposed Solutions

### Option A: Max-iteration guard (Recommended)

```typescript
const MAX_MONTHS = 120; // 10 years — well beyond LIMIT 12
let iterations = 0;
while ((y < endY || (y === endY && m <= endM)) && iterations++ < MAX_MONTHS) {
```

- **Effort:** Trivial (2-line addition)
- **Risk:** None — only activates on pathological input
- **Pros:** Bulletproof against infinite loops
- **Cons:** Slightly more code

### Option B: Early-return guard on inverted dates

```typescript
if (y > endY || (y === endY && m > endM)) return [...rows].reverse();
```

- **Effort:** Trivial (1 line)
- **Risk:** None
- **Pros:** Explicit about the failure mode
- **Cons:** Doesn't protect against other edge cases (e.g., NaN producing accidental truthy comparison in some future JS engine)

## Technical Details

- **Affected file:** `src/db/queries.ts`, lines 18-24
- **Called from:** `getAnalytics()` line 243 — runs on every Insights tab load

## Acceptance Criteria

- [x] fillMonthlyGaps() cannot loop more than 120 iterations
- [x] Existing behavior unchanged for valid input (LIMIT 12 month data)
- [x] TypeScript compiles clean
