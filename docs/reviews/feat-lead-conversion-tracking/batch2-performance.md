# Performance Oracle — Review Findings

**Agent:** compound-engineering:review:performance-oracle
**Branch:** feat/lead-conversion-tracking
**Date:** 2026-02-25
**Files reviewed:** 4 (src/types.ts, src/leads.ts, src/api.ts, public/dashboard.html)

## Scalability Assessment

| Metric | ~50 leads | 500 leads | 5,000 leads |
|--------|-----------|-----------|-------------|
| `GET /api/leads` response size | ~50KB | ~500KB | ~5MB (raw_email bloat) |
| `GET /api/analytics` query time | <5ms | ~20ms | ~200ms (json_extract bottleneck) |
| Outcome save DB round-trips | 3 SELECTs + 1 UPDATE | same | same |
| `visibilitychange` DOM rebuild | ~50 rows x 2 views | ~500 x 2 | ~5000 x 2 (>1s repaint) |

## Findings

### [P2] Missing index on `outcome` column — full table scan for analytics queries
**File:** `src/leads.ts:335-349`
**Issue:** Queries 2 and 3 in `getAnalytics()` both filter with `WHERE outcome IS NOT NULL`, and Query 1 uses `SUM(CASE WHEN outcome = ...)` across all rows. The `outcome` column has no index. At 5,000-10,000 leads these three queries inside the same transaction will each do a full table scan. The `json_extract` calls on `pricing_json` and `classification_json` also cannot benefit from indexes, meaning SQLite must deserialize JSON blobs row-by-row.
**Suggestion:** Add index: `CREATE INDEX IF NOT EXISTS idx_leads_outcome ON leads(outcome);`

---

### [P2] Missing index on `source_platform` — GROUP BY triggers full scan
**File:** `src/leads.ts:335-340`
**Issue:** Query 2 does `GROUP BY source_platform` with no index on that column. SQLite must scan all rows with a non-null outcome, then hash-group by platform.
**Suggestion:** Add index: `CREATE INDEX IF NOT EXISTS idx_leads_source_platform ON leads(source_platform);`

---

### [P2] `SELECT *` on list endpoint fetches large unused columns
**File:** `src/leads.ts:245`
**Issue:** `listLeadsFiltered` does `SELECT * FROM leads`, fetching `raw_email`, `classification_json`, `pricing_json`, `gate_json`, `full_draft`, and `compressed_draft` for every row. For 100 leads, that could be several megabytes. `shapeLead` then parses 3 JSON blobs per lead just to extract ~4 scalar fields each. Pre-existing pattern, but the analytics feature amplifies impact because users will keep more leads in "done" status to track outcomes.
**Suggestion:** Use explicit column list for the list endpoint, omitting `raw_email` and `gate_json` (largest blobs that `shapeLead` barely uses).

---

### [P3] Triple SELECT per outcome save (3 reads for 1 write)
**File:** `src/api.ts:207` and `src/leads.ts:282-301`
**Issue:** The outcome save flow does: (1) `getLead(id)` in api.ts to check existence/status, (2) `setLeadOutcome` calls `updateLead` which calls `getLead(id)` again to check existence, (3) `updateLead` calls `getLead(id)` a third time to return the updated row. 3 `SELECT * FROM leads WHERE id = ?` for a single save. Latency is microseconds per query (in-process SQLite), so not a production emergency.
**Suggestion:** Use `UPDATE ... RETURNING *` (SQLite 3.35+) to combine write and final read. Or pass the already-fetched lead record from API handler into `setLeadOutcome` to skip redundant check.

---

### [P3] Orphaned `renderDetailPanel(updated)` call — wasted string construction
**File:** `public/dashboard.html:1773`
**Issue:** Line 1773 calls `renderDetailPanel(updated)` but discards the returned HTML string. The actual panel re-render happens on lines 1775-1779. This builds an HTML string (concatenation, escaping, date formatting) for nothing.
**Suggestion:** Remove the orphaned call on line 1773.

---

### [P3] `isStale()` creates a new Date object per lead per render on every visibility change
**File:** `public/dashboard.html:1183-1189`
**Issue:** `isStale(l)` is called inside `outcomeBadgeHTML` for every lead during both `renderTable` and `renderMobile`. Each call constructs `new Date(ref)` and computes `Date.now()`. The `visibilitychange` handler triggers this for all leads x 2 views. With 200 leads: 400 Date constructions per tab switch.
**Suggestion:** Cache `Date.now()` once per render pass. More importantly, debounce `visibilitychange` or only re-render nudge badges instead of full table rebuild.

---

### [P3] `loadInsights()` fetches fresh analytics on every tab click with no caching
**File:** `public/dashboard.html:1806-1815`
**Issue:** Every Insights tab click fires `GET /api/analytics` (3 SQL queries in a transaction). No cache, no debounce, no "already loading" guard. Rapid tab switching fires redundant queries.
**Suggestion:** Cache response with 30-second TTL. Set `analyticsStale = true` after outcome save, only re-fetch if stale or TTL expired:
```javascript
var insightsCache = null;
var insightsCacheTime = 0;
function loadInsights(force) {
  if (!force && insightsCache && (Date.now() - insightsCacheTime < 30000)) {
    renderInsights(insightsCache);
    return;
  }
  // existing fetch, then: insightsCache = data; insightsCacheTime = Date.now();
}
```

---

### [P3] `json_extract` on TEXT columns in analytics queries — no SQLite optimization possible
**File:** `src/leads.ts:320` and `src/leads.ts:344`
**Issue:** Two analytics queries use `json_extract()` on `pricing_json` and `classification_json` columns. SQLite must parse the JSON blob for every matching row. At 1000 leads, Query 3 parses up to 1000 JSON strings to extract a single key for grouping. Cannot be indexed.
**Suggestion:** Denormalize `format_recommended` and `quote_price` into their own columns. Populate at write time alongside JSON blobs. Eliminates `json_extract` from analytics and enables standard indexing.
