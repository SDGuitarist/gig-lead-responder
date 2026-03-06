---
status: pending
priority: p2
issue_id: "043"
tags: [code-review, dashboard, maintainability, simplicity]
dependencies: []
unblocks: ["044", "047"]
sub_priority: 3
---

# renderBreakdownTable Label Resolution Chain Is Fragile

## Problem Statement

`renderBreakdownTable()` in `dashboard.html` resolves row labels with a 150-character fallback chain that knows about every possible row shape:

```javascript
var label = FORMAT_NAMES[r.label || r.source_platform || r.event_type || r.reason || r.month]
  || r.label || r.source_platform || r.event_type || r.reason || r.month || 'Unknown';
```

This violates the abstraction -- the generic table function should not know about specific data schemas. It works today by coincidence (each row type has exactly one of these fields set), but adding a new table type requires mentally tracing the chain to confirm it won't collide.

## Findings

- **Location:** `public/dashboard.html` line 2326
- **Agents:** kieran-typescript-reviewer, code-simplicity-reviewer, architecture-strategist (all flagged independently)
- **Evidence:** Three independent agents all flagged the same line as the biggest maintainability concern

## Proposed Solutions

### Option A: Normalize labels at call sites (Recommended)
Each caller sets `r.label` before passing rows to `renderBreakdownTable`:
```javascript
// Monthly Trends caller:
var trendRows = data.monthly_trends.map(function(r) { r.label = r.month; return r; });
// Loss Reasons caller:
var lossRows = data.loss_reasons.map(function(r) { r.label = r.reason; return r; });
```
Then `renderBreakdownTable` only needs: `var label = FORMAT_NAMES[r.label] || r.label || 'Unknown';`
- **Pros:** Eliminates the chain, each caller is explicit, function stays generic
- **Cons:** +3 lines at call sites
- **Effort:** Small
- **Risk:** None

### Option B: Add labelKey parameter
```javascript
function renderBreakdownTable(title, rows, showPct, columns, labelKey) {
  var label = labelKey ? (FORMAT_NAMES[r[labelKey]] || r[labelKey]) : (r.label || 'Unknown');
}
```
- **Pros:** No data mutation, explicit
- **Cons:** Yet another parameter on an already-parameterized function
- **Effort:** Small
- **Risk:** None

## Recommended Action

Option A -- simplest, keeps the function signature clean.

## Technical Details

- **Affected files:** `public/dashboard.html`
- **Components:** renderBreakdownTable(), renderInsights()

## Acceptance Criteria

- [ ] `renderBreakdownTable` resolves labels from `r.label` only
- [ ] All callers set `r.label` before passing rows
- [ ] Existing By Platform and By Format tables still work (they already have `r.label`)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-05 | Created from review cycle 14 | Generic functions should not accumulate schema knowledge |

## Resources

- Code simplicity review: Focus Area 3
