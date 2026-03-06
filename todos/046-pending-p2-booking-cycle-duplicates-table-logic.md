---
status: pending
priority: p2
issue_id: "046"
tags: [code-review, simplification, dashboard]
dependencies: ["043"]
unblocks: []
sub_priority: 6
---

# 046: renderBookingCycleSection duplicates renderBreakdownTable logic

## Problem Statement

`renderBookingCycleSection` (dashboard.html:2245-2288) hand-rolls its own table with manual `<thead>`, `<tbody>`, column iteration, and FORMATTERS lookup. This duplicates what `renderBreakdownTable` already does. The only unique parts are the summary stat card and sample caveat -- the per-source breakdown table is a copy of the generic renderer.

**Found by:** Simplicity Reviewer

## Proposed Solutions

### Option A: Delegate table portion to renderBreakdownTable (Recommended)
Keep the summary stat (lines 2245-2262), delegate the table to `renderBreakdownTable`. Requires adding a `bare` option to skip the wrapper div (since booking cycle already has its own wrapper).
- **Saves:** ~15 LOC
- **Effort:** Medium (touches renderBreakdownTable signature)
- **Risk:** Low

### Option B: Leave as-is
The duplication is contained to one function and the dashboard is near its line budget.
- **Effort:** None
- **Risk:** Line budget pressure increases

## Recommended Action

Option A, combined with fixing #043 (label resolution). Depends on #043 being addressed first.

## Technical Details

- **File:** `public/dashboard.html:2245-2288`
- **Dependency:** #043 simplifies the label chain, making this refactor cleaner

## Acceptance Criteria

- [ ] Booking cycle per-source table uses renderBreakdownTable (or extracted table helper)
- [ ] Summary stat card preserved
- [ ] No visual change

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-05 | Created from review | Simplicity reviewer identified ~15 LOC savings |
