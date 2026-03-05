# Performance Oracle — Review Findings

**Agent:** performance-oracle
**Branch:** feat/follow-up-v2-dashboard
**Date:** 2026-03-02
**Files reviewed:** 10 (api.ts, auth.ts, follow-up-api.ts, follow-up-scheduler.ts, leads.ts, rate-limit.ts, server.ts, twilio-webhook.ts, types.ts, dashboard.html)

## Performance Summary

This branch adds a follow-up scheduling system, a dashboard tab for managing follow-ups, new API endpoints, rate limiting, and cookie-based auth. The codebase uses SQLite via `better-sqlite3` (synchronous by design), which is appropriate for the single-user scale. Most operations are well-bounded. The findings below flag patterns that could become problems at modest scale (dozens-to-hundreds of leads) or under edge conditions.

## Findings

### [P2] Double database read in `updateLead`
**File:** `src/leads.ts:239-278`
**Issue:** `updateLead()` calls `getLead(id)` at the top (line 243) to check existence, then calls `getLead(id)` again at the bottom (line 278) to return the updated row. That is two `SELECT *` queries for every single update. This function is called heavily throughout the codebase — by `approveFollowUp`, `skipFollowUp`, `snoozeFollowUp`, `markClientReplied`, `completeApproval`, `scheduleFollowUp`, the scheduler, and every API endpoint that modifies a lead.

Additionally, inside transactions like `approveFollowUp` (line 382-418), there are chained calls: the transaction does an UPDATE, then calls `getLead`, then calls `updateLead` which internally does another `getLead` + UPDATE + `getLead`. A single `approveFollowUp` call triggers at minimum 4 SELECT queries and 2 UPDATE queries.
**Suggestion:** Add a `RETURNING *` clause to the UPDATE statement (SQLite 3.35+, supported by `better-sqlite3`) to eliminate the final `getLead()` call. For the existence check, rely on `result.changes === 0` from the UPDATE instead of a preliminary SELECT. In transactional contexts, restructure to pass the already-fetched lead object through rather than re-fetching.

---

### [P2] `listLeadsFiltered` and `listFollowUpLeads` use `SELECT *` with no pagination
**File:** `src/leads.ts:518-561`
**Issue:** Both `listLeadsFiltered()` (line 518) and `listFollowUpLeads()` (line 550) query `SELECT * FROM leads` with no `LIMIT` clause. Each lead row includes `raw_email` (the full email body), `classification_json`, `pricing_json`, `gate_json`, `full_draft`, `compressed_draft`, and `follow_up_draft` — all text blobs. These are serialized via `shapeLead()` (which parses the JSON columns) and sent as the full API response.

At 100 leads, this query returns potentially hundreds of kilobytes of raw email text, JSON blobs, and drafts. The `GET /api/leads` endpoint maps every returned lead through `shapeLead()`, which calls `JSON.parse()` on three JSON columns per lead — O(n) JSON parses on every page load.
**Suggestion:** Use a column list instead of `SELECT *`, excluding heavy columns from list queries. Only fetch those when expanding a single lead detail. Add a `LIMIT 100` safety cap.

---

### [P2] `getAnalytics()` uses `json_extract` in aggregate query without index
**File:** `src/leads.ts:618-619`
**Issue:** The analytics Query 1 computes `AVG(CASE WHEN ... THEN json_extract(pricing_json, '$.quote_price') END)` across all done leads. Query 3 (line 643-649) uses `json_extract(classification_json, '$.format_recommended')` in both SELECT and GROUP BY, forcing SQLite to parse the JSON blob for every row twice. SQLite cannot index `json_extract` expressions.
**Suggestion:** Extract `quote_price` and `format_recommended` into top-level columns (a lightweight migration). This lets SQLite use normal column reads and indexes. Not urgent at current scale (<100 rows), but should be done before the table exceeds a few hundred rows.

---

### [P3] `retryFailures` map in scheduler resets on process restart
**File:** `src/follow-up-scheduler.ts:9`
**Issue:** The `retryFailures` Map is in-memory and resets on restart. A persistently failing lead could cycle through retries indefinitely across restarts — fail 2 times, restart, fail 2 more times, restart — without ever being marked as skipped.
**Suggestion:** Store the retry count in the database (a `follow_up_retry_count` column) so it survives restarts.

---

### [P3] Sequential processing in scheduler limits throughput
**File:** `src/follow-up-scheduler.ts:40-66`
**Issue:** `checkDueFollowUps()` processes up to 10 leads sequentially. Each iteration calls `generateFollowUpDraft` (Claude API, ~1-3s) and `sendSms` (Twilio, ~0.5-1s). With 10 leads, this could take 15-40 seconds. The `LIMIT 10` cap means if >10 leads are due, some wait until the next 15-minute cycle.
**Suggestion:** Process leads with bounded concurrency (e.g., `Promise.all` with limit of 3). Not urgent at current scale.

---

### [P3] `renderTable` and `renderMobile` do full innerHTML rebuild on every interaction
**File:** `public/dashboard.html:1648-1722`
**Issue:** After approve, edit save, or outcome save, the code calls `renderTable(currentLeads)` and `renderMobile(currentLeads)` which rebuild the entire table/card DOM from scratch using string concatenation and `innerHTML`. The `esc()` function creates a new DOM element on every call (400 temporary DOM elements for 50 leads).
**Suggestion:** Acceptable at current scale. For 100+ leads, consider targeted DOM updates instead of full re-renders.

---

### [P3] `shapeLead` parses JSON columns on every API call
**File:** `src/api.ts:24-85`
**Issue:** `shapeLead()` calls `JSON.parse()` on `classification_json`, `pricing_json`, and `gate_json` for every lead in the response. For 50 leads, that is 150 `JSON.parse` calls per page load. The `gate_json` in particular can be large (14 gut checks, concern traceability array, fail reasons).
**Suggestion:** Extracting frequently-used fields into top-level columns would eliminate JSON parsing at the API layer for list views.

---

### [P3] `normalizeRow` creates a new object spread for every row
**File:** `src/leads.ts:160-162`
**Issue:** `normalizeRow()` uses object spread (`{ ...row, gate_passed: ... }`) which copies all 30+ fields per lead. Called for every row from every query.
**Suggestion:** Mutate the `gate_passed` field in-place since `better-sqlite3` returns fresh objects per query.

---

### [P3] SSE connection for `/api/analyze` has no timeout
**File:** `src/api.ts:296-319`
**Issue:** The `POST /api/analyze` endpoint opens an SSE stream and awaits `runPipeline()`. If the pipeline hangs, the HTTP connection stays open indefinitely. No `req.on('close')` handler to abort if the client disconnects, and no server-side timeout.
**Suggestion:** Add a `req.on('close')` handler with `AbortController` and a 120-second server-side timeout.

---

### [P3] `completeApproval` transaction does redundant `getLead` calls
**File:** `src/leads.ts:499-509`
**Issue:** `completeApproval()` wraps a transaction around `updateLead()` + `scheduleFollowUp()`. But `updateLead()` internally fetches twice, and `scheduleFollowUp()` calls `updateLead()` again (fetching twice more). A single `completeApproval()` call executes 4 SELECT + 2 UPDATE queries inside a transaction.
**Suggestion:** Combine the two updates into a single SQL statement to reduce 6 queries to 1 UPDATE + 1 final SELECT.

---

## Scalability Assessment

| Dimension | Current (< 50 leads) | 100 leads | 500 leads |
|---|---|---|---|
| API list response | Fast (<10ms) | Acceptable (~30ms), payloads grow | Slow (~100ms+), 1MB+ payloads |
| Dashboard render | Instant | Acceptable | Noticeable lag, full re-render |
| Analytics query | Fast (<5ms) | Acceptable (~20ms with json_extract) | Slow (~100ms+), per-row JSON parsing |
| Scheduler batch | 1-4 seconds | 10-40 seconds (cap 10/cycle) | 40s per cycle, 50min backlog |
| Memory | Minimal | Minimal | All leads in memory per request |

## Recommended Actions

| # | Issue | Priority | Impact | Effort |
|---|-------|----------|--------|--------|
| 1 | Reduce `updateLead` double-reads | P2 | Cuts query count ~50% across all writes | Medium |
| 2 | Column selection + pagination for list queries | P2 | Reduces payload/memory ~80% | Medium |
| 3 | Extract `json_extract` columns to top-level | P2 | Eliminates per-row JSON parsing in analytics | Low |
| 4 | Persist retry count for scheduler | P3 | Prevents infinite retry across restarts | Low |
| 5 | SSE connection timeout + abort handler | P3 | Prevents connection/resource leaks | Low |
| 6 | Concurrent scheduler processing | P3 | 3x faster batch processing | Low |
| 7 | Optimize `normalizeRow` to mutate in-place | P3 | Minor memory/GC improvement | Trivial |
| 8 | Targeted DOM updates vs full re-render | P3 | Better UX at 100+ leads | Medium |
