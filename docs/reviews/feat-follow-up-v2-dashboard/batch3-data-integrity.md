# Data Integrity Guardian — Review Findings

**Agent:** compound-engineering:review:data-integrity-guardian
**Branch:** feat/follow-up-v2-dashboard
**Date:** 2026-03-02
**Files reviewed:** 10

## Findings

### [P1] Scheduler leaves failed follow-ups stuck in "sent" status
**File:** `src/follow-up-scheduler.ts:42-65`
**Issue:** When the scheduler claims a follow-up (atomically transitions `pending` to `sent` at line 43), and then either draft generation or SMS sending fails, the catch block on line 55 does **not** revert the `follow_up_status` back to `pending`. The lead stays stuck in `sent` status. On subsequent scheduler ticks, `getLeadsDueForFollowUp()` only queries `follow_up_status = 'pending'`, so this lead will never be retried by the scheduler. It becomes invisible to the automatic process. After `MAX_SCHEDULER_RETRIES` (3) failures, the lead is set to `skipped` (line 61), but the retry counter is stored in an in-memory `Map`. If the process restarts between failures 1 and 3, the counter resets to 0 while the lead is permanently stuck in `sent`.
**Suggestion:** On failure (before the max-retry skip), revert the follow-up status back to `pending` so the scheduler can retry on the next tick: `updateLead(lead.id, { follow_up_status: "pending" });`. Also consider persisting the retry count in the database (e.g., a `follow_up_retry_count` column) so it survives process restarts.

---

### [P1] Non-atomic approve-then-send flow risks double-send or stuck state
**File:** `src/api.ts:146-170`
**Issue:** The approval flow performs three separate database writes that are not wrapped in a single transaction: (1) `claimLeadForSending(id)` sets status to `sending`, (2) `updateLead(id, { sms_sent_at: ... })` stamps send time, (3) `completeApproval(id, "approved_dashboard")` sets `done` + schedules follow-up. If the process crashes between step 2 and step 3, the lead has `sms_sent_at` set and status `sending`, but never transitions to `done` and never gets a follow-up scheduled. On restart, the lead is stuck in `sending` status with no recovery path.
**Suggestion:** Combine steps 2 and 3 into a single transaction. Since `completeApproval` already uses `runTransaction`, fold the `sms_sent_at` update into it. Or add a startup recovery check that finds leads stuck in `sending` and either reverts or completes them.

---

### [P2] Table rebuild migration drops status/event_date indexes without recreating them
**File:** `src/leads.ts:96-146`
**Issue:** The table rebuild migration drops the original `leads` table and renames `leads_new`. The original table's indexes (`idx_leads_status`, `idx_leads_event_date`) are created in the initial `db.exec` block at lines 49-50, which runs **before** the migration. After the table rebuild drops and recreates the table, those two indexes are gone and never recreated because the `CREATE INDEX IF NOT EXISTS` already ran (successfully) on the old table before the rebuild. The post-migration indexes at lines 149-152 only cover `confidence`, `outcome`, `source_platform`, and `follow_up_due`.
**Suggestion:** Move all index creation statements to after the rebuild migration block, so they survive table rebuilds.

---

### [P2] Scheduler draft store races with user skip/reply actions
**File:** `src/follow-up-scheduler.ts:48-50`
**Issue:** Between the claim at line 43 (status becomes `sent`) and draft storage at line 50, if the user calls `skipFollowUp` or `markClientReplied` from the dashboard, those functions check for status `IN ('pending', 'sent')`. Since the lead is now in `sent` status, the skip/reply would succeed, clearing the draft fields. Then the scheduler writes the draft back, overwriting the null. The lead would end up with `follow_up_status = 'skipped'` but `follow_up_draft` populated — an inconsistent state.
**Suggestion:** After storing the draft, re-check the follow-up status before sending the SMS notification. Or wrap the draft-store + notification in a transaction with a WHERE guard on status.

---

### [P2] SMS failure reverts to potentially stale status variable
**File:** `src/api.ts:152-159`
**Issue:** On SMS failure, the revert at line 156 sets status back to whatever `lead.status` was captured at line 130 (`const lead = getLead(id)`), before the claim. If between `getLead` and `claimLeadForSending`, another request changed the lead's status, the revert would restore a stale status. In practice this is unlikely because `claimLeadForSending` uses an atomic WHERE clause, but the pattern is fragile.
**Suggestion:** Revert to a known good status constant instead of relying on the stale `lead.status` variable.

---

### [P2] TOCTOU gap between getLead and follow-up action in follow-up-api.ts
**File:** `src/follow-up-api.ts:23-35`
**Issue:** In the approve endpoint (and similarly in skip, snooze, and replied), the code first calls `getLead(id)` to check existence, then calls the action function. The underlying action does its own atomic WHERE check, so if the lead was deleted or its status changed between the two calls, the function returns `undefined` and the endpoint returns 409. The `getLead` check is redundant and creates a misleading pattern — the atomic UPDATE provides the real protection.
**Suggestion:** Minor code clarity issue. The extra `getLead` is harmless but unnecessary.

---

### [P3] No CSRF guard on main API POST endpoints
**File:** `src/api.ts:1-321` and `src/follow-up-api.ts:1-138`
**Issue:** The follow-up API router applies `csrfGuard` to each POST endpoint individually. However, the main API router (`api.ts`) does not apply `csrfGuard` to its POST endpoints (`/api/leads/:id/approve`, `/api/leads/:id/edit`, `/api/leads/:id/outcome`, `/api/analyze`). This is inconsistent — the follow-up endpoints are CSRF-protected but the approve/edit/outcome endpoints are not.
**Suggestion:** Apply `csrfGuard` to the main API router as well.

---

### [P3] In-memory rate limiter state lost on deploy
**File:** `src/rate-limit.ts:1-45`
**Issue:** The rate limiter uses the default in-memory store, which resets on every process restart (Railway deploys). For a single-user dashboard this is acceptable.
**Suggestion:** Acknowledged trade-off. No action needed.
