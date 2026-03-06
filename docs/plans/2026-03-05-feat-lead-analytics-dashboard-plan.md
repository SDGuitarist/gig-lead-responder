---
title: "feat: Lead Analytics Dashboard"
type: feat
status: active
date: 2026-03-05
origin: docs/brainstorms/2026-03-05-lead-analytics-dashboard-brainstorm.md
feed_forward:
  risk: "Follow-up count bug — setLeadOutcome() doesn't freeze follow-ups, so follow_up_count can drift after outcome recording"
  verify_first: true
---

# feat: Lead Analytics Dashboard

## Prior Phase Risk

> **Least confident (from brainstorm):** "The follow-up count bug (setLeadOutcome doesn't freeze follow-ups) must be fixed as a prerequisite before follow-up effectiveness analytics are meaningful."

**Addressed:** Step 0 of this plan fixes the bug before any analytics work begins. The fix goes in `src/api.ts` (API layer) to avoid circular dependency between `leads.ts` and `follow-ups.ts`.

## Overview

Extend the Insights tab from 3 summary cards + 2 breakdowns to a full analytics dashboard with 5 new sections: Booking Cycle Time, Monthly Trends, Revenue by Event Type, Follow-up Effectiveness, and Loss Reasons. All data comes from the existing SQLite `leads` table — no schema changes needed.

**Approach:** Extend the existing single `GET /api/analytics` endpoint (Option A from brainstorm). The database is tiny (< 100 leads expected), all queries are fast SQLite reads in a single transaction. (see brainstorm: docs/brainstorms/2026-03-05-lead-analytics-dashboard-brainstorm.md, "Decision: Option A")

## Problem Statement / Motivation

The current Insights tab shows outcome counts and two breakdowns (by Platform, by Format) but lacks actionable business intelligence: which sources convert fastest, what event types generate the most revenue, whether follow-ups actually help, and why leads are lost. These insights inform pricing, marketing, and follow-up strategy decisions.

## Proposed Solution

### Step 0: Prerequisite Bug Fix — skipFollowUp on Outcome

**File:** `src/api.ts` (POST /api/leads/:id/outcome handler)

When `setLeadOutcome()` sets an outcome (outcome !== null), the API handler must also call `skipFollowUp(id)` to freeze the follow-up pipeline. Without this, the scheduler can increment `follow_up_count` after an outcome is recorded, making follow-up effectiveness data inaccurate.

**Implementation:**
- Import `skipFollowUp` from `./db/index.js` in `src/api.ts`
- After `setLeadOutcome(id, outcome, options)` succeeds and outcome !== null, call `skipFollowUp(id)`
- Re-fetch lead with `getLead(id)` for the response (ensures follow-up status is current)
- Do NOT call `skipFollowUp` when outcome === null (clearing an outcome) — skip is irreversible
- `skipFollowUp()` is idempotent — no-op if no active follow-up

**Why API layer, not DB layer:** `follow-ups.ts` imports from `leads.ts`. Importing `skipFollowUp` into `leads.ts` would create a circular dependency. The brainstorm specifically flags this risk (see brainstorm: Section 4 bug notes).

**Commit this separately before analytics work.**

### Step 1: Extend Types — `src/types.ts`

Add new interfaces for the 5 analytics sections and extend `AnalyticsResponse`:

```typescript
// New interfaces (~15 lines)
interface BookingCycleEntry {
  source_platform: string;
  avg_days: number;
  sample_size: number;
}

interface MonthlyTrendEntry {
  month: string;        // "2026-03"
  received: number;
  booked: number;
}

interface RevenueByTypeEntry {
  event_type: string;
  revenue: number;
  count: number;
  avg_price: number;
}

interface FollowUpEffectivenessEntry {
  follow_up_count: number;
  total: number;
  booked: number;
  lost: number;
  no_reply: number;
}

interface LossReasonEntry {
  reason: string;
  count: number;
}

// Extend AnalyticsResponse with new fields:
//   booking_cycle: BookingCycleEntry[]
//   monthly_trends: MonthlyTrendEntry[]
//   revenue_by_type: RevenueByTypeEntry[]
//   follow_up_effectiveness: FollowUpEffectivenessEntry[]
//   loss_reasons: LossReasonEntry[]
//   total_lost: number   (denominator for loss reason percentages)
```

### Step 2: Add Queries — `src/db/queries.ts`

Add 5 new queries inside the existing `getAnalytics()` read-only transaction. All queries that involve outcomes MUST include `WHERE status = 'done'` to match the existing base population. (see docs/solutions/database-issues/align-derived-stat-queries.md)

**Critical WHERE clause alignment:**

| Query | Base Filter | Rationale |
|-------|------------|-----------|
| Booking Cycle Time | `status='done' AND outcome='booked' AND outcome_at IS NOT NULL` | Only booked leads with timestamps |
| Monthly Trends (received) | No status filter | Total lead volume regardless of pipeline stage |
| Monthly Trends (booked) | `outcome='booked'` | Booked subset of total |
| Revenue by Event Type | `status='done' AND outcome='booked' AND actual_price IS NOT NULL` | Add `status='done'` — brainstorm SQL was missing it |
| Follow-up Effectiveness | `status='done' AND outcome IS NOT NULL` | All resolved leads |
| Loss Reasons | `status='done' AND outcome='lost'` | Add `status='done'` — brainstorm SQL was missing it. Use COALESCE for NULL outcome_reason |

**Monthly Trends intentional deviation:** The `received` count deliberately omits `status = 'done'` because it measures total incoming lead volume (useful for spotting seasonal spikes), while `booked` counts conversions. This is documented, not accidental.

**Loss Reasons NULL handling:** Use `COALESCE(outcome_reason, 'unspecified')` so leads marked "lost" without a reason appear as "Unspecified" rather than being silently excluded.

**Revenue by Event Type normalization:** Use `LOWER(TRIM(event_type))` as the GROUP BY expression to prevent "Wedding" and "wedding" fragmenting. Sufficient for now — further normalization deferred until real data shows fragmentation level.

**SQL for all 5 queries** (see brainstorm: Sections 1-5 for drafts, adjusted below):

```sql
-- 1. Booking Cycle Time (renamed from "Response Time" — measures days to outcome, not response speed)
SELECT source_platform,
  AVG(julianday(outcome_at) - julianday(created_at)) AS avg_days,
  COUNT(*) AS sample_size
FROM leads
WHERE status = 'done' AND outcome = 'booked' AND outcome_at IS NOT NULL
GROUP BY source_platform

-- 2. Monthly Trends (last 12 months)
SELECT strftime('%Y-%m', created_at) AS month,
  COUNT(*) AS received,
  SUM(CASE WHEN outcome = 'booked' THEN 1 ELSE 0 END) AS booked
FROM leads
GROUP BY month
ORDER BY month DESC
LIMIT 12

-- 3. Revenue by Event Type
SELECT LOWER(TRIM(event_type)) AS event_type,
  SUM(actual_price) AS revenue,
  COUNT(*) AS count,
  AVG(actual_price) AS avg_price
FROM leads
WHERE status = 'done' AND outcome = 'booked' AND actual_price IS NOT NULL
  AND event_type IS NOT NULL
GROUP BY LOWER(TRIM(event_type))
ORDER BY revenue DESC

-- 4. Follow-up Effectiveness
SELECT follow_up_count,
  COUNT(*) AS total,
  SUM(CASE WHEN outcome = 'booked' THEN 1 ELSE 0 END) AS booked,
  SUM(CASE WHEN outcome = 'lost' THEN 1 ELSE 0 END) AS lost,
  SUM(CASE WHEN outcome = 'no_reply' THEN 1 ELSE 0 END) AS no_reply
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

**NULL handling:** All AVG/SUM calls return NULL on empty result sets. The API layer must convert NULL to 0 or omit fields. Return empty arrays `[]` when no rows match — the dashboard handles empty arrays with per-section empty states.

**Estimated:** ~50-60 lines added to queries.ts.

### Step 3: Wire API Response — `src/api.ts`

The existing `GET /api/analytics` handler calls `getAnalytics()` and returns the result directly. No changes needed to the route itself — just ensure the extended `getAnalytics()` return value matches the extended `AnalyticsResponse` type.

**Estimated:** ~5 lines (the response assembly is inside `getAnalytics()`).

### Step 4: Dashboard Rendering — `public/dashboard.html`

#### 4a. Parameterize `renderBreakdownTable()`

The current `renderBreakdownTable(title, rows, showPct)` renders `{ label, total, booked, rate }[]` with hardcoded "Booked" and "Rate" columns. This doesn't fit Loss Reasons (needs "Count | % of Losses") or Revenue by Event Type (needs "Bookings | Revenue | Avg Price").

**Solution:** Add an optional `columns` parameter to `renderBreakdownTable()` that specifies column definitions. Default behavior stays the same (backwards compatible). New sections pass custom column configs.

```javascript
// Pseudocode for parameterized columns
// renderBreakdownTable(title, rows, opts)
// opts.columns = [{ key: 'count', label: 'Count' }, { key: 'pct', label: '%' }]
// opts.barKey = 'pct'  // which field drives the bar width
// opts.barMax = 100    // max value for bar scaling
```

This adds ~15-20 lines to the function vs writing 2 entirely new renderers (~60+ lines).

#### 4b. Render New Sections in `renderInsights(data)`

Add 5 new sections after the existing breakdowns. Each section:
1. Checks if its data array is non-empty
2. If empty, shows nothing (section is hidden — consistent with existing by_platform/by_format behavior at lines 2134/2139)
3. If non-empty but sample size < 5, shows data with thin-data styling (existing pattern)
4. If sufficient data, renders fully

**Section rendering plan:**

| Section | Renderer | Display |
|---------|----------|---------|
| Booking Cycle Time | New stat card + per-source table | "Avg X.X days to booking" card + source breakdown |
| Monthly Trends | New CSS bar chart renderer | Horizontal bars: blue=received, green=booked per month |
| Revenue by Event Type | Parameterized `renderBreakdownTable()` | Columns: Event Type, Bookings, Revenue, Avg Price |
| Follow-up Effectiveness | Custom renderer | Table with outcome columns per follow-up count row |
| Loss Reasons | Parameterized `renderBreakdownTable()` | Columns: Reason, Count, % of Losses with bars |

**Monthly Trends bar chart:** Pure CSS, no chart library (see brainstorm: "Rejected: Chart.js"). Horizontal bars using `width: X%` inline styles, same pattern as existing breakdown bars (line 2125). Months ordered chronologically (reverse the DESC from SQL). Gap-fill missing months with zeros in JS (~10 lines).

**Booking Cycle Time display:** Format as "X.X days" for values >= 1, "X hours" for values < 1 day.

**Follow-up Effectiveness custom renderer:** Table columns: "Follow-ups | Total | Booked | Lost | No Reply | Book Rate". Row for follow_up_count = 0 labeled "No follow-ups" (baseline data). Color-code rates: green for book rate > 50%, amber for 25-50%, red for < 25%.

**Estimated:** ~150 lines for all 5 sections + parameterized table (~20 lines) + CSS (~30 lines) = ~200 lines in dashboard.html.

#### 4c. CSS for New Sections

Add styles for:
- `.trend-bars` — monthly trend horizontal bars
- `.trend-bar-received`, `.trend-bar-booked` — blue/green bar colors
- `.cycle-stat` — booking cycle time stat card
- Mobile responsive rules for new tables

Use existing color scheme: green (#4caf50) for booked, amber (#ff9800) for no_reply, red (#f44336) for lost.

**Estimated:** ~30 lines CSS.

#### 4d. Empty State Messages

Each section is hidden when its data array is empty (no header, no message). This matches existing behavior for by_platform and by_format breakdowns. The top-level empty state ("No outcomes recorded yet") already handles the zero-data case.

**Per-section small-sample warnings:** Apply the existing `hasEnough` pattern (< 5 data points) to new sections. Show data but with `thin-data` class (suppresses rate bars, shows em-dashes for percentages).

### Step 5: Metric Naming

Rename "Response Time Analysis" to **"Booking Cycle Time"** throughout. The `julianday(outcome_at) - julianday(created_at)` metric measures days from lead arrival to outcome recording — this is deal cycle length, not how fast you replied. The brainstorm flagged this: "julianday() measures 'time to outcome recorded' not 'response time'."

## Technical Considerations

- **Architecture:** No new routes, no new files, no schema changes. Extends 4 existing files (queries.ts, types.ts, api.ts, dashboard.html).
- **Performance:** 8 queries in one read-only SQLite transaction (up from 3). Acceptable for < 1000 leads. If latency becomes an issue, split into separate endpoint later (YAGNI now).
- **Security:** No new user input. All queries use parameterized statements via `stmt()` cache. `esc()` used for all rendered output in dashboard.
- **Backward compatibility:** Existing dashboard sections unchanged. `AnalyticsResponse` gains new optional-ish fields (always present but may be empty arrays).

## Acceptance Criteria

- [ ] **Step 0:** `setLeadOutcome()` outcome recording triggers `skipFollowUp()` in api.ts when outcome !== null
- [ ] **Step 0:** Setting outcome to null (clearing) does NOT call skipFollowUp
- [ ] **Step 1:** `AnalyticsResponse` type includes all 5 new section interfaces
- [ ] **Step 2:** All 5 queries added to `getAnalytics()` inside the existing transaction
- [ ] **Step 2:** All outcome-related queries include `WHERE status = 'done'`
- [ ] **Step 2:** Revenue by Event Type uses `LOWER(TRIM(event_type))`
- [ ] **Step 2:** Loss Reasons uses `COALESCE(outcome_reason, 'unspecified')`
- [ ] **Step 3:** `GET /api/analytics` returns all new fields
- [ ] **Step 4:** All 5 sections render correctly with sample data
- [ ] **Step 4:** Sections with empty data arrays are hidden (not shown with empty headers)
- [ ] **Step 4:** Small sample (< 5) sections show thin-data styling
- [ ] **Step 4:** Monthly Trends fills gaps for months with zero leads
- [ ] **Step 4:** Follow-up effectiveness has custom renderer with outcome columns
- [ ] **Step 4:** All new sections work on mobile viewport (< 700px)
- [ ] **Step 5:** Metric is named "Booking Cycle Time", not "Response Time"
- [ ] Dashboard stays under ~2,800 lines total

## Line Budget

| File | Estimated New Lines |
|------|-------------------|
| `src/types.ts` | ~15-20 |
| `src/db/queries.ts` | ~50-60 |
| `src/api.ts` | ~5-10 (Step 0 fix + import) |
| `public/dashboard.html` | ~200 (rendering + CSS) |
| **Total** | **~280-300** |

Dashboard goes from 2,528 to ~2,728 — under the 2,800 threshold.

## Dependencies & Risks

- **Risk:** Line budget is tight. If follow-up effectiveness renderer is more complex than estimated, dashboard could approach 2,800. **Mitigation:** Monitor line count after each section. If approaching limit, simplify Monthly Trends bars (use table instead of CSS bars, saves ~20 lines).
- **Risk:** `event_type` free text may fragment badly once real data arrives. **Mitigation:** `LOWER(TRIM())` handles case/whitespace. Further normalization deferred until data shows the problem.
- **Risk:** Low outcome tracking discipline makes analytics empty. **Mitigation:** Existing "Tracking" card nudges. Empty states prevent confusion. Out of scope: notification reminders.

## Commit Plan

Implement in this order (~50-100 lines per commit, one concern each):

1. **Step 0:** Bug fix — skipFollowUp on outcome in api.ts
2. **Step 1:** Type extensions in types.ts
3. **Step 2:** New queries in queries.ts
4. **Step 3+4a:** API wiring + parameterize renderBreakdownTable
5. **Step 4b:** Render Booking Cycle Time + Monthly Trends sections
6. **Step 4b:** Render Revenue by Type + Loss Reasons + Follow-up Effectiveness sections
7. **Step 4c+4d:** CSS + empty state handling + mobile responsive

## Sources

- **Origin brainstorm:** [docs/brainstorms/2026-03-05-lead-analytics-dashboard-brainstorm.md](docs/brainstorms/2026-03-05-lead-analytics-dashboard-brainstorm.md) — Key decisions carried forward: Option A (single endpoint), CSS-only charts (no Chart.js), ~280 line budget, prerequisite follow-up bug fix
- **Solution doc (critical):** [docs/solutions/database-issues/align-derived-stat-queries.md](docs/solutions/database-issues/align-derived-stat-queries.md) — WHERE clause alignment pattern
- **Solution doc:** [docs/solutions/ui-bugs/targeted-dom-toggle-data-attributes.md](docs/solutions/ui-bugs/targeted-dom-toggle-data-attributes.md) — Avoid full DOM rebuilds
- **Existing patterns:** `renderBreakdownTable()` at dashboard.html:2146, `getAnalytics()` at queries.ts:78, `skipFollowUp()` at follow-ups.ts:123

## Three Questions

1. **Hardest decision in this session?** Whether to make Monthly Trends use the same `WHERE status = 'done'` base as the other queries or let it count all leads. Chose to count all leads for `received` (total volume is useful for spotting seasonal spikes) but only `status='done'` leads for `booked`. This is an intentional deviation from the "same WHERE clause everywhere" rule, but it serves a different purpose (volume vs conversion) and is clearly documented.

2. **What did you reject, and why?** Rejected writing separate renderers for Loss Reasons and Revenue by Event Type. The SpecFlow analysis showed `renderBreakdownTable()` doesn't fit their data shapes (always-zero "Booked" column, meaningless "Rate"). Instead of 2 new renderers (~60 lines), parameterizing the existing one (~20 lines) saves ~40 lines and stays under budget. Also rejected requiring `outcome_reason` when outcome is "lost" — this would be a breaking API change for a plan that promised no schema changes.

3. **Least confident about going into the next phase?** The line budget. Dashboard rendering for 5 sections + parameterized table + CSS + empty states + gap-filling is estimated at ~200 lines in dashboard.html, but the follow-up effectiveness custom renderer (table with 6 columns, color-coded rates, "No follow-ups" label) could be more complex than estimated. If it runs over, the Monthly Trends CSS bars are the first thing to simplify (replace with a table, saves ~20 lines).

## Feed-Forward

- **Hardest decision:** Monthly Trends WHERE clause deviation — counting all leads for volume, only done for bookings
- **Rejected alternatives:** Separate renderers for Loss Reasons and Revenue (~60 lines) — parameterized table saves ~40 lines; requiring outcome_reason on lost — breaking API change
- **Least confident:** Line budget for dashboard.html — follow-up effectiveness renderer complexity could push past estimates. Fallback: simplify Monthly Trends from CSS bars to table.
