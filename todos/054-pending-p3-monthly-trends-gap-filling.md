---
status: pending
priority: p3
issue_id: "054"
tags: [code-review, dashboard, correctness, analytics]
dependencies: []
unblocks: []
sub_priority: 6
---

# Monthly Trends Missing Gap-Filling for Empty Months

## Problem Statement

The Monthly Trends section displays data from SQL Query 5, which only returns months that have leads. If a musician has leads in January and March but not February, February simply won't appear in the table. The plan (Step 4b) mentions gap-filling missing months with zeros in JS (~10 lines), but this was not implemented.

## Findings

- **Location:** `public/dashboard.html` line 2164 (Monthly Trends rendering)
- **Agent:** performance-oracle (correctness observation)
- **Evidence:** No gap-filling code exists. The SQL returns only months with data, and the JS passes them directly to `renderBreakdownTable`.

## Proposed Solutions

### Option A: JS-side gap-filling (~10 lines)
Generate all months from min to max (capped at 12), fill missing months with `{received: 0, booked: 0}`.
- **Effort:** Small
- **Risk:** None

### Option B: Leave as-is
Missing months are simply not shown. This may be acceptable with sparse data.
- **Effort:** None
- **Risk:** None — just a UX preference

## Technical Details

- **Affected files:** `public/dashboard.html`
- **Effort:** Small
