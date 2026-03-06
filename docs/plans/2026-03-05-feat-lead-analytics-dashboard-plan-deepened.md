---
title: "feat: Lead Analytics Dashboard"
type: feat
status: active
date: 2026-03-05
deepened: 2026-03-05
origin: docs/brainstorms/2026-03-05-lead-analytics-dashboard-brainstorm.md
feed_forward:
  risk: "Follow-up count bug -- setLeadOutcome() doesn't freeze follow-ups, so follow_up_count can drift after outcome recording"
  verify_first: true
---

# feat: Lead Analytics Dashboard

## Enhancement Summary

**Deepened on:** 2026-03-05
**Research agents used:** 10 (Learnings Researcher, SQLite Best Practices, CSS Charts, Parameterized Tables, Empty State UX, TypeScript Reviewer, Performance Oracle, Simplicity Reviewer, Security Sentinel, Architecture Strategist)

### Key Improvements
1. **NULL handling made explicit** -- SQLite aggregates return NULL on empty sets; plan now specifies coalesce-in-query-layer pattern matching existing codebase
2. **~70 lines of YAGNI cut** -- Monthly Trends uses plain table (not CSS bars), color-coded rates dropped, sub-day formatting dropped, `total_lost` removed
3. **Accessibility added** -- `<caption>`, `scope` attributes on `<th>`, `aria-hidden` on decorative bars, formatters registry for consistent cell rendering
4. **Empty state UX upgraded** -- Show sections with progress indicators instead of hiding; tiered sample thresholds (n<5 suppress rates, n<30 add caveat)
5. **Security gap closed** -- Explicit acceptance criterion for `esc()` on all user-originated strings in custom renderers
6. **Type precision improved** -- `LossReasonEntry.reason` uses existing `LossReason` union type, `month` format documented

### New Considerations Discovered
- SQLite `LOWER()` is ASCII-only -- fine for US data but worth documenting
- `total()` function returns 0.0 on empty sets (vs `SUM()` returning NULL) -- use it
- `COUNT(CASE WHEN ... THEN 1 END)` must NOT use `ELSE 0` (would count everything)
- `setLeadOutcome` + `skipFollowUp` coupling needs a JSDoc comment on `setLeadOutcome`
- Dashboard at ~2,728 lines post-change = 96% of budget; flag extraction for next brainstorm

---

## Prior Phase Risk

> **Least confident (from brainstorm):** "The follow-up count bug (setLeadOutcome doesn't freeze follow-ups) must be fixed as a prerequisite before follow-up effectiveness analytics are meaningful."

**Addressed:** Step 0 of this plan fixes the bug before any analytics work begins. The fix goes in `src/api.ts` (API layer) to avoid circular dependency between `leads.ts` and `follow-ups.ts`.

## Overview

Extend the Insights tab from 3 summary cards + 2 breakdowns to a full analytics dashboard with 5 new sections: Booking Cycle Time, Monthly Trends, Revenue by Event Type, Follow-up Effectiveness, and Loss Reasons. All data comes from the existing SQLite `leads` table -- no schema changes needed.

**Approach:** Extend the existing single `GET /api/analytics` endpoint (Option A from brainstorm). The database is tiny (< 100 leads expected), all queries are fast SQLite reads in a single transaction. (see brainstorm: docs/brainstorms/2026-03-05-lead-analytics-dashboard-brainstorm.md, "Decision: Option A")

## Problem Statement / Motivation

The current Insights tab shows outcome counts and two breakdowns (by Platform, by Format) but lacks actionable business intelligence: which sources convert fastest, what event types generate the most revenue, whether follow-ups actually help, and why leads are lost. These insights inform pricing, marketing, and follow-up strategy decisions.

## Proposed Solution

### Step 0: Prerequisite Bug Fix -- skipFollowUp on Outcome

**File:** `src/api.ts` (POST /api/leads/:id/outcome handler)

When `setLeadOutcome()` sets an outcome (outcome !== null), the API handler must also call `skipFollowUp(id)` to freeze the follow-up pipeline. Without this, the scheduler can increment `follow_up_count` after an outcome is recorded, making follow-up effectiveness data inaccurate.

**Implementation:**
- Import `skipFollowUp` from `./db/index.js` in `src/api.ts`
- After `setLeadOutcome(id, outcome, options)` succeeds and outcome !== null, call `skipFollowUp(id)`
- Re-fetch lead with `getLead(id)` for the response (ensures follow-up status is current)
- Do NOT call `skipFollowUp` when outcome === null (clearing an outcome) -- skip is irreversible
- `skipFollowUp()` is idempotent -- no-op if no active follow-up

**Why API layer, not DB layer:** `follow-ups.ts` imports from `leads.ts`. Importing `skipFollowUp` into `leads.ts` would create a circular dependency. The brainstorm specifically flags this risk (see brainstorm: Section 4 bug notes).

**Commit this separately before analytics work.**

#### Research Insights (Step 0)

**Caller Contract Documentation (Architecture Review):**
- Add a JSDoc comment on `setLeadOutcome` in `src/db/leads.ts` documenting that callers MUST call `skipFollowUp()` when outcome !== null. This coupling is implicit -- if a future CLI tool or webhook calls `setLeadOutcome` without `skipFollowUp`, follow-up effectiveness data silently corrupts.
- This is the highest-value single-line addition in the plan: one comment prevents a data integrity bug that would be hard to diagnose after the fact.

**Follow-Up Lifecycle Context (Learnings: follow-up-pipeline-human-in-the-loop-lifecycle.md):**
- Follow-up status is a separate state machine from lead status. A lead can be `status = 'done'` with `follow_up_status = 'sent'` or `'skipped'`. The analytics queries must account for this distinction when breaking down follow-up outcomes.

---

### Step 1: Extend Types -- `src/types.ts`

Add new interfaces for the 5 analytics sections and extend `AnalyticsResponse`:

```typescript
// New interfaces (~15 lines)
interface BookingCycleEntry {
  source_platform: string;
  avg_days: number;      // Coalesced to 0 in query layer
  sample_size: number;
}

interface MonthlyTrendEntry {
  month: string;        // "YYYY-MM" format (e.g., "2026-03")
  received: number;
  booked: number;
}

interface RevenueByTypeEntry {
  event_type: string;
  revenue: number;       // Coalesced to 0 in query layer
  count: number;
  avg_price: number;     // Coalesced to 0 in query layer
}

interface FollowUpEffectivenessEntry {
  follow_up_count: number;
  total: number;
  booked: number;
  lost: number;
  no_reply: number;
}

interface LossReasonEntry {
  reason: LossReason | 'unspecified';  // Uses existing LossReason union type
  count: number;
}

// Extend AnalyticsResponse with new fields:
//   booking_cycle: BookingCycleEntry[]
//   monthly_trends: MonthlyTrendEntry[]
//   revenue_by_type: RevenueByTypeEntry[]
//   follow_up_effectiveness: FollowUpEffectivenessEntry[]
//   loss_reasons: LossReasonEntry[]
```

#### Research Insights (Step 1)

**NULL Handling Pattern (TypeScript Review -- P1):**
- SQLite `AVG()` and `SUM()` return NULL on empty result sets. The interfaces above use bare `number` -- this is correct ONLY because the query layer coalesces NULLs before returning (matching existing pattern at queries.ts:125-137 with `?? 0`).
- The plan MUST coalesce in the query layer, not the API layer. The `api.ts` handler is a one-liner (`res.json(getAnalytics())`) and should stay that way.
- Affected fields: `avg_days`, `revenue`, `avg_price`.

**Naming Convention (TypeScript Review -- P2):**
- The `*Entry` suffix diverges from existing `*Breakdown` pattern. This is an intentional choice -- these are row-level types for arrays, not breakdown containers. Acceptable.

**Type Precision (TypeScript Review -- P3):**
- `LossReasonEntry.reason` now uses `LossReason | 'unspecified'` instead of bare `string`, maintaining type safety with the existing union type (types.ts:209).
- `month` field now has a format comment (`"YYYY-MM"`) for intent clarity.

**Removed: `total_lost` field (Simplicity Review):**
- The existing `AnalyticsResponse` already has `lost: number` (types.ts:225). Use `data.lost` as the denominator for loss reason percentages in the dashboard. No new field needed.

---

### Step 2: Add Queries -- `src/db/queries.ts`

Add 5 new queries inside the existing `getAnalytics()` read-only transaction. All queries that involve outcomes MUST include `WHERE status = 'done'` to match the existing base population. (see docs/solutions/database-issues/align-derived-stat-queries.md)

**Critical WHERE clause alignment:**

| Query | Base Filter | Rationale |
|-------|------------|-----------|
| Booking Cycle Time | `status='done' AND outcome='booked' AND outcome_at IS NOT NULL` | Only booked leads with timestamps |
| Monthly Trends (received) | No status filter | Total lead volume regardless of pipeline stage |
| Monthly Trends (booked) | `outcome='booked'` | Booked subset of total |
| Revenue by Event Type | `status='done' AND outcome='booked' AND actual_price IS NOT NULL` | Add `status='done'` -- brainstorm SQL was missing it |
| Follow-up Effectiveness | `status='done' AND outcome IS NOT NULL` | All resolved leads |
| Loss Reasons | `status='done' AND outcome='lost'` | Add `status='done'` -- brainstorm SQL was missing it. Use COALESCE for NULL outcome_reason |

**Monthly Trends intentional deviation:** The `received` count deliberately omits `status = 'done'` because it measures total incoming lead volume (useful for spotting seasonal spikes), while `booked` counts conversions. This is documented, not accidental.

**Loss Reasons NULL handling:** Use `COALESCE(outcome_reason, 'unspecified')` so leads marked "lost" without a reason appear as "Unspecified" rather than being silently excluded.

**Revenue by Event Type normalization:** Use `LOWER(TRIM(event_type))` as the GROUP BY expression to prevent "Wedding" and "wedding" fragmenting. Sufficient for now -- further normalization deferred until real data shows fragmentation level.

**SQL for all 5 queries** (see brainstorm: Sections 1-5 for drafts, adjusted below):

```sql
-- 1. Booking Cycle Time (renamed from "Response Time" -- measures days to outcome, not response speed)
SELECT source_platform,
  COALESCE(AVG(julianday(outcome_at) - julianday(created_at)), 0) AS avg_days,
  COUNT(*) AS sample_size
FROM leads
WHERE status = 'done' AND outcome = 'booked' AND outcome_at IS NOT NULL
GROUP BY source_platform

-- 2. Monthly Trends (last 12 months)
-- Intentionally no status filter on received: counts total incoming volume
SELECT strftime('%Y-%m', created_at) AS month,
  COUNT(*) AS received,
  SUM(CASE WHEN outcome = 'booked' THEN 1 ELSE 0 END) AS booked
FROM leads
GROUP BY month
ORDER BY month DESC
LIMIT 12

-- 3. Revenue by Event Type
SELECT LOWER(TRIM(event_type)) AS event_type,
  COALESCE(total(actual_price), 0) AS revenue,
  COUNT(*) AS count,
  COALESCE(AVG(actual_price), 0) AS avg_price
FROM leads
WHERE status = 'done' AND outcome = 'booked' AND actual_price IS NOT NULL
  AND event_type IS NOT NULL
GROUP BY LOWER(TRIM(event_type))
ORDER BY revenue DESC

-- 4. Follow-up Effectiveness
SELECT follow_up_count,
  COUNT(*) AS total,
  COUNT(CASE WHEN outcome = 'booked' THEN 1 END) AS booked,
  COUNT(CASE WHEN outcome = 'lost' THEN 1 END) AS lost,
  COUNT(CASE WHEN outcome = 'no_reply' THEN 1 END) AS no_reply
FROM leads
WHERE status = 'done' AND outcome IS NOT NULL
GROUP BY follow_up_count
ORDER BY follow_up_count

-- 5. Loss Reasons
SELECT COALESCE(outcome_reason, 'unspecified') AS reason,
  COUNT(*) AS count
FROM leads
WHERE status = 'done' AND outcome = 'lost'
GROUP BY reason
ORDER BY count DESC
```

**NULL handling:** All aggregate results coalesced in queries.ts using `?? 0` or SQL-level `COALESCE`/`total()`. Return empty arrays `[]` when no rows match -- the dashboard handles empty arrays with per-section empty states.

**Estimated:** ~50-60 lines added to queries.ts.

#### Research Insights (Step 2)

**SQLite-Specific Best Practices:**

1. **Use `total()` instead of `SUM()` for revenue** -- SQLite's `total()` returns 0.0 on empty sets instead of NULL. Used above in Revenue by Event Type query. (Source: SQLite official aggregate docs)

2. **`COUNT(CASE WHEN ... THEN 1 END)` without ELSE** -- For conditional counting, omit `ELSE 0`. The implicit `ELSE NULL` causes COUNT to skip non-matching rows. Adding `ELSE 0` would count ALL rows. Used in Follow-up Effectiveness query. (Source: SQLite aggregate best practices)

3. **`COALESCE(AVG(...), 0)` for averages** -- AVG returns NULL on empty sets. Wrap with COALESCE for Booking Cycle Time and Revenue avg_price. Done in SQL rather than TypeScript to keep api.ts as a passthrough. (Source: existing codebase pattern at queries.ts:125-137)

4. **julianday() precision** -- Returns IEEE 754 double, precise to ~0.1ms for contemporary dates. No precision issues for day-level arithmetic. Format result with `toFixed(1)` in the presentation layer. (Source: SQLite date/time docs)

5. **LOWER() is ASCII-only** -- SQLite's built-in LOWER() only handles A-Z. Fine for US music business data (venue names, event types). If non-ASCII data appears (e.g., Spanish venue names), normalize at insert time instead. (Source: SQLite collation docs)

6. **strftime format matching** -- The `strftime('%Y-%m', created_at)` format sorts correctly as a string (lexicographic = chronological). Ensure the gap-filling JS (if used) generates keys in the same `YYYY-MM` format.

**WHERE Clause Alignment (Learnings -- CRITICAL):**
- Per `docs/solutions/database-issues/align-derived-stat-queries.md`: When multiple queries feed derived stats in the same UI, they must share the same base WHERE clause. The documented bug: one query used `WHERE status IN ('sent', 'done')` while another used `WHERE outcome IS NOT NULL`, causing permanent inflation.
- The Monthly Trends deviation (no status filter on received) is intentional and documented. Add an inline SQL comment: `-- Intentionally no status filter: counts total incoming volume`.

**Transaction Pattern (SQLite Research):**
- Use `db.transaction(() => {...}).deferred()` for read-only work. The `.deferred()` mode doesn't acquire a write lock, allowing concurrent writes.
- 8 queries in one transaction is fine at <1000 rows (sub-millisecond total). No need for CTEs combining queries -- separate prepared statements are clearer and independently modifiable.

**No New Indexes Needed (Performance Review):**
- `source_platform` and `outcome` already indexed. `created_at` and `event_type` are not indexed but full scans on <1000 rows are microseconds. Revisit only if table grows past 10K rows.

---

### Step 3: Wire API Response -- `src/api.ts`

The existing `GET /api/analytics` handler calls `getAnalytics()` and returns the result directly. No changes needed to the route itself -- just ensure the extended `getAnalytics()` return value matches the extended `AnalyticsResponse` type.

**Estimated:** ~5 lines (the response assembly is inside `getAnalytics()`).

#### Research Insights (Step 3)

**Keep api.ts as a Passthrough (Architecture Review):**
- The current handler is a one-liner: `res.json(getAnalytics())`. All NULL coercion, empty-array defaults, and data shaping belong in `getAnalytics()` inside `queries.ts`. Do not add transformation logic to `api.ts`.

**Single Endpoint is Correct (Performance + Architecture Reviews):**
- No independent consumers exist. The dashboard needs all data at once. Splitting would add HTTP round-trips for no benefit.
- Transaction consistency ensures all 8 queries see the same snapshot.
- JSON payload will be a few KB at most. Well under any threshold.
- Escape hatch: the per-section type decomposition (`BookingCycleEntry`, etc.) already makes future endpoint splitting straightforward if needed.

---

### Step 4: Dashboard Rendering -- `public/dashboard.html`

#### 4a. Parameterize `renderBreakdownTable()`

The current `renderBreakdownTable(title, rows, showPct)` renders `{ label, total, booked, rate }[]` with hardcoded "Booked" and "Rate" columns. This doesn't fit Loss Reasons (needs "Count | % of Losses") or Revenue by Event Type (needs "Bookings | Revenue | Avg Price").

**Solution:** Add an optional `columns` parameter to `renderBreakdownTable()` that specifies column definitions. Default behavior stays the same (backwards compatible). New sections pass custom column configs.

```javascript
// Column definition shape (simplified from ag-Grid/Tabulator patterns)
// { key: 'count', label: 'Count', align: 'right', format: 'integer' }

// Formatters registry (~8 lines)
const FORMATTERS = {
  currency: (v) => v == null ? '---' : '$' + v.toLocaleString(),
  pct:      (v) => v == null ? '---' : v.toFixed(1) + '%',
  integer:  (v) => v == null ? '---' : v.toLocaleString(),
  days:     (v) => v == null ? '---' : v.toFixed(1) + 'd',
};

// renderBreakdownTable(title, rows, showPct, columns)
// - columns omitted: uses DEFAULT_COLUMNS (backwards compatible)
// - columns provided: uses custom column definitions
```

This adds ~20 lines to the function vs writing 2 entirely new renderers (~60+ lines).

#### Research Insights (Step 4a)

**Column Config Pattern (Table Renderer Research):**
- Industry consensus (ag-Grid, Tabulator): column definitions use `{ key, label, align, format }`. The `key` maps to data, `label` is the header, `format` selects a formatter.
- Keep it minimal: do NOT add `barKey`/`barMax` as separate config parameters. Derive the bar from the first numeric column if bars are needed. Two callers don't justify a generic config system.
- The formatters registry (`FORMATTERS`) centralizes formatting logic and handles NULL/undefined consistently with `'---'` fallback.

**Backwards Compatibility (Table Renderer Research):**
- Existing callers: `renderBreakdownTable("Losses", data, true)` -- works as before, gets DEFAULT_COLUMNS.
- New callers: `renderBreakdownTable("Revenue", data, false, revenueColumns)` -- full control.
- The optional 4th parameter approach is simpler than refactoring to an options object for just two new callers.

**Accessibility (Table Renderer Research):**
- Add `<caption>` element with the `title` parameter as text (accessible name for screen readers, translates automatically unlike `aria-label`).
- Add `scope="col"` on every `<th>` in the header row.
- First column (row labels) should use `<th scope="row">` instead of `<td>`.
- Bar cells: add `aria-hidden="true"` since they are decorative (numeric value is in adjacent cell).

#### 4b. Render New Sections in `renderInsights(data)`

Add 5 new sections after the existing breakdowns. Each section:
1. Checks if its data array is non-empty
2. If empty, shows a purposeful empty state with progress indicator (see 4d)
3. If non-empty but sample size < 5, shows raw counts only (suppress rates/percentages)
4. If sample size 5-29, shows data with "Based on X leads" footnote
5. If sample size >= 30, renders fully with no caveats

**Section rendering plan:**

| Section | Renderer | Display |
|---------|----------|---------|
| Booking Cycle Time | New stat card + per-source table | "Avg X.X days to booking" card + source breakdown |
| Monthly Trends | Parameterized `renderBreakdownTable()` | Columns: Month, Received, Booked |
| Revenue by Event Type | Parameterized `renderBreakdownTable()` | Columns: Event Type, Bookings, Revenue, Avg Price |
| Follow-up Effectiveness | Custom renderer | Table with outcome columns per follow-up count row |
| Loss Reasons | Parameterized `renderBreakdownTable()` | Columns: Reason, Count, % of Losses with bars |

**Monthly Trends simplified (Simplicity Review recommendation):** Use parameterized `renderBreakdownTable()` instead of a custom CSS bar chart renderer. A plain table with columns [Month, Received, Booked] conveys the same information with zero new CSS and ~40 fewer lines. This also gives the parameterized table a third caller, better justifying the parameterization. Months ordered chronologically (reverse the DESC from SQL).

**Booking Cycle Time display:** Format as "X.X days" always. Sub-day "X hours" formatting removed (Simplicity Review: cycle times measure created_at to outcome_at, which is days/weeks, not hours -- the formatting branch would never trigger).

**Follow-up Effectiveness renderer:** Table columns: "Follow-ups | Total | Booked | Lost | No Reply | Book Rate". Row for follow_up_count = 0 labeled "No follow-ups" (baseline data). Book rate shown as plain percentage text (no color-coding -- Simplicity Review: color thresholds on tiny samples are misleading, not informative).

**Estimated:** ~130 lines for all 5 sections + parameterized table (~20 lines) + CSS (~20 lines) = ~170 lines in dashboard.html.

#### Research Insights (Step 4b)

**CSS Bar Patterns (if bars are added later):**
- Use CSS custom properties: `style="--value: 72"` + `width: calc(var(--value) * 1%)` in CSS. Separates data from presentation.
- For stacked bars (received + booked): flexbox row with `flex-basis: calc(var(--value) * 1%)` per segment.
- Always respect `prefers-reduced-motion` for any bar animations.
- These patterns are documented here for future reference but NOT implemented in this plan (plain tables used instead).

**Escaping at Interpolation Site (Learnings -- CRITICAL):**
- Per `docs/solutions/architecture/escape-at-interpolation-site.md`: escape at the point of interpolation, not at the point of origin.
- Fields requiring `esc()`: `source_platform` (Booking Cycle Time), `event_type` (Revenue by Type), `reason`/`outcome_reason` (Loss Reasons).
- The parameterized `renderBreakdownTable()` must apply `esc()` to all label cells. Custom renderers (Booking Cycle Time stat card, Follow-up Effectiveness) must also apply `esc()` to any string fields.

**Targeted DOM Updates (Learnings -- targeted-dom-toggle-data-attributes.md):**
- Mark each new analytics section with `data-analytics="section-name"` during render for targeted updates. Avoids full DOM rebuilds that destroy scroll position and form focus.

#### 4c. CSS for New Sections

Add styles for:
- `.cycle-stat` -- booking cycle time stat card
- Mobile responsive rules for new tables
- `.thin-data` adjustments for new sections (suppress bars, show em-dashes)

Use existing color scheme: green (#4caf50) for booked, amber (#ff9800) for no_reply, red (#f44336) for lost.

**Estimated:** ~20 lines CSS.

#### 4d. Empty State Handling

**Upgraded approach (Empty State UX Research):**

Instead of hiding empty sections entirely, show them with purposeful empty states:

| Sample Size | Behavior |
|---|---|
| n = 0 | Show section header + empty state message with action hint |
| n = 1-4 | Show raw counts only, suppress rates/percentages. Show "X of 5 outcomes needed for rates" |
| n = 5-29 | Show rates with inline "Based on X leads" footnote (muted text, info icon) |
| n >= 30 | Show normally, no caveats |

**Empty state message format:**
- Use action-oriented headlines: "See which lead sources convert best" (not "No conversion data")
- One sentence explaining what triggers data: "Record 5 gig outcomes to see conversion rates"
- No CTA button needed (the outcome form is on the same page)

**Per-section small-sample warnings:** Apply the existing `hasEnough` pattern (< 5 data points) but instead of the current thin-data styling only, also suppress percentages entirely and show raw counts. Between 5-29, show rates with a "Based on X leads" footnote.

**Mobile empty states:** Keep the section header visible but collapse the empty state body to a single line: "3 of 5 needed" -- avoids wasting mobile viewport space.

#### Research Insights (Step 4d)

**Why Show, Not Hide (NNGroup Research):**
- Hidden sections decrease discoverability. Users never learn the dashboard's full capabilities.
- Empty states are "in-context learning cues" -- they help users understand what the product offers without a tutorial.
- The progress indicator ("3 of 5 outcomes needed") creates a return-visit hook.

**Sample Size Thresholds (Statistical Research):**
- n < 5: CMS and NCHS suppress cells below 5 in public data. For private dashboards, rates on 1-4 samples are statistically meaningless and actively misleading.
- n < 30: Central Limit Theorem threshold. Below 30, rates are volatile. Add caveat but show data.
- n >= 30: Rates stabilize. Show without caveats.

---

### Step 5: Metric Naming

Rename "Response Time Analysis" to **"Booking Cycle Time"** throughout. The `julianday(outcome_at) - julianday(created_at)` metric measures days from lead arrival to outcome recording -- this is deal cycle length, not how fast you replied. The brainstorm flagged this: "julianday() measures 'time to outcome recorded' not 'response time'."

---

## Technical Considerations

- **Architecture:** No new routes, no new files, no schema changes. Extends 4 existing files (queries.ts, types.ts, api.ts, dashboard.html).
- **Performance:** 8 queries in one read-only SQLite transaction (up from 3). Sub-millisecond at <1000 rows. No new indexes needed. Stays safe up to ~50K rows. (Performance Oracle: verified)
- **Security:** No new user input. All queries use parameterized statements via `stmt()` cache. `esc()` used for all rendered output in dashboard -- including all user-originated strings in new custom renderers. (Security Sentinel: verified)
- **Backward compatibility:** Existing dashboard sections unchanged. `AnalyticsResponse` gains new fields (always present but may be empty arrays).
- **Dashboard size:** File goes from 2,528 to ~2,698 lines (~170 line addition vs original ~200 estimate). Well under 2,800 threshold with ~100 lines of headroom. Flag dashboard.html extraction as a future brainstorm topic.

## Acceptance Criteria

- [ ] **Step 0:** `setLeadOutcome()` outcome recording triggers `skipFollowUp()` in api.ts when outcome !== null
- [ ] **Step 0:** Setting outcome to null (clearing) does NOT call skipFollowUp
- [ ] **Step 0:** JSDoc comment on `setLeadOutcome` in leads.ts documenting the skipFollowUp caller contract
- [ ] **Step 1:** `AnalyticsResponse` type includes all 5 new section interfaces
- [ ] **Step 1:** `LossReasonEntry.reason` uses `LossReason | 'unspecified'` type (not bare string)
- [ ] **Step 2:** All 5 queries added to `getAnalytics()` inside the existing transaction
- [ ] **Step 2:** All outcome-related queries include `WHERE status = 'done'`
- [ ] **Step 2:** Monthly Trends received count has inline SQL comment explaining intentional status filter omission
- [ ] **Step 2:** Revenue by Event Type uses `LOWER(TRIM(event_type))` and `total()` for sum
- [ ] **Step 2:** Loss Reasons uses `COALESCE(outcome_reason, 'unspecified')`
- [ ] **Step 2:** Conditional counts use `COUNT(CASE WHEN ... THEN 1 END)` without ELSE 0
- [ ] **Step 2:** All AVG results wrapped with `COALESCE(..., 0)` or `?? 0` in query layer
- [ ] **Step 3:** `GET /api/analytics` returns all new fields (api.ts stays as passthrough)
- [ ] **Step 4:** All 5 sections render correctly with sample data
- [ ] **Step 4:** All user-originated strings (`source_platform`, `event_type`, `outcome_reason`) pass through `esc()` before HTML insertion
- [ ] **Step 4:** Parameterized table has `<caption>`, `scope` on `<th>`, `aria-hidden` on bar cells
- [ ] **Step 4:** Empty sections show purposeful empty state with progress indicator (not hidden)
- [ ] **Step 4:** n < 5 sections suppress rates, show raw counts + "X of 5 needed" message
- [ ] **Step 4:** n 5-29 sections show rates with "Based on X leads" footnote
- [ ] **Step 4:** Follow-up effectiveness has custom renderer with outcome columns (plain % text, no color-coding)
- [ ] **Step 4:** Monthly Trends uses parameterized table (not CSS bar chart)
- [ ] **Step 4:** All new sections work on mobile viewport (< 700px)
- [ ] **Step 5:** Metric is named "Booking Cycle Time", not "Response Time"
- [ ] Dashboard stays under ~2,800 lines total

## Line Budget (Revised)

| File | Original Estimate | Deepened Estimate | Change |
|------|-------------------|-------------------|--------|
| `src/types.ts` | ~15-20 | ~15 | Removed `total_lost` field |
| `src/db/queries.ts` | ~50-60 | ~55 | Added COALESCE/total(), inline comments |
| `src/api.ts` | ~5-10 | ~5-8 | Step 0 fix + import + JSDoc |
| `public/dashboard.html` | ~200 | ~170 | Monthly Trends table (-40), no color-coding (-10), no sub-day format (-3), added formatters registry (+8), empty states (~same) |
| **Total** | **~280-300** | **~245-248** | **~35-50 lines saved** |

Dashboard goes from 2,528 to ~2,698 -- under the 2,800 threshold with comfortable headroom.

## Dependencies & Risks

- **Risk:** ~~Line budget is tight~~ **Mitigated by simplification.** ~50 lines saved by dropping CSS bars, color-coding, and sub-day formatting. Dashboard now has ~100 lines of headroom instead of ~72.
- **Risk:** `event_type` free text may fragment badly once real data arrives. **Mitigation:** `LOWER(TRIM())` handles case/whitespace. LOWER() is ASCII-only but sufficient for US data. Further normalization deferred until data shows the problem.
- **Risk:** Low outcome tracking discipline makes analytics empty. **Mitigation:** Upgraded empty states with progress indicators ("3 of 5 needed") create return-visit hooks. Out of scope: notification reminders.
- **Risk (new):** `setLeadOutcome` + `skipFollowUp` implicit coupling. **Mitigation:** JSDoc comment on `setLeadOutcome` documenting the caller contract.
- **Risk (new):** Dashboard at ~96% of line budget post-change. **Mitigation:** Flag extraction of rendering logic into separate JS modules as a future brainstorm topic.

## Commit Plan (Revised)

Implement in this order (~50-100 lines per commit, one concern each):

1. **Step 0:** Bug fix -- skipFollowUp on outcome in api.ts + JSDoc on setLeadOutcome
2. **Steps 1+2:** Type extensions in types.ts + new queries in queries.ts (types without queries are dead code; ship together)
3. **Step 3+4a:** API wiring + parameterize renderBreakdownTable with formatters registry
4. **Step 4b:** Render Booking Cycle Time + Monthly Trends + Revenue by Type sections (with CSS)
5. **Step 4b+4d:** Render Follow-up Effectiveness + Loss Reasons + empty state handling (with CSS)

**Reduced from 7 to 5 commits** (Simplicity Review recommendation). Types merged with queries (commit 2). CSS shipped with each rendering batch so the app never has unstyled sections (commits 4-5).

## Sources

- **Origin brainstorm:** [docs/brainstorms/2026-03-05-lead-analytics-dashboard-brainstorm.md](docs/brainstorms/2026-03-05-lead-analytics-dashboard-brainstorm.md) -- Key decisions carried forward: Option A (single endpoint), CSS-only charts (revised: plain tables), ~280 line budget (revised: ~248), prerequisite follow-up bug fix
- **Solution doc (critical):** [docs/solutions/database-issues/align-derived-stat-queries.md](docs/solutions/database-issues/align-derived-stat-queries.md) -- WHERE clause alignment pattern
- **Solution doc:** [docs/solutions/ui-bugs/targeted-dom-toggle-data-attributes.md](docs/solutions/ui-bugs/targeted-dom-toggle-data-attributes.md) -- Avoid full DOM rebuilds, use data-* attributes
- **Solution doc:** [docs/solutions/architecture/escape-at-interpolation-site.md](docs/solutions/architecture/escape-at-interpolation-site.md) -- Escape at interpolation, not origin
- **Solution doc:** [docs/solutions/architecture/follow-up-pipeline-human-in-the-loop-lifecycle.md](docs/solutions/architecture/follow-up-pipeline-human-in-the-loop-lifecycle.md) -- Follow-up status is separate state machine
- **Existing patterns:** `renderBreakdownTable()` at dashboard.html:2146, `getAnalytics()` at queries.ts:78, `skipFollowUp()` at follow-ups.ts:123

### Research Sources

- SQLite Official: [Date/Time Functions](https://sqlite.org/lang_datefunc.html), [Aggregate Functions](https://sqlite.org/lang_aggfunc.html)
- better-sqlite3: [API Docs](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md)
- ag-Grid: [Column Definitions](https://www.ag-grid.com/javascript-data-grid/column-definitions/)
- Tabulator: [Formatting](https://tabulator.info/docs/6.3/format)
- WebAIM: [Accessible Tables](https://webaim.org/techniques/tables/data)
- MDN: [Table Accessibility](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Structuring_content/Table_accessibility)
- NNGroup: [Empty States in Complex Applications](https://www.nngroup.com/articles/empty-state-interface-design/)
- Carbon Design System: [Empty States Pattern](https://carbondesignsystem.com/patterns/empty-states-pattern/)
- CMS: [Cell Suppression Policy](https://www.hhs.gov/guidance/document/cms-cell-suppression-policy)
- BMC Public Health: [Less Than Five is Less Than Ideal](https://pmc.ncbi.nlm.nih.gov/articles/PMC7501321/)

## Three Questions

1. **Hardest decision in this session?** Whether to keep the CSS bar chart for Monthly Trends or simplify to a plain table. The CSS bars add visual appeal but cost ~40 lines + new CSS classes + gap-fill logic. The simplicity reviewer's argument was persuasive: a 12-row table of numbers is trivially scannable, and the bars can always be added later as an incremental enhancement. Cutting them saves ~50 lines total (with cascading simplifications) and drops the line budget from tight to comfortable.

2. **What did you reject, and why?** Rejected the CTE approach for WHERE clause alignment (defining the base filter once as `WITH eligible AS (...)` and referencing it in all queries). While the learnings researcher recommended this, better-sqlite3 runs prepared statements individually inside a transaction -- you can't chain CTEs across separate `.all()` calls. The alignment is enforced by convention and code review, not by SQL structure. Also rejected showing demo/sample data in empty states -- adds implementation complexity for marginal UX benefit in a single-user app.

3. **Least confident about going into the next phase?** The empty state handling. The plan now has 4 tiers (n=0, n<5, n<30, n>=30) compared to the original binary (empty/not-empty). This is better UX but adds conditional logic to each section renderer. If the implementation is more complex than estimated, the first thing to simplify is collapsing tiers to 3 (n=0 empty state, n<5 suppress rates, n>=5 show normally) by dropping the n<30 caveat footnotes.

## Feed-Forward

- **Hardest decision:** Dropping CSS bar chart for Monthly Trends in favor of plain parameterized table -- saves ~50 lines, keeps line budget comfortable
- **Rejected alternatives:** CTE for WHERE alignment (doesn't work across separate better-sqlite3 prepared statements); demo/sample data in empty states (complexity for marginal benefit in single-user app)
- **Least confident:** Empty state 4-tier logic (n=0, n<5, n<30, n>=30) complexity. Fallback: collapse to 3 tiers by dropping n<30 caveat footnotes.
