# Performance Oracle — Review Findings

**Agent:** performance-oracle
**Branch:** main (commits ddb515d..d5b34fe)
**Date:** 2026-02-22
**Files reviewed:** 6

## Findings

### [P1] Full DOM rebuild on every row click, approve, save, and cancel

**File:** `public/dashboard.html:1240-1248`
**Issue:** `toggleDetail()` calls both `renderTable(currentLeads)` and `renderMobile(currentLeads)` on every interaction, destroying and recreating every DOM node for every lead. With 50 leads, every row click generates ~100 table rows + ~50 mobile cards. The same full rebuild happens on approve (line 1284-1285), save (line 1330-1331), and cancel (line 1343-1344). This causes O(n) string concatenation, browser layout thrashing, and lost user state (textarea content, scroll position, focus).
**Suggestion:** For toggle, only manipulate the two affected detail rows (the previously open and newly opened). Replace full `innerHTML` rebuild with targeted DOM updates using `querySelector('[data-detail="' + id + '"]')`.

---

### [P1] No pagination on GET /api/leads — unbounded response size

**File:** `src/api.ts:79-89`, `src/leads.ts:228-257`
**Issue:** `GET /api/leads` calls `listLeadsFiltered()` which runs `SELECT *` with no `LIMIT` clause. Every column is selected including large text fields (`raw_email`, `full_draft`, `compressed_draft`, JSON columns). Then `shapeLead()` runs `JSON.parse` on 3 JSON columns per lead. For 200 leads, the response could be 500KB+. The dashboard table only needs 7 columns; drafts and classification details are only needed for expanded detail panels.
**Suggestion:** Add server-side pagination (`LIMIT @limit OFFSET @offset`) and create a lightweight `shapeLeadSummary()` for the list view. Fetch full detail via `GET /api/leads/:id` only when expanding.

---

### [P2] JSON.parse runs 3 times per lead on every list request

**File:** `src/api.ts:22-28`
**Issue:** `shapeLead()` calls `safeJsonParse()` on `classification_json`, `pricing_json`, and `gate_json` for every lead. For 50 leads = 150 `JSON.parse` calls per request. These JSON blobs can be several KB each. The intermediate parsed objects are allocated, partially destructured, and immediately GC'd.
**Suggestion:** Skip JSON parsing for the list endpoint. Only parse when a single lead's detail panel is requested. Alternatively, use SQLite's `json_extract()` in the query itself.

---

### [P2] SSE endpoint has no authentication, no connection limits, no timeout

**File:** `src/server.ts:51-75`
**Issue:** `/api/analyze` has no auth, no concurrency limit, and no server-side timeout. Each request spawns a full AI pipeline with multiple Anthropic API calls. No client disconnect detection — if the user navigates away, the pipeline continues running and consuming API quota.
**Suggestion:** Add auth, a 120s timeout, client disconnect detection via `req.on('close')`, and a concurrency semaphore (e.g., max 2 active analyses).

---

### [P2] `SELECT *` fetches all large text columns for list display

**File:** `src/leads.ts:210-218`, `src/leads.ts:228-257`
**Issue:** Both `listLeads()` and `listLeadsFiltered()` use `SELECT *` returning `raw_email`, `classification_json`, `pricing_json`, `gate_json`, `full_draft`, `compressed_draft` for every row. The old dashboard uses only 9 of 25 columns. The new dashboard list view similarly doesn't need the large text columns.
**Suggestion:** Create `listLeadsSummary()` selecting only the columns needed for the table view, plus `json_extract()` for derived fields.

---

### [P2] `updateLead` does 3 queries per update (read-before-write + read-after-write)

**File:** `src/leads.ts:148-188`
**Issue:** Every `updateLead()` call executes: (1) `getLead(id)` to check existence, (2) `UPDATE`, (3) `getLead(id)` again to return the updated record. For the approve flow in `api.ts`, the sequence is 4 queries (extra `getLead` for validation). Since this is SQLite (single-writer, in-process), the existence check is redundant.
**Suggestion:** Eliminate the pre-read, use `stmt.run().changes` to check if the row existed, reducing approve from 4 to 3 queries and simple updates from 3 to 2.

---

### [P2] Duplicate query functions with overlapping purposes

**File:** `src/leads.ts:126-135`, `src/leads.ts:210-218`, `src/leads.ts:228-257`
**Issue:** Three list-query functions: `listLeads()` (no filters), `getLeadsByStatus(status)` (status filter), `listLeadsFiltered({ status, sort })` (both). `listLeads()` ≡ `listLeadsFiltered({})`. `getLeadsByStatus(s)` ≡ `listLeadsFiltered({ status: s })`. Any future optimization (pagination, column selection, indexes) must be applied to three functions.
**Suggestion:** Consolidate into `listLeadsFiltered()` as the single query function.

---

### [P2] `esc()` helper creates a DOM element on every call

**File:** `public/dashboard.html:942-947`
**Issue:** Client-side `esc()` creates a new `<div>`, sets `textContent`, reads `innerHTML` every call. During `renderTable()` for 50 leads, ~300 DOM element allocations per render. Combined with the full-rebuild pattern, this compounds on every click.
**Suggestion:** Use a string-based escaper: `s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')`. Roughly 10-50x faster for short strings.

---

### [P3] 735 lines of inline CSS + 665 lines of inline JS with no caching

**File:** `public/dashboard.html:8-735` (CSS), `public/dashboard.html:890-1555` (JS)
**Issue:** Every page load re-downloads and re-parses all CSS and JS. An external `.css`/`.js` file would benefit from browser HTTP cache (304, ETag).
**Suggestion:** Extract to `public/dashboard.css` and `public/dashboard.js`. Add cache headers via `express.static({ maxAge: '1d', etag: true })`.

---

### [P3] Google Fonts loaded render-blocking from CDN

**File:** `public/dashboard.html:7`
**Issue:** `<link href="https://fonts.googleapis.com/...">` is render-blocking. On slow connections, adds 200-500ms to first paint. `display=swap` is included (good), but DNS/TLS latency to Google servers adds overhead.
**Suggestion:** Add `<link rel="preconnect" href="https://fonts.googleapis.com">` and `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>` before the font link.

---

### [P3] `findLead()` uses linear scan on unsorted array

**File:** `public/dashboard.html:967-972`
**Issue:** `findLead(id)` iterates through `currentLeads` with a `for` loop — O(n) per lookup. Called from edit handler and other interactions.
**Suggestion:** Maintain a `leadsById = {}` map alongside the array for O(1) lookups. At current scale (10-50 leads) negligible, but correct pattern.

---

### [P3] `gate_passed` boolean conversion runs on every row of every query

**File:** `src/leads.ts:123`, `131-134`, `215-218`, `253-256`
**Issue:** Every query function `.map()`s all rows to convert `gate_passed` from SQLite integer to JS boolean, creating a new spread-copy of every row object. With 100 leads = 100 unnecessary object allocations.
**Suggestion:** Handle conversion in a single place or accept 0/1 in the API and convert client-side.

---

### [P3] Auth middleware reads env vars on every request

**File:** `src/auth.ts:5-6`
**Issue:** `basicAuth()` reads `process.env.DASHBOARD_USER` and `DASHBOARD_PASS` on every request. While fast (<1us), unnecessary repetition.
**Suggestion:** Read once at module load into `const DASH_USER` and `const DASH_PASS`.

---

### [P3] Missing sort-column indexes for scale

**File:** `src/leads.ts:44` (only `idx_leads_status` exists)
**Issue:** Sort columns (`event_date`, `confidence_score`, `event_type`, `created_at`) lack indexes. At 500+ leads, sorting requires full table scans.
**Suggestion:** Add indexes: `CREATE INDEX IF NOT EXISTS idx_leads_event_date ON leads(event_date)`, etc.

---

## Scalability Assessment

| Dimension | 10 leads | 100 leads | 500 leads | 1000+ leads |
|---|---|---|---|---|
| GET /api/leads response size | ~5KB | ~50KB | ~250KB | ~500KB+ |
| JSON.parse calls per list | 30 | 300 | 1500 | 3000+ |
| DOM nodes rebuilt per click | ~60 | ~600 | ~3000 | ~6000+ |
| shapeLead() time | <1ms | ~5ms | ~25ms | ~50ms+ |

## Summary

| Severity | Count | Key themes |
|----------|-------|------------|
| P1 | 2 | Full DOM rebuild per interaction; unbounded response size with no pagination |
| P2 | 5 | 3n JSON.parse per list; SSE abuse; SELECT * fetching large columns; 3-4 queries per update; duplicate query functions |
| P3 | 6 | Inline CSS/JS no caching; render-blocking font; linear search; boolean conversion copies; env var reads; missing indexes |
