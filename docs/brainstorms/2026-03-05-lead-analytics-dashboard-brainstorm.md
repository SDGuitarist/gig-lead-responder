# Brainstorm: Lead Analytics Dashboard

**Date:** 2026-03-05
**Origin:** HANDOFF.md deferred item (dashboard.html JS extraction threshold) + need for actionable business insights
**Related:** `src/db/queries.ts` (existing `getAnalytics()`), `public/dashboard.html` (2,474 lines), `src/api.ts` (GET /api/analytics)

## What We're Building

Upgrade the Insights tab from basic outcome counts to a full analytics dashboard with trend analysis, source effectiveness, follow-up effectiveness, and seasonal patterns. All data comes from the existing SQLite `leads` table — no schema changes needed.

### Current State

The Insights tab (`public/dashboard.html`, lines 1236-1243) shows:
- 3 summary cards: Conversion Rate, Revenue, Tracking count
- Avg quote vs actual price
- Breakdown by Platform (source_platform)
- Breakdown by Format (format_recommended from classification_json)

All powered by one endpoint: `GET /api/analytics` calling `getAnalytics()` in `queries.ts`. Returns `AnalyticsResponse` with flat counts and two breakdowns.

### What's Missing (in priority order)

1. **Source conversion comparison** — Which platform (GigSalad, TheKnot, TheBash, direct) converts best? Current breakdown shows counts but no visual comparison or response-time correlation.

2. **Response-to-booking time** — `created_at` vs `outcome_at` for booked leads. Am I faster on some sources? Does speed correlate with conversion?

3. **Monthly/seasonal trends** — When do leads spike? When do they convert? Useful for planning marketing pushes and availability.

4. **Revenue by venue type / event type / source** — Where does the money actually come from? Which event types pay best?

5. **Follow-up effectiveness** — At which follow-up stage (1st, 2nd, 3rd) do leads convert vs go cold? Is the follow-up sequence worth the effort?

6. **Win/loss reasons** — Why do lost leads go away? (price, competitor, cancelled, other) — `outcome_reason` column already exists.

## Data Availability Audit

### Blocker Resolution (2026-03-05)

**Production DB queried via Railway CLI.** Result: the database has **zero leads**. No event_type values or outcome_at timestamps to audit. The data cleanliness concern is moot for now, but the plan should include preventive normalization (`LOWER(TRIM(event_type))`) in the Revenue by Event Type query to avoid fragmentation as leads accumulate.

**Side finding:** `COOKIE_SECRET` was missing from Railway env vars, causing 502s on all authenticated routes while `/health` returned 200. Fixed by setting the variable, which triggered a redeploy.

Before designing queries, verify what's actually in the database:

| Column | Used for | Populated? | Notes |
|--------|----------|------------|-------|
| `source_platform` | Source conversion | Yes, from webhook | "gigsalad", "thebash", "direct" |
| `event_type` | Revenue by type | Yes, from email parser | Free-text extracted from lead |
| `event_date` | Seasonal trends | Yes, from email parser | ISO date string |
| `created_at` | Lead timing | Always | ISO timestamp |
| `outcome` | Conversion | Manual via dashboard | "booked", "lost", "no_reply" |
| `outcome_at` | Response time | Manual via dashboard | ISO timestamp |
| `outcome_reason` | Win/loss reasons | Manual, only for "lost" | "price", "competitor", "cancelled", "other" |
| `actual_price` | Revenue | Manual, only for "booked" | REAL, > 0 |
| `follow_up_count` | Follow-up effectiveness | Automatic | INTEGER, 0-3 |
| `follow_up_status` | Follow-up outcomes | Automatic | 5-state machine |
| `classification_json` | Format, tier, etc. | Pipeline output | JSON blob with format_recommended, tier, etc. |
| `pricing_json` | Quote price | Pipeline output | JSON blob with quote_price |
| `venue` | Venue analysis | From email parser | Free-text venue name |
| `confidence_score` | Score analysis | Pipeline output | INTEGER |

**Key constraint:** Analytics quality depends on outcome tracking discipline. If leads aren't marked booked/lost/no_reply, conversion data is empty. The current "Tracking" card already shows untracked count — this is the right nudge.

## Approach Options

### Option A: Extend existing `getAnalytics()` endpoint

Add more fields to `AnalyticsResponse`. One endpoint, one fetch. Dashboard JS renders everything.

**Pros:** Simple, one API call, no new routes.
**Cons:** Payload gets large. Every Insights tab load runs all queries even if user only wants one section. `AnalyticsResponse` interface grows unwieldy.

### Option B: Multiple focused endpoints

Split into `GET /api/analytics/summary`, `GET /api/analytics/trends`, `GET /api/analytics/follow-ups`, etc. Dashboard fetches what it needs per section.

**Pros:** Lazy loading — only fetch data when user scrolls/clicks. Lighter per-request. Easier to test.
**Cons:** More API routes. More fetch calls. More complexity.

### Option C: Extend `getAnalytics()` with optional sections

`GET /api/analytics?sections=summary,trends,followups`. Server only computes requested sections. Dashboard fetches all on initial load, or could lazy-load.

**Pros:** Single route, flexible, backward compatible.
**Cons:** Slightly more complex query logic. Still one round-trip if loading all.

**Decision: Option A (extend existing endpoint).**

Rationale: The database is tiny (< 100 leads). All queries are fast SQLite reads in a transaction. The payload will be a few KB at most. Adding multiple endpoints adds complexity with no performance benefit at this scale. Keep it simple — extend `AnalyticsResponse`, extend `getAnalytics()`, extend `renderInsights()`.

If the dashboard later needs to handle thousands of leads, we can split then. YAGNI.

## Proposed New Analytics Sections

### 1. Response Time Analysis

```sql
-- Average days from created_at to outcome_at, grouped by source
SELECT source_platform,
  AVG(julianday(outcome_at) - julianday(created_at)) AS avg_days_to_outcome,
  COUNT(*) AS sample_size
FROM leads
WHERE status = 'done' AND outcome = 'booked' AND outcome_at IS NOT NULL
GROUP BY source_platform
```

Display: simple stat card showing "Avg X days to booking" + per-source breakdown.

### 2. Monthly Trends

```sql
-- Leads received and booked per month
SELECT strftime('%Y-%m', created_at) AS month,
  COUNT(*) AS received,
  SUM(CASE WHEN outcome = 'booked' THEN 1 ELSE 0 END) AS booked
FROM leads
GROUP BY month
ORDER BY month DESC
LIMIT 12
```

Display: simple horizontal bar chart (pure CSS, no chart library). Each row = month, two bars (received vs booked).

### 3. Revenue by Event Type

```sql
SELECT event_type,
  SUM(actual_price) AS revenue,
  COUNT(*) AS count,
  AVG(actual_price) AS avg_price
FROM leads
WHERE outcome = 'booked' AND actual_price IS NOT NULL AND event_type IS NOT NULL
GROUP BY event_type
ORDER BY revenue DESC
```

Display: ranked list with revenue totals.

### 4. Follow-up Effectiveness

**Bug found during review:** `setLeadOutcome()` does NOT stop active follow-ups. The scheduler can increment `follow_up_count` after an outcome is recorded, making this query inaccurate. **The plan must include a prerequisite fix:**

- **Where:** `src/api.ts`, `POST /api/leads/:id/outcome` handler (NOT `leads.ts` — circular dependency risk since `follow-ups.ts` imports from `leads.ts`)
- **What:** Import `skipFollowUp` from `./db/index.js`, call `skipFollowUp(id)` after `setLeadOutcome()` when `outcome !== null`. Re-fetch lead with `getLead(id)` for accurate response.
- **Safe:** `skipFollowUp()` is idempotent (no-op if no active follow-up). Don't call on `outcome === null` (clearing) since skip is irreversible.

```sql
-- Outcome breakdown by follow_up_count at time of outcome
SELECT follow_up_count,
  COUNT(*) AS total,
  SUM(CASE WHEN outcome = 'booked' THEN 1 ELSE 0 END) AS booked,
  SUM(CASE WHEN outcome = 'lost' THEN 1 ELSE 0 END) AS lost,
  SUM(CASE WHEN outcome = 'no_reply' THEN 1 ELSE 0 END) AS no_reply
FROM leads
WHERE status = 'done' AND outcome IS NOT NULL
GROUP BY follow_up_count
ORDER BY follow_up_count
```

Display: small table showing conversion rate at each follow-up stage.

### 5. Loss Reasons

```sql
SELECT outcome_reason, COUNT(*) AS count
FROM leads
WHERE outcome = 'lost' AND outcome_reason IS NOT NULL
GROUP BY outcome_reason
ORDER BY count DESC
```

Display: simple breakdown bar (price vs competitor vs cancelled vs other).

## Dashboard Constraint: 2,474 Lines

`dashboard.html` is at 2,474 lines. The 3,000 extraction threshold is noted in HANDOFF deferred items. Adding analytics rendering could push it close.

**Mitigation strategies (decide during planning):**

1. **Lean rendering code** — reuse `renderBreakdownTable()` (already exists, lines 2101-2131) for most new sections. Only write new rendering for the trends bars.
2. **CSS-only charts** — no chart library. Horizontal bars with `width: X%` like the existing breakdown bars (line 2125).
3. **Count lines before and after** — if we'd exceed ~2,800, extract the Insights tab JS into a separate `<script>` file first.

Estimated new code: ~60 lines CSS + ~120 lines JS rendering + ~80 lines SQL in queries.ts + ~20 lines type changes = ~280 lines total across files. Dashboard would go to ~2,600 lines — under threshold.

## ADHD-Friendly Design Principles

- **Glanceable top cards** — keep the 3 existing summary cards, maybe add 1-2 more (response time, top source)
- **No dense tables** — use visual bars, not walls of numbers
- **Progressive disclosure** — show summary first, details on scroll
- **Mobile-first** — all new sections must work on phone viewport (checked between gigs)
- **Color coding** — green for booked, amber for no_reply, red for lost (already used in existing UI)
- **Small sample warnings** — existing pattern (line 2073: `hasEnough` check for < 5 outcomes) should apply to all new sections

## What This Does NOT Include

- **Predictive analytics** — no ML/forecasting, just historical counts
- **Export/CSV** — not needed yet, can add later
- **Date range filters** — show all time data; monthly trends give temporal view
- **Real-time updates** — manual refresh like current dashboard
- **External analytics** — no Google Analytics, Mixpanel, etc.

## Risk: Low Outcome Tracking Discipline

The entire analytics feature depends on outcomes being recorded. If Alejandro stops marking leads as booked/lost/no_reply, the dashboard shows stale data.

**Mitigations already in place:**
- "Tracking" card shows untracked count (social pressure)
- Outcome buttons are prominent on each lead card

**Possible future nudge (out of scope for this brainstorm):**
- Push notification or SMS reminder for leads > 7 days with no outcome

## Three Questions

1. **Hardest decision in this session?** Whether to use multiple endpoints (Option B) or extend the single endpoint (Option A). Chose A because the data is tiny and complexity isn't justified. The temptation was to "do it right" with lazy loading, but that's premature optimization for < 100 rows.

2. **What did you reject, and why?** Rejected adding a chart library (Chart.js, etc.). CSS-only bars are simpler, lighter, and consistent with the existing breakdown bars. A chart library would add a dependency, increase page weight, and look out of place in the current minimal design. Also rejected date range filters — monthly trends provide temporal context without UI complexity.

3. **Least confident about going into the next phase?** ~~Whether `event_type` values are clean enough~~ **RESOLVED:** Production DB has zero leads — no dirty data to worry about. Plan should include preventive `LOWER(TRIM())` normalization. ~~Also uncertain about `outcome_at` population~~ **RESOLVED:** No data yet. Additionally, a **follow-up count bug was confirmed** — `setLeadOutcome()` doesn't stop active follow-ups, so `follow_up_count` can drift after outcome recording. Fix designed (see Section 4 above) and must be a prerequisite in the plan.

## Feed-Forward

- **Hardest decision:** Single endpoint (Option A) vs multiple endpoints — chose simplicity for small dataset
- **Rejected alternatives:** Chart library (Chart.js) — too heavy for the minimal design; date range filters — monthly trends suffice; multiple API endpoints — premature for < 100 rows
- **Least confident:** ~~event_type cleanliness and outcome_at population~~ **RESOLVED** — production DB is empty (zero leads). Preventive normalization planned. New risk: the follow-up count bug (setLeadOutcome doesn't freeze follow-ups) must be fixed as a prerequisite before follow-up effectiveness analytics are meaningful.
