---
status: done
priority: p2
issue_id: "060"
tags: [code-review, performance, dashboard, quality]
dependencies: []
unblocks: []
sub_priority: 3
---

# 060: Hoist getBarValue resolution above the row loop

## Problem Statement

In `public/dashboard.html` line 1228, inside `renderBreakdownTable()`:

```javascript
for (var j = 0; j < rows.length; j++) {
    var r = rows[j];
    var getBarValue = cols[0].getBarValue || function(row) { return row.booked != null ? row.booked : (row.count || 0); };
    var barVal = getBarValue(r);
```

The `getBarValue` resolution depends only on `cols[0]`, which does not change between iterations. The fallback anonymous function is created as a new closure on every row when `cols[0].getBarValue` is falsy. This is:

1. Wasteful (new function object per row, ~10 per table render)
2. Inconsistent with commit #057's optimization intent (caching `_escDiv` to avoid per-call allocation)
3. Harder to read — makes it look like `getBarValue` might vary per row

**Found by:** Performance Oracle (P3), Code Simplicity Reviewer (P2), TypeScript Reviewer (P3) — 3 independent agents flagged this

## Proposed Solutions

### Option A: Hoist above the loop (Recommended)

Move `getBarValue` between the `<thead>` generation (line 1223) and the row loop (line 1225):

```javascript
html += '<th scope="col" class="bar-cell"></th></tr></thead><tbody>';

var getBarValue = cols[0].getBarValue || function(row) { return row.booked != null ? row.booked : (row.count || 0); };

for (var j = 0; j < rows.length; j++) {
    var r = rows[j];
    var barVal = getBarValue(r);
```

- **Effort:** Trivial (move 1 line)
- **Risk:** None — identical behavior
- **Pros:** Eliminates per-row allocation, clearer intent
- **Cons:** None

## Technical Details

- **Affected file:** `public/dashboard.html`, line 1228 (move to ~1224)

## Acceptance Criteria

- [x] `getBarValue` is resolved once per table, not per row
- [x] Dashboard renders identically (breakdown tables show same data/bars)
