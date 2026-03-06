---
title: "Write-Time Normalization, Loop Guards, and Performance Hoisting for Dashboard Analytics"
date: 2026-03-06
category: logic-errors
tags: [write-time-normalization, loop-guards, hoist-above-loop, css-extraction, defensive-programming, performance, dashboard, analytics]
severity: P2
component: lead-analytics-dashboard
root_cause: "Data normalization at the wrong layer (webhook instead of write boundary), missing defensive limits on data-dependent loops, invariant computation inside loops, and 1,086 lines of inline CSS hurting maintainability"
review_cycle: 15
related_findings: [051, 052, 054, 055, 056, 057, 058, 059, 060]
related:
  - docs/solutions/logic-errors/2026-03-05-dashboard-runtime-validation-and-atomic-ops.md
  - docs/solutions/architecture/2026-03-05-lead-analytics-dashboard-parameterized-rendering.md
  - docs/solutions/logic-errors/constants-at-the-boundary.md
  - docs/solutions/architecture/express-handler-boundary-validation.md
  - docs/solutions/database-issues/align-derived-stat-queries.md
  - docs/solutions/ui-bugs/targeted-dom-toggle-data-attributes.md
---

# Write-Time Normalization, Loop Guards, and Performance Hoisting

Four defensive patterns from Cycle 15 review fixes. All share one principle: **push correctness guarantees to the lowest layer that owns the data.**

### Prior Phase Risk

> "Pre-existing test failures -- unknown root cause, not investigated this session" (Work Feed-Forward)

This compound phase **accepts the risk**. The patterns below are static analysis and review-time checks. The test failures remain uninvestigated and should be the first agenda item in the next brainstorm cycle.

## 1. Write-Time Normalization (051 + 058)

**Problem:** `event_type` values were normalized (trimmed and lowercased) in the webhook handler -- the HTTP entry point. Any other code path calling `insertLead()` directly would store un-normalized data. Query 6 had to use `LOWER(TRIM())` at read time to compensate, masking the inconsistency.

**Root cause:** Normalization placed at the caller (webhook) instead of the data layer (insertLead). Works by accident with one caller; breaks silently when a second write path appears.

**Fix:**

Before (webhook.ts -- caller normalizes):
```typescript
return insertLead({
  event_type: lead.event_type?.trim().toLowerCase() ?? null,
});
```

After (db/leads.ts -- data layer normalizes):
```typescript
// insertLead() handles normalization for ALL callers
event_type: input.event_type?.trim().toLowerCase() ?? null,
```

After (webhook.ts -- caller passes raw value):
```typescript
return insertLead({
  event_type: lead.event_type ?? null,
});
```

Query 6 keeps `LOWER(TRIM())` with a comment for legacy rows inserted before the fix.

**Rule:** Normalize external data at the write boundary (the function that touches the database), not at the caller.

**Prevention checklist:**
- [ ] Does any `trim()`, `toLowerCase()`, or format-coercion happen OUTSIDE the function that writes to the database? Move it in.
- [ ] Grep for the table name -- every write path must go through the same normalization.

**Review question:** *"If I called insertLead() from a completely different entry point, would the data still be clean?"*

## 2. Loop Guards (059)

**Problem:** `fillMonthlyGaps()` uses a while-loop incrementing month-by-month from start to end date. Corrupted data reversing the order causes the loop condition to never become false, freezing the server.

**Root cause:** Pure utility with no contract enforcement -- trusts input to be chronologically ordered with no guarantee.

**Fix:**

Before:
```typescript
let [y, m] = first.split("-").map(Number);
const [endY, endM] = last.split("-").map(Number);
while (y < endY || (y === endY && m <= endM)) {
```

After:
```typescript
let [y, m] = first.split("-").map(Number);
const [endY, endM] = last.split("-").map(Number);
const MAX_MONTHS = 120;
let iterations = 0;
while ((y < endY || (y === endY && m <= endM)) && iterations++ < MAX_MONTHS) {
```

**Rule:** Every while-loop that depends on external data needs a max-iteration guard.

**Prevention checklist:**
- [ ] Does every `while` loop driven by external/computed data have a MAX_ITERATIONS constant?
- [ ] Is the guard constant at module scope (visible and reviewable)?

**Review question:** *"What happens to this loop if the input data is malformed, null, or 10 years in the future?"*

## 3. Hoist Above Loop (060)

**Problem:** Inside `renderBreakdownTable()`, `getBarValue` was declared inside the `for` loop iterating over rows. Recreated the same function object on every iteration. Three independent review agents flagged this.

**Root cause:** Variable placed next to where it was used (inside loop) rather than where it should be scoped (before the loop, since it doesn't change per iteration).

**Fix:**

Before (inside loop):
```javascript
for (var j = 0; j < rows.length; j++) {
  var r = rows[j];
  var getBarValue = cols[0].getBarValue || function(row) { return row.booked != null ? row.booked : (row.count || 0); };
  var barVal = getBarValue(r);
```

After (hoisted above loop):
```javascript
var getBarValue = cols[0].getBarValue || function(row) { return row.booked != null ? row.booked : (row.count || 0); };

for (var j = 0; j < rows.length; j++) {
  var r = rows[j];
  var barVal = getBarValue(r);
```

**Rule:** If a value does not change per iteration, declare it before the loop.

**Prevention checklist:**
- [ ] Are any functions, closures, or objects defined inside a loop that don't depend on the loop variable? Hoist them.
- [ ] Quick test: does it reference the loop index or current item? If no, safe to hoist.

**Review question:** *"Is anything being created per-iteration that could be created once?"*

## 4. CSS Extraction (052)

**Problem:** `dashboard.html` was 2,680 lines with 1,086 lines of inline `<style>` CSS. Too large to navigate, mixed concerns, and prevented browser caching.

**Root cause:** Dashboard built incrementally in a single file. Styling grew without extraction -- monolith by accumulation.

**Fix:**

Before (dashboard.html):
```html
<head>
<style>
  /* 1,086 lines of CSS inline */
  .lead-card { ... }
  .tab-nav { ... }
</style>
</head>
```

After (dashboard.html -- 1 line replaces 1,086):
```html
<head>
<link rel="stylesheet" href="/dashboard.css">
</head>
```

Result: `dashboard.html` dropped from 2,680 to 1,596 lines. CSS is now browser-cacheable.

**Rule:** When inline styles exceed ~100 lines, extract to a separate CSS file.

**Prevention checklist:**
- [ ] Does the HTML file contain more than ~50 lines of `<style>` blocks? Extract to `.css`.
- [ ] After extraction, can `'unsafe-inline'` be removed from `style-src` CSP?

**Review question:** *"Are there inline styles in this file that should live in an external stylesheet?"*

## Risk Resolution

**What was flagged:** HANDOFF's "Least confident" from the work phase: *"Pre-existing test failures -- unknown root cause, not investigated this session."*

**What actually happened:** Cycle 15 review completed successfully without test failures causing incorrect findings. All 7 agents reviewed static code; none depended on test output. The `fillMonthlyGaps()` loop guard (059) was explicitly noted as "a mitigation, not a substitute" for missing unit tests.

**Risk status:** OPEN. Prevention checklists are a second line of defense (review-time). The first line -- automated tests that run on every commit -- is still broken. Until test failures are root-caused, every cycle carries regression risk. Scope as standalone investigation in next brainstorm.

**Lesson learned:** Prevention checklists catch patterns during review, but they do not replace automated test coverage. A 2-line loop guard is cheap insurance; a passing test suite is the real guarantee.

## Three Questions

1. **Hardest pattern to extract from the fixes?** Write-time normalization (058) -- it spans three files (leads.ts, webhook.ts, queries.ts) and required a judgment call about keeping Query 6's `LOWER(TRIM())` for legacy data. The pattern itself ("normalize at the write boundary") is simple, but the real-world application required balancing forward correctness against backward compatibility.

2. **What did you consider documenting but left out, and why?** The `esc()` DOM caching (057) and `requireMinSample` rename (055). Both are straightforward single-line improvements that don't generalize into reusable patterns -- documenting them would add bulk without compounding value.

3. **What might future sessions miss that this solution doesn't cover?** The interaction between write-time normalization and the pre-existing test failures. If `budget-gap.test.ts` or `email-parser.test.ts` failures are caused by un-normalized data, the loop guard and normalization fixes might have silently addressed a symptom without anyone noticing. The next brainstorm should investigate whether the test failures predate or postdate the normalization changes.
