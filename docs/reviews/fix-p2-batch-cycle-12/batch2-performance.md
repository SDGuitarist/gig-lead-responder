# Performance Oracle — Review Findings

**Agent:** performance-oracle
**Branch:** fix/p2-batch-cycle-12
**Date:** 2026-03-05
**Files reviewed:** 20

## Summary

| Priority | Count |
|----------|-------|
| P1 | 1 |
| P2 | 5 |
| P3 | 5 |

## Findings

### [P1] Unbounded query in listLeadsFiltered — no LIMIT or pagination
**File:** `src/db/queries.ts:33-60`
**Issue:** `SELECT * FROM leads` with optional WHERE/ORDER BY but no LIMIT. Each row contains large TEXT columns (raw_email, full_draft, compressed_draft, classification_json, pricing_json, gate_json) — 5-10KB each. At 500 leads: ~5MB response. At 2,000 leads: ~20MB. `shapeLead()` then calls `JSON.parse()` 3x per row.
**Suggestion:** Add pagination (LIMIT 50 OFFSET 0). Consider "list" query with only table-view columns and separate "detail" endpoint for full row.

---

### [P2] Triplicated stmt() cache pattern across three files
**Files:** `src/db/leads.ts:10-24`, `src/db/follow-ups.ts:10-24`, `src/db/queries.ts:9-24`
**Issue:** Three separate Map caches for one database connection. Same SQL prepared in different modules gets prepared again. Maintenance and correctness risk.
**Suggestion:** Extract to shared `src/db/stmt-cache.ts` module.

---

### [P2] updateLead() bypasses stmt cache on every call
**File:** `src/db/leads.ts:158-163`
**Issue:** Dynamic SQL constructed per call, `initDb().prepare(sql)` called directly. Costs ~0.1ms per call — negligible now but adds up during scheduler batch processing.
**Suggestion:** Accept as intentional. Monitor if batch sizes grow.

---

### [P2] Sequential processing in follow-up scheduler with no parallelism
**File:** `src/follow-up-scheduler.ts:43-77`
**Issue:** `checkDueFollowUps()` processes leads in sequential `for...of` loop. Each iteration includes LLM draft generation (3-10 seconds). With 10 leads due, takes 30-100 seconds. After multi-hour outage, catch-up takes multiple scheduler cycles.
**Suggestion:** Process with limited concurrency (e.g., `Promise.allSettled` with concurrency limit of 3). DB claims are already atomic.

---

### [P2] Dashboard re-renders both table AND mobile cards on every action
**File:** `public/dashboard.html:1793-1796,1838-1842,1853-1856,1988-1989`
**Issue:** After every approve/edit-save/cancel/outcome-save, full `innerHTML` rebuild of both table and mobile views. With 100+ leads, causes visible layout thrashing on mobile.
**Suggestion:** Update only the affected row/card by `data-id`, or only re-render the visible view.

---

### [P2] SSE connection for /api/analyze has no heartbeat
**File:** `src/api.ts:237-253`
**Issue:** SSE stream during pipeline execution has no keep-alive heartbeat. Gaps of 10-20 seconds during LLM calls. Railway proxy may close idle connections after 30 seconds.
**Suggestion:** Add `:heartbeat\n\n` every 15 seconds via `setInterval`. Clear in `finally` block.

---

### [P3] getLeadsByStatus returns all matching leads without LIMIT
**File:** `src/db/leads.ts:108-113`
**Issue:** Used in `twilio-webhook.ts:76` to check 0/1/multiple sent leads. Fetches ALL "sent" leads including large TEXT columns when only count matters.
**Suggestion:** Use `LIMIT 2` — only need to distinguish 0, 1, or 2+ results.

---

### [P3] dashboardHtml regex replace on every request
**File:** `src/server.ts:70-75`
**Issue:** CSP nonce regex runs against full 2,480-line HTML on every request. ~0.1ms cost.
**Suggestion:** Fine for current scale. Could use placeholder token for simple `replaceAll`.

---

### [P3] shapeLead() parses JSON 3x for every lead in list responses
**File:** `src/utils/shape-lead.ts:15-17`
**Issue:** 300 `JSON.parse()` calls for 100 leads. Directly related to P1 — resolved by pagination.
**Suggestion:** Address via pagination. Alternatively, return "slim" shape for list view.

---

### [P3] Missing index consideration (composite index coverage)
**File:** `src/db/migrate.ts:157`
**Issue:** Composite index `idx_leads_follow_up_due ON leads(follow_up_status, follow_up_due_at)` covers primary queries. SQLite uses leftmost prefix for status-only queries.
**Suggestion:** No action needed — working correctly.

---

### [P3] Venue lookup has no caching — repeated HTTP calls for same venue
**File:** `src/venue-lookup.ts:18-69`
**Issue:** HTTP request to PF-Intel on every call with no caching. Same venue in multiple leads triggers redundant network calls. Also vulnerable to PF-Intel downtime.
**Suggestion:** Add in-memory Map cache with 5-10 minute TTL keyed by normalized venue name.

---

## Scalability Assessment

| Scale | Status | Bottleneck |
|-------|--------|-----------|
| 100 leads | OK | None |
| 500 leads | Slow | P1 pagination, P2 DOM re-render |
| 2,000 leads | Unusable | API responses >10MB |
| 10,000 leads | SQLite fine | Application layer unbounded queries |
