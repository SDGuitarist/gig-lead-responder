# Performance Oracle — Review Findings

**Agent:** compound-engineering:review:performance-oracle
**Branch:** main
**Date:** 2026-02-20
**Files reviewed:** 5 (+ full src/ directory performance analysis)

## Findings

### [P1] Unhandled promise rejection / no timeout on fire-and-forget pipeline
**File:** `src/webhook.ts:124-133`
**Issue:** The fire-and-forget pattern `runPipeline(...).then(...).catch(...)` has no timeout or cancellation. If the Claude API hangs indefinitely, the in-flight pipeline holds memory (full prompt context, rate data, classification objects) and a dangling promise forever. With multiple leads arriving during an API latency spike, memory grows unbounded. Mailgun will also retry webhooks if the server becomes unresponsive.
**Suggestion:** Add a timeout wrapper (e.g., 2 minutes) around `runPipeline`. This is a ~15-line helper function.

---

### [P2] SQLite prepared statements are not cached
**File:** `src/leads.ts:85,115,125,163,173,180,186`
**Issue:** Every call to `insertLead`, `getLead`, `getLeadsByStatus`, etc. calls `initDb().prepare(...)` fresh each time. While SQLite caches at the C level, the JavaScript `Statement` objects are recreated per call. Currently negligible, but grows with volume.
**Suggestion:** Cache static prepared statements as module-level variables, initialized lazily.

---

### [P2] `listLeads()` fetches all rows with SELECT * and no pagination
**File:** `src/leads.ts:184-193`
**Issue:** Dashboard's `GET /leads` calls `listLeads()` which runs `SELECT * FROM leads ORDER BY created_at DESC` with no LIMIT. Fetches all columns including multi-KB text fields (raw_email, drafts, JSON blobs). Dashboard only displays 9 of ~20 columns. At 1000 leads, this loads 5-10MB per page load.
**Suggestion:** (1) Add LIMIT/OFFSET pagination. (2) Select only the columns the dashboard needs.

---

### [P2] Context files re-read from disk on every pipeline run
**File:** `src/pipeline/context.ts:10-20`
**Issue:** `selectContext()` reads 3-6 markdown files from disk on every pipeline run. These files (~1148 lines total) don't change at runtime. If multiple pipelines run concurrently, each reads the same files.
**Suggestion:** Read files once at startup into a `Map<string, string>` cache.

---

### [P2] No explicit request body size limit on webhook
**File:** `src/server.ts:20`
**Issue:** `express.urlencoded({ extended: false })` uses Express default of 100KB. Mailgun email bodies can occasionally be larger with inline attachments. If payload exceeds 100KB, Express returns 413 and the lead is silently lost.
**Suggestion:** Set explicit limit: `express.urlencoded({ extended: false, limit: '500kb' })`.

---

### [P2] `insertLead` does INSERT then SELECT where one operation suffices
**File:** `src/leads.ts:110`
**Issue:** `insertLead` does an INSERT followed by a `getLead` SELECT to return the full record. The SELECT is unnecessary — the result can be constructed from input data + `lastInsertRowid`.
**Suggestion:** Construct the `LeadRecord` directly from input data instead of doing a follow-up SELECT.

---

### [P2] `postPipeline` does two separate `updateLead` calls
**File:** `src/post-pipeline.ts:18-27,48-51`
**Issue:** `postPipeline` calls `updateLead` twice, and each `updateLead` internally does SELECT + UPDATE + SELECT (3 SQL ops). That's 6 SQL operations where 2 would suffice. The two-step approach is logically correct (need SMS to succeed first), but the pre-read `getLead` inside `updateLead` is unnecessary.
**Suggestion:** Remove the existence-check `getLead` from inside `updateLead`. Combine update calls where possible.

---

### [P3] Duplicate Twilio client modules
**File:** `src/twilio.ts` and `src/sms.ts`
**Issue:** Two Twilio client modules with different env var names. `twilio.ts` appears unused.
**Suggestion:** Verify `twilio.ts` is unused and remove it.

---

### [P3] `callClaude` retry on JSON parse failure doubles API cost
**File:** `src/claude.ts:44-65`
**Issue:** If Claude returns invalid JSON, a second API call is made. This doubles Anthropic costs for that stage. Unknown frequency without monitoring.
**Suggestion:** Add a counter/metric for JSON parse retries to monitor frequency.

---

### [P3] Venue lookup uses linear scan for partial matches
**File:** `src/data/venues.ts:71-82`
**Issue:** `findVenue()` does exact match (O(1)) then falls back to linear scan of ~25 entries. Negligible at current scale.
**Suggestion:** No action needed. Consider trie/index if venue list grows to hundreds.

---

### [P3] AI pipeline is inherently sequential (3-7 API calls)
**File:** `src/run-pipeline.ts:59-114`
**Issue:** Pipeline makes 3-7 sequential Claude API calls (~6-24 seconds total). Each stage depends on the previous, so parallelism isn't possible within the current design. The fire-and-forget pattern is the correct approach.
**Suggestion:** No structural change needed. Monitor gate retry success rate — if retries rarely succeed, reduce `maxRetries` to save API calls.

---

### [P3] No explicit body size limit documentation
**File:** `src/server.ts:20`
**Issue:** The Express default 100KB limit is implicit, not documented.
**Suggestion:** Make it explicit: `express.urlencoded({ extended: false, limit: '500kb' })`.
