---
status: pending
priority: p3
issue_id: "047"
tags: [code-review, dashboard, simplicity]
dependencies: ["043"]
unblocks: []
sub_priority: 7
---

# pctGate Flag and Bar Value Calculation Are Implicit

## Problem Statement

Two minor abstraction issues in `renderBreakdownTable`:

1. `pctGate` boolean on DEFAULT_COLUMNS (line 2301) controls whether the Rate column appears. The name is cryptic. Two explicit column arrays (`COLS_WITH_RATE` and `COLS_NO_RATE`) would be clearer.

2. Bar value calculation (line 2324) guesses which field to use for bar width: `r.booked != null ? r.booked : (r.count || 0)`. This works by coincidence of how JS handles `!= null` for undefined vs 0. Making `barValue` an explicit column config option would be cleaner.

## Technical Details

- **Affected files:** `public/dashboard.html` lines 2299-2302, 2324-2325
- **Effort:** Small
