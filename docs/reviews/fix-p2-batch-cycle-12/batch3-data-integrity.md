# Data Integrity Guardian — Review Findings

**Agent:** compound-engineering:review:data-integrity-guardian
**Branch:** fix/p2-batch-cycle-12
**Date:** 2026-03-05
**Files reviewed:** 20 (src/ files)

## Findings

### [P2] postPipeline lacks atomicity -- pipeline results and status update are separate writes with an async gap
**File:** `src/post-pipeline.ts:16-50`
**Issue:** `postPipeline` performs three sequential database writes (save pipeline results on line 17, re-read lead on line 29, then mark as "sent" on line 47) with an `await sendSms()` call between steps 1 and 3. If the process crashes after saving pipeline results but before marking status="sent", the lead stays in "received" status with populated draft fields. On restart, the webhook dedup will prevent reprocessing, so the lead is stuck -- it has drafts but will never advance to "sent" because no code path re-triggers the SMS+status update for leads in this state.
**Suggestion:** Either (a) wrap steps 1 and 3 in a `runTransaction` that bookends the SMS call (update results + set status="sending" atomically, send SMS, then update to "sent"), or (b) add a startup recovery job that finds leads in "received" status with a non-null `pipeline_completed_at` and re-attempts the SMS+status transition. Option (b) is simpler and avoids holding a transaction open across a network call.

---

### [P2] approveFollowUp reads stale follow_up_count after its own UPDATE
**File:** `src/db/follow-ups.ts:93-125`
**Issue:** Inside the transaction, line 97 sets `follow_up_status = 'pending'` via a raw SQL UPDATE, then line 103 calls `getLead(leadId)` to read the current `follow_up_count`. The raw SQL UPDATE on line 97 bypasses `updateLead`'s `updated_at` timestamp, so the intermediate state has the wrong `updated_at` value within the transaction. The pattern is correct but brittle -- if any future change to the raw UPDATE also touches `follow_up_count`, the increment could double-count.
**Suggestion:** Use `updateLead` for the initial status change instead of raw SQL, or add a comment explicitly documenting why raw SQL is used here (presumably for the atomic `WHERE follow_up_status = 'sent'` guard).

---

### [P2] Table rebuild migration could fail catastrophically on duplicate mailgun_message_id
**File:** `src/db/migrate.ts:103-148`
**Issue:** The table rebuild migration creates `leads_new` with `mailgun_message_id TEXT UNIQUE`. The `INSERT INTO leads_new ... SELECT ... FROM leads` on line 143 could fail if the existing `leads` table somehow has duplicate `mailgun_message_id` values. This would cause the entire migration transaction to roll back, and `initDb()` would fail on every startup, making the app unrecoverable without manual DB intervention.
**Suggestion:** Add a pre-migration check: `SELECT mailgun_message_id, COUNT(*) FROM leads WHERE mailgun_message_id IS NOT NULL GROUP BY mailgun_message_id HAVING COUNT(*) > 1`. If duplicates exist, log them and handle before attempting the rebuild.

---

### [P2] Scheduler retry reverts status to "pending" without resetting updated_at context
**File:** `src/follow-up-scheduler.ts:63-75`
**Issue:** When a follow-up fails and hasn't exhausted retries, the code reverts `follow_up_status` back to "pending". The `updated_at` value reflects scheduler retries rather than user-visible state changes, which could confuse the `getLeadAwaitingFollowUp` query that sorts by `updated_at DESC`.
**Suggestion:** Consider adding a `follow_up_last_error_at` column or at minimum documenting that `updated_at` reflects scheduler retries, not user-visible state changes.

---

### [P3] Three separate stmt() caches could grow unbounded across modules
**File:** `src/db/leads.ts:11`, `src/db/follow-ups.ts:11`, `src/db/queries.ts:11`
**Issue:** Each module has its own independent `stmtCache` Map. These caches grow monotonically and the "keep in sync" comments reference each other but there is no enforcement mechanism.
**Suggestion:** Extract the `stmt()` helper into a shared utility module in `src/db/` to eliminate the three duplicated implementations.

---

### [P3] venue_misses.last_lead_id has no foreign key constraint
**File:** `src/db/migrate.ts:161-168`
**Issue:** The `venue_misses` table has a `last_lead_id INTEGER` column that references `leads.id` conceptually, but no `REFERENCES leads(id)` foreign key constraint is defined. Foreign keys are enabled (`PRAGMA foreign_keys = ON`), so the infrastructure is in place.
**Suggestion:** Add `REFERENCES leads(id) ON DELETE SET NULL` to the `last_lead_id` column definition.

---

### [P3] JSON.parse of classification_json and pricing_json in twilio-webhook.ts has no validation
**File:** `src/twilio-webhook.ts:143-146`
**Issue:** Lines 143-146 parse `lead.classification_json` and `lead.pricing_json` with bare `JSON.parse()` and cast directly to types. If these JSON columns contain malformed data, this will throw an unhandled exception.
**Suggestion:** Wrap in try/catch with a user-friendly SMS error, or reuse the validators from the pipeline modules.

---

### [P3] completeApproval in Twilio handler does not pass sms_sent_at
**File:** `src/twilio-webhook.ts:102`
**Issue:** The Twilio handler calls `completeApproval(lead.id, "approved")` without the optional `smsSentAt` parameter, while the dashboard API passes `new Date().toISOString()`. Leads approved via SMS will have `sms_sent_at = null`.
**Suggestion:** Pass `new Date().toISOString()` as the third argument for consistency.

---

### [P3] listLeadsFiltered allows "sending" status in TypeScript but not in VALID_STATUSES set
**File:** `src/api.ts:20-33`
**Issue:** The `VALID_STATUSES` set contains `["received", "sent", "done", "failed"]` but omits `"sending"`. A client querying for "sending" would silently get an unfiltered result.
**Suggestion:** Either add `"sending"` to `VALID_STATUSES` or return a 400 error for unknown status values.

---

## Summary

| Severity | Count |
|----------|-------|
| P1 | 0 |
| P2 | 4 |
| P3 | 5 |

The codebase demonstrates solid patterns overall: transaction boundaries for dedup+insert, atomic claim patterns for state transitions, column whitelisting to prevent SQL injection, proper use of WAL mode and foreign keys. The P2 findings center on crash-recovery gaps in the pipeline post-processing flow and a fragile pattern in the follow-up approval transaction.
