---
title: "Parameterized Dashboard Rendering with Formatters Registry"
date: 2026-03-05
category: architecture
tags: [dashboard, analytics, parameterized-rendering, formatters, column-config, xss, reuse]
severity: medium
component: lead-analytics-dashboard
review_cycle: 14
related_findings: [050, 053]
related:
  - docs/solutions/logic-errors/2026-03-05-dashboard-runtime-validation-and-atomic-ops.md
  - docs/solutions/architecture/escape-at-interpolation-site.md
  - docs/solutions/database-issues/align-derived-stat-queries.md
  - docs/solutions/ui-bugs/targeted-dom-toggle-data-attributes.md
  - docs/solutions/architecture/atomic-claim-for-concurrent-state-transitions.md
---

# Parameterized Dashboard Rendering with Formatters Registry

A reusable architecture for adding analytics sections to the dashboard without writing new rendering code.

### Prior Phase Risk

> "Error handling in the 8-query analytics transaction -- no agent tested failure paths" (Review Feed-Forward)

This doc focuses on the rendering architecture, not query error handling. The error handling gap is documented in the companion doc's Risk Resolution section and remains a deferred item.

## Problem Statement

The Insights tab needed 5 new analytics sections (Booking Cycle Time, Monthly Trends, Revenue by Event Type, Follow-up Effectiveness, Loss Reasons). Writing a separate renderer for each would add ~200 lines of duplicated table HTML, with inconsistent escaping, accessibility attributes, and styling.

## Solution: Three-Layer Architecture

### Layer 1: Formatters Registry

A dictionary mapping format names to functions. Each formatter handles null display (em dash) and XSS escaping via `esc()`:

```javascript
var FORMATTERS = {
  currency: function(v) { return v == null ? '\u2014' : esc('$' + Number(v).toLocaleString()); },
  pct:      function(v) { return v == null ? '\u2014' : esc(v.toFixed(1) + '%'); },
  integer:  function(v) { return v == null ? '\u2014' : esc(Number(v).toLocaleString()); },
  days:     function(v) { return v == null ? '\u2014' : esc(v.toFixed(1) + 'd'); },
  text:     function(v) { return v == null ? '\u2014' : esc(String(v)); },
};
```

**Key design rule:** Every formatter wraps output in `esc()`, even numeric ones. Double-escaping a number string is a no-op, but if a future change accidentally routes a user string through a numeric formatter, `esc()` prevents XSS. This was added as a defense-in-depth fix (#050).

### Layer 2: Column Configuration

Each section defines its columns as an array of descriptor objects:

```javascript
var REVENUE_COLUMNS = [
  { key: 'revenue', label: 'Revenue', format: 'currency' },
  { key: 'count',   label: 'Gigs',    format: 'integer' },
  { key: 'avg_price', label: 'Avg',   format: 'currency' },
];

var LOSS_COLUMNS = [
  { key: 'count', label: 'Count', format: 'integer' },
];
```

Column descriptors support:
- `key` -- field name on the row object
- `label` -- column header text
- `format` -- references a `FORMATTERS` entry
- `getValue(r)` -- optional custom getter (overrides `r[key]`)
- `pctGate` -- optional flag controlling rate column visibility

### Layer 3: Parameterized Table Renderer

`renderBreakdownTable(title, rows, showPct, columns)` builds the full table HTML generically:

```javascript
var val = cols[k].getValue ? cols[k].getValue(r) : r[cols[k].key];
var fmt = FORMATTERS[cols[k].format] || FORMATTERS.text;
html += '<td>' + fmt(val) + '</td>';
```

The renderer handles:
- Bar widths (proportional to max value)
- Thin-data styling (opacity for rows with few data points)
- Accessibility (`scope="col"`, `sr-only` caption)
- Empty states (delegates to `renderEmptySection`)

## How to Add a New Dashboard Section

1. **Add the query** in `src/db/queries.ts` inside the `getAnalytics()` transaction. Follow the WHERE clause rules from `align-derived-stat-queries.md`.

2. **Add the interface** in `src/types.ts` and wire it into `AnalyticsResponse`.

3. **Validate results** at the query boundary -- use `.map()` with runtime validation, not `as` casts. See companion doc for the pattern.

4. **Normalize labels at the call site:**
   ```javascript
   var rows = data.new_section.map(function(r) { r.label = r.whatever_field; return r; });
   ```

5. **Define columns** (if not using `DEFAULT_COLUMNS`):
   ```javascript
   var NEW_COLUMNS = [
     { key: 'value', label: 'Value', format: 'currency' },
   ];
   ```

6. **Call the renderer:**
   ```javascript
   renderBreakdownTable('Section Title', rows, false, NEW_COLUMNS);
   ```

7. **Handle empty state** -- `renderBreakdownTable` handles this automatically via `renderEmptySection`.

8. **Use `!= null` for numeric checks**, never truthiness. A price of `$0` is valid (#053).

## Prevention Checklist

### SQL Layer
- [ ] WHERE `status = 'done'` on every outcome-related aggregate
- [ ] Use `stmt()` cache for all static SQL
- [ ] Null-coalesce every nullable column (`?? 0` or `?? null`)
- [ ] Validate enum values with `.includes()` at the boundary
- [ ] Normalize text before grouping (`LOWER(TRIM(column))`)
- [ ] Add query inside the existing `db.transaction()` block

### Rendering Layer
- [ ] Use `renderBreakdownTable()` -- do not hand-build `<table>` HTML
- [ ] Define columns with explicit `format` keys referencing FORMATTERS
- [ ] Normalize labels at the call site, not in the shared function
- [ ] Every HTML value passes through `esc()` (FORMATTERS handle this)
- [ ] Use `renderEmptySection()` for zero-data states
- [ ] Use `!= null` for numeric null checks, not truthiness

### Integration
- [ ] Add interface to `AnalyticsResponse` in `src/types.ts`
- [ ] Test: API returns valid JSON for zero leads, one lead, many leads
- [ ] Test: null/zero values display correctly (em dash vs `$0`)

## Anti-Patterns to Avoid

| Anti-Pattern | What Happens | Do This Instead |
|---|---|---|
| Hand-built `<table>` HTML | Inconsistent escaping, missing accessibility | Use `renderBreakdownTable` with column descriptors |
| Truthiness check on numbers (`if (price)`) | `$0` treated as missing | `price != null` |
| `as TypeName[]` on DB results | Silent data corruption on unexpected values | `.map()` with `.includes()` validation |
| Label resolution inside generic function | Fallback chain grows per caller | Normalize `r.label` at call site |
| New formatter without `esc()` | XSS gap | Always wrap output in `esc()` |

## Key Metrics

- 5 new sections added with 143 net new lines in dashboard.html
- Parameterized table saved ~40 lines vs separate renderers
- Dashboard at 2,694 / 2,800 line budget (96%)
- CSS extraction (#052) available when budget is reached

## Related Documentation

| Doc | Relevance |
|-----|-----------|
| [Runtime validation and atomic ops](../logic-errors/2026-03-05-dashboard-runtime-validation-and-atomic-ops.md) | Companion doc -- fix patterns from same review cycle |
| [Escape at interpolation site](escape-at-interpolation-site.md) | XSS prevention principle underlying FORMATTERS |
| [Align derived stat queries](../database-issues/align-derived-stat-queries.md) | WHERE clause invariant for analytics queries |
| [Targeted DOM toggle](../ui-bugs/targeted-dom-toggle-data-attributes.md) | Dashboard DOM interaction pattern |
| [Atomic claim](atomic-claim-for-concurrent-state-transitions.md) | Atomic state transition pattern |

## Risk Resolution

**Flagged risk (Review Feed-Forward):** Error handling in the 8-query analytics transaction.

**What happened:** Not addressed in this work phase. The rendering architecture and fixes focused on correctness, not failure paths. Transaction error handling remains untested.

**Lesson:** The `getAnalytics()` transaction contains 8 queries. If any throws (e.g., malformed `pricing_json` in `json_extract`), SQLite rolls back cleanly, but the Express error handler's response for this specific path is unverified. Document as deferred for a future review cycle.

## Three Questions

1. **Hardest pattern to extract from the fixes?** Deciding the boundary between this doc and the companion logic-errors doc. The companion covers the fix patterns (runtime validation, atomic composition, label normalization). This doc covers the rendering architecture (formatters, column config, parameterized table). The "how to add a section" checklist bridges both.

2. **What did you consider documenting but left out, and why?** CSS-only chart rendering (Monthly Trends horizontal bars). It's a one-off implementation detail, not a reusable pattern yet. If a second chart type is needed, extract the pattern then.

3. **What might future sessions miss that this solution doesn't cover?** The 2,800-line budget is at 96%. The next feature addition will likely trigger CSS extraction (#052). This doc doesn't cover the extraction process or how to maintain the rendering patterns across split files.
