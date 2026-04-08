# Performance Oracle — Review Findings

**Agent:** performance-oracle
**Branch:** main (full codebase audit)
**Date:** 2026-04-07
**Files reviewed:** 63

## Findings

### [P1] File-based dedup reads/writes entire JSON file on every check
**File:** `src/automation/dedup.ts:6-23`
**Issue:** `isProcessed()` does synchronous `readFileSync` + `JSON.parse` of entire `data/processed-ids.json` per message. `markProcessed()` reads again, adds one ID, writes back. Never pruned — grows forever. At 10,000 IDs, 5-15ms event loop block per message. For 20-message batch: 40 synchronous file operations.
**Suggestion:** Use existing SQLite `processed_emails` table via `isEmailProcessed()` / `markEmailProcessed()` from `src/db/leads.ts`. Eliminates file, leverages indexes, atomic.

---

### [P1] `listLeadsFiltered` returns ALL leads with no pagination
**File:** `src/db/queries.ts:55-82`
**Issue:** No LIMIT clause. Returns every matching lead, all mapped through `normalizeLeadRow` (spread copy) then `shapeLead` (3x JSON.parse per lead). At 1000 leads: 3,000 JSON.parse calls per dashboard load. MEMORY.md says Cycle 12 added pagination but code has no LIMIT — fix was not merged or was reverted.
**Suggestion:** Add `LIMIT 50 OFFSET @offset`. Verify which branch has the pagination fix.

---

### [P2] `callClaude` silent double-API-call on JSON parse failure
**File:** `src/claude.ts:67-90`
**Issue:** First Claude response failing JSON parse triggers second API call with no logging of what failed. Doubles cost and adds 5-30s latency with no visibility.
**Suggestion:** Log raw response on parse failure before retrying. Add retry metric counter.

---

### [P2] `getAnalytics()` runs 8 separate queries with json_extract
**File:** `src/db/queries.ts:109-271`
**Issue:** Analytics endpoint runs 8 SQLite queries in a transaction, all synchronous. Query 3 (`by_format`) uses `json_extract` on every done lead — O(n) per row. At 1000 done leads: 30-50ms event loop block.
**Suggestion:** Denormalize `format_recommended` column onto leads table for index-friendly queries.

---

### [P2] Playwright browser launched per portal operation
**File:** `src/automation/portals/yelp-client.ts:67-68,173-174`, `src/automation/portals/gigsalad-client.ts:37-38`
**Issue:** Each `fetchLeadDetails()` and `submitReply()` launches a new Chromium process (100-200MB RAM each, 2-5s launch). For Yelp enrichment + reply: 2 browser launches per lead. Risk of leaked browser processes if `processLead` throws.
**Suggestion:** Keep persistent context alive across operations within a poll cycle. Launch once, reuse for batch, close at end.

---

### [P2] `selectContext()` reads multiple files from disk per pipeline run
**File:** `src/pipeline/context.ts:27-77`
**Issue:** Reads 3-6 markdown files via `fs.promises.readFile` every pipeline run. Files are static business logic docs that never change during runtime.
**Suggestion:** Cache file contents in module-level variables after first read. Simple `Map<string, string>` cache in `readDoc`.

---

### [P2] `normalizeLeadRow` creates spread copy for every row
**File:** `src/db/leads.ts:52-54`
**Issue:** Spread operator `{ ...row, gate_passed: ... }` creates shallow copy of every row from every query. At 1000 rows: 2000 new objects (normalizeLeadRow + shapeLead) per dashboard load.
**Suggestion:** Mutate in place — SQLite row objects are not reused.

---

### [P2] Gmail poller fetches messages sequentially
**File:** `src/automation/gmail-watcher.ts:158-166`
**Issue:** Fetches up to 20 message stubs, then fetches each full message one at a time in a `for` loop. 20 messages = 20 sequential API calls = 2-10 seconds of fetch latency.
**Suggestion:** Use `Promise.all` with concurrency limit (5 concurrent fetches).

---

### [P2] SSE endpoint has no heartbeat/keepalive
**File:** `src/api.ts:230-258`
**Issue:** `/api/analyze` SSE endpoint has no heartbeat between events. Pipeline can take 30-120s. Proxies may close idle connections after 30-60s. MEMORY.md says Cycle 12 added 15s heartbeat but code shows none — fix not merged.
**Suggestion:** Add `setInterval` sending `:heartbeat\n\n` every 15s, clear in `finally` block.

---

### [P2] `runWithVerification` can make up to 12 LLM calls per lead (worst case)
**File:** `src/pipeline/verify.ts:40-74`
**Issue:** Verification loop: up to 3 rounds of generate+verify, each can retry on parse failure. Worst case: 12 Claude API calls, 60-360 seconds. Mailgun webhook has 2-min timeout, so deep retries will timeout.
**Suggestion:** Design tradeoff (quality vs speed). Log which leads trigger retries to tune prompts.

---

### [P3] `logLead` uses synchronous `appendFileSync` and `mkdirSync`
**File:** `src/automation/logger.ts:24-29`
**Issue:** Synchronous file operations on event loop per log entry.
**Suggestion:** Use async `appendFile` and call `mkdirSync` once at startup.

---

### [P3] CSP nonce generated per request for all routes
**File:** `src/app.ts:31`
**Issue:** `randomBytes(16)` called synchronously for every request, including API calls that don't serve HTML. ~0.1ms overhead per call.
**Suggestion:** Minor — only generate for HTML routes, or accept negligible overhead.

---

### [P3] No timeout on Twilio `sendSms`
**File:** `src/sms.ts:18-26`
**Issue:** `client.messages.create()` has no explicit timeout. If Twilio API hangs, calling code waits indefinitely.
**Suggestion:** Wrap with `AbortSignal.timeout(10_000)`.

---

### [P3] Triplicated stmt() cache pattern
**File:** `src/db/leads.ts`, `src/db/queries.ts`, `src/db/follow-ups.ts`
**Issue:** Three identical copies maintaining separate `stmtCache` Maps. Could cache same SQL across modules.
**Suggestion:** Consolidate to shared module (known Cycle 12 debt).

---

### [P3] Voice reference strings concatenated into every generate prompt
**File:** `src/data/voice-references.ts`
**Issue:** 8 reference objects (~3KB) concatenated into every prompt, making input ~8-12K tokens. By design for quality, but worth tracking as references grow.
**Suggestion:** Monitor token cost as references are added.

---

## Scalability Assessment

| Dimension | Current Load | 10x Load | Bottleneck |
|-----------|-------------|----------|------------|
| Leads/month | ~10-50 | ~100-500 | LLM API cost ($3-15/mo at 10x) |
| Dashboard loads/day | ~5-20 | ~50-200 | listLeadsFiltered + shapeLead JSON.parse |
| Gmail poll messages/cycle | 0-5 | 0-50 | Sequential fetchMessage + processLead |
| SQLite rows | <200 | <2000 | getAnalytics json_extract |
| Memory (Hobby plan) | ~100MB | ~200MB | Playwright launches (+150MB each) |
| Dedup file size | <10KB | <100KB | Linear growth, never pruned |
