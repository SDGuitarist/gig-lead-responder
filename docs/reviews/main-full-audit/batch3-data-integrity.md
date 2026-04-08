# Data Integrity Guardian — Review Findings

**Agent:** data-integrity-guardian
**Branch:** main (full codebase audit)
**Date:** 2026-04-07
**Files reviewed:** 63

## Findings

### [P1] Gmail-polled leads NOT persisted to SQLite — data loss on crash
**File:** `src/automation/orchestrator.ts:28-176`
**Issue:** The Gmail automation pipeline runs leads through LLM pipeline, sends replies, and logs to JSONL file — but never calls `insertLead()`. Gmail-sourced leads are invisible to dashboard, analytics, follow-up scheduler, and outcome tracking. If JSONL file is lost, all record vanishes. `markProcessed()` writes to JSON file, not `processed_emails` table.
**Suggestion:** Insert leads into SQLite at start of `processLead()` using `insertLead()`, update with pipeline results using `updateLead()`, use `markEmailProcessed()` for dedup.

---

### [P1] File-based dedup has read-write race condition
**File:** `src/automation/dedup.ts:1-23`
**Issue:** Between `isProcessed` check (orchestrator.ts:46) and `markProcessed` (line 175), pipeline runs for minutes. If crash occurs after sending reply but before markProcessed, lead is re-processed and re-sent on restart. File grows forever with no cleanup. Concurrent reads/writes can lose data.
**Suggestion:** Use SQLite `processed_emails` table with transactional dedup check+mark.

---

### [P1] `listLeadsFiltered` has no LIMIT — unbounded query
**File:** `src/db/queries.ts:55-82`
**Issue:** No LIMIT clause. Every dashboard load fetches all leads. At 1000 leads with JSON columns (classification_json ~2KB each): hundreds of KB per request. Cycle 12 claimed to add pagination — not present on main.
**Suggestion:** Add `LIMIT @limit OFFSET @offset` (default 50, max 200).

---

### [P2] Table rebuild migration is not crash-safe
**File:** `src/db/migrate.ts:98-148`
**Issue:** Migration creates `leads_new`, copies data, drops `leads`, renames `leads_new`. If crash between DROP and RENAME: `leads` gone, `leads_new` orphaned. On restart, `initDb()` creates fresh empty `leads` table — existing data in `leads_new` lost. Indexes not recreated inside transaction.
**Suggestion:** Add startup check for `leads_new` existence. If it exists without `leads`, rename it.

---

### [P2] Bare `JSON.parse` in twilio-webhook.ts without try-catch
**File:** `src/twilio-webhook.ts:143-147`
**Issue:** `JSON.parse(lead.classification_json)` and `JSON.parse(lead.pricing_json)` with no try-catch. Corrupted JSON makes lead permanently uneditable via SMS with no user-visible error.
**Suggestion:** Wrap in try-catch, send SMS like "Lead #X has corrupted data. Use dashboard instead."

---

### [P2] Follow-up scheduler claim-then-generate gap
**File:** `src/follow-up-scheduler.ts:43-62`
**Issue:** Scheduler claims follow-up (sets status to 'sent'), then generates draft via async LLM call (seconds), then stores draft. During gap: dashboard shows "sent" with no draft. If LLM call fails, briefly in inconsistent state before revert.
**Suggestion:** Generate draft before claiming, or add "generating" intermediate state.

---

### [P2] `postPipeline` non-atomic two-step write
**File:** `src/post-pipeline.ts:11-53`
**Issue:** Saves pipeline results (step 1), sends SMS (step 2), marks as sent (step 3). Crash between steps 1 and 3: lead stuck in "received" with completed pipeline but no SMS. MEMORY.md mentions Cycle 12 startup recovery but code shows none.
**Suggestion:** Add startup recovery: query leads where `status = 'received' AND pipeline_completed_at IS NOT NULL`.

---

### [P2] `claimLeadForSending` allows re-claiming from 'sent' status
**File:** `src/db/leads.ts:171-176`
**Issue:** WHERE clause is `status IN ('received', 'sent')`. Two concurrent approvals could both claim. Second succeeds even though first already sent SMS. Result: double SMS sends.
**Suggestion:** Split into `claimForFirstSend` (WHERE received) and `claimForApproval` (WHERE sent).

---

### [P2] Triplicated stmt() cache
**File:** `src/db/leads.ts:10-24`, `src/db/queries.ts:31-46`, `src/db/follow-ups.ts:9-24`
**Issue:** Three identical copies maintaining separate caches. Same SQL prepared in two files = two separate prepared statements. If database handle changes, caches may desync.
**Suggestion:** Extract to `src/db/stmt-cache.ts`.

---

### [P2] No data lifecycle management — unbounded growth
**File:** `src/db/migrate.ts` (no cleanup logic exists)
**Issue:** No mechanism to archive/purge old leads. `leads`, `processed_emails`, `venue_misses` tables grow forever. `data/processed-ids.json` and `logs/leads.jsonl` grow without bound. SQLite performance degrades with large databases.
**Suggestion:** Add retention policy, TTL cleanup for processed_emails, log rotation, cap on processed-ids.json.

---

### [P2] Dashboard HTML served without authentication
**File:** `src/app.ts:55-67`
**Issue:** `/dashboard.html` and root redirect registered before API router auth. HTML including scripts and UI structure publicly accessible. MEMORY.md says Cycle 12 fixed this — not present on main.
**Suggestion:** Add `sessionAuth` to dashboard routes.

---

### [P2] JSON column writes not validated before storage
**File:** `src/post-pipeline.ts:17-26`
**Issue:** `JSON.stringify(output.classification)` stored without length limit or round-trip validation. Malformed LLM response with huge arrays silently stores megabytes.
**Suggestion:** Wrap in try-catch, add max length check (~50KB per JSON column).

---

### [P3] `source_platform` not populated for all intake paths
**File:** `src/db/leads.ts:117-127`
**Issue:** Column only set during `insertLead()`. Leads from `/api/analyze` SSE endpoint have no platform. Analytics by platform shows these as "unknown".
**Suggestion:** Store platform via `updateLead` when pipeline identifies it.

---

### [P3] `venue_misses` table has no foreign key on `last_lead_id`
**File:** `src/db/migrate.ts:178-188`
**Issue:** `last_lead_id INTEGER` has no `REFERENCES leads(id)` constraint. Orphaned values persist if leads deleted.
**Suggestion:** Add `REFERENCES leads(id) ON DELETE SET NULL`.

---

### [P3] `getLeadsByStatus` returns all leads with no LIMIT
**File:** `src/db/leads.ts:108-113`
**Issue:** Under backlog conditions (SMS delivery failure), could return hundreds of rows.
**Suggestion:** Add LIMIT 100 safety valve.

---

### [P3] `approveFollowUp` uses 3 SQL operations instead of 1
**File:** `src/db/follow-ups.ts:93-125`
**Issue:** Three separate SQL operations in one transaction. Could be a single UPDATE with computed values.
**Suggestion:** Combine into single UPDATE statement.

---

### [P3] `COOKIE_SECRET` validation calls `process.exit(1)`
**File:** `src/auth.ts:13-15`
**Issue:** Holdover. Terminates process from middleware. MEMORY.md says Cycle 12 changed this to throw — not present on main.
**Suggestion:** Replace with `throw new Error(...)`.

---

### [P3] Credentials file written with default permissions
**File:** `src/automation/poller.ts:22-31`
**Issue:** Token file correctly uses `mode: 0o600` but credentials file written with default permissions (potentially world-readable).
**Suggestion:** Add `{ mode: 0o600 }` to credentials file write.

---

### [P3] `shapeLead` accepts undefined input but callers never pass undefined
**File:** `src/utils/shape-lead.ts:12-13`
**Issue:** Returns null for undefined but no call site filters nulls. Dead code path with misleading type signature.
**Suggestion:** Accept `LeadRecord` only (not `LeadRecord | undefined`).

---

### [P3] No index documentation for dedup table
**File:** `src/db/migrate.ts:25`
**Issue:** `processed_emails` is authoritative dedup table. `leads.mailgun_message_id` is informational. Not documented, could lead to future confusion.
**Suggestion:** Add comment documenting the relationship.

---

## Key Theme

Several findings (stmt cache, dashboard auth, process.exit in auth, startup recovery) were documented in MEMORY.md as fixed in Cycle 12 but are NOT present on main. The git history analysis should confirm whether these fixes exist on unmerged branches.

## Summary

- **P1:** 3 (Gmail leads not persisted, file dedup race, unbounded queries)
- **P2:** 9 (migration safety, state gaps, no lifecycle management, missing auth)
- **P3:** 8 (permissions, type tightening, missing indexes)
