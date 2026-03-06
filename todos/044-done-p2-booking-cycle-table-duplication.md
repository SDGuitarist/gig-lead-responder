---
status: pending
priority: p2
issue_id: "044"
tags: [code-review, dashboard, duplication, simplicity]
dependencies: ["043"]
unblocks: []
sub_priority: 4
---

# renderBookingCycleSection Duplicates Table Logic

## Problem Statement

`renderBookingCycleSection()` manually constructs a `<table>` with `<thead>`, `<tbody>`, column iteration, and FORMATTERS calls (lines 2270-2283) — duplicating what `renderBreakdownTable()` already does. The only reason for the custom table is the summary stat at the top (weighted average), but the summary stat lives outside the table and doesn't require a separate renderer.

## Findings

- **Location:** `public/dashboard.html` lines 2245-2288
- **Agent:** code-simplicity-reviewer
- **Evidence:** Line 2269 already maps rows to include a `label` field (`r.label = r.source_platform`), clearly set up to feed `renderBreakdownTable` but then doesn't follow through. ~17 lines of duplication.

## Proposed Solutions

### Option A: Delegate table to renderBreakdownTable (Recommended)
Keep the summary stat (weighted average), then call `renderBreakdownTable` for the per-source detail table:
```javascript
if (rows.length > 1) {
  var tableRows = rows.map(function(r) { return { label: r.source_platform, ... }; });
  html += renderBreakdownTable('', tableRows, false, cycleCols);
}
```
- **Pros:** ~17 lines removed, single table rendering pattern
- **Cons:** Slightly less control over table markup
- **Effort:** Small
- **Risk:** Low

## Recommended Action

Option A — depends on 043 (label normalization) being done first.

## Technical Details

- **Affected files:** `public/dashboard.html`
- **Components:** renderBookingCycleSection()

## Acceptance Criteria

- [ ] renderBookingCycleSection uses renderBreakdownTable for the per-source table
- [ ] Summary stat (weighted average) still displays above the table
- [ ] Table only shown when `rows.length > 1` (existing behavior)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-05 | Created from review cycle 14 | Abstraction was built but not fully used |

## Resources

- Code simplicity review: Focus Area 2
