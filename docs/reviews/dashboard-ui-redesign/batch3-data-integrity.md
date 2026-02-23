# Data Integrity Guardian — Review Findings

**Agent:** compound-engineering:review:data-integrity-guardian
**Branch:** main (commit range ddb515d..d5b34fe)
**Date:** 2026-02-22
**Files reviewed:** 6

## Findings

### [P1] Approve endpoint: SMS sent but status update can fail, leaving data inconsistent
**File:** `src/api.ts:122-136`
**Issue:** The `POST /api/leads/:id/approve` handler calls `sendSms()` first (line 123), and only then calls `updateLead()` to mark the lead as `done` (line 130). If the process crashes or the `updateLead` call fails after SMS is sent successfully, the SMS has gone out to the client but the database still shows the lead as `received` or `sent`. On the next page load, the "Approve & Send" button reappears, and a user could send the SMS a second time. There is no idempotency guard on this action.
**Suggestion:** Either update status to `done` before sending SMS (rolling back on failure), or add an idempotency marker like `sms_approved_at` timestamp checked at the top of the handler.

---

### [P1] Edit endpoint: read-then-write race condition on edit_round
**File:** `src/api.ts:154-165`
**Issue:** The `POST /api/leads/:id/edit` handler reads the lead, then increments `edit_round` in application code (`lead.edit_round + 1`), and writes it back. If two concurrent edit requests arrive for the same lead, both could read the same `edit_round` value. Classic TOCTOU race. With SQLite and a single-user dashboard this is unlikely, but `better-sqlite3` does not hold a lock between the read and write.
**Suggestion:** Use `runTransaction` (already exported from `leads.ts`) to wrap the read + write atomically.

---

### [P2] Approve endpoint: TOCTOU race between status check and status update
**File:** `src/api.ts:106-136`
**Issue:** The approve handler reads the lead at line 106, checks its status at line 112, then performs an async `sendSms` call (which can take seconds), and finally writes the status update at line 130. During the SMS flight, a second approve request would pass the status check and dispatch a second SMS.
**Suggestion:** Set status to a transitional value like `sending` before calling `sendSms`, or add `WHERE status = 'received'` to the UPDATE and check affected row count.

---

### [P2] No CHECK constraint on status column allows invalid status values
**File:** `src/leads.ts:30`
**Issue:** The `status` column is `TEXT NOT NULL DEFAULT 'received'` but has no `CHECK` constraint. The TypeScript type limits values at compile time, but at the database level any string can be written.
**Suggestion:** Add `CHECK(status IN ('received', 'sent', 'done', 'failed'))` to the CREATE TABLE statement.

---

### [P2] Column migration uses raw string concatenation in ALTER TABLE
**File:** `src/leads.ts:63-66`
**Issue:** The column migration loop builds SQL via template literal: `ALTER TABLE leads ADD COLUMN ${col} ${type}`. While column names are hardcoded today, this pattern is fragile if a future developer adds a migration entry from user input.
**Suggestion:** Add a regex validation check on column names before executing DDL.

---

### [P2] Authentication bypass when env vars are unset
**File:** `src/auth.ts:8-11`
**Issue:** When `DASHBOARD_USER` or `DASHBOARD_PASS` are not set, the `basicAuth` middleware calls `next()` and grants full access. If deployed to production without these env vars, all API endpoints are unprotected.
**Suggestion:** Require these vars in production (check `NODE_ENV` or `RAILWAY_ENVIRONMENT`) and exit with a fatal error if missing.

---

### [P2] The /api/analyze endpoint has no authentication
**File:** `src/server.ts:51`
**Issue:** `POST /api/analyze` is defined directly on the Express app without `basicAuth` middleware. Anyone can trigger pipeline runs, consuming Anthropic API credits.
**Suggestion:** Add `basicAuth` middleware to the analyze endpoint.

---

### [P3] updateLead non-null assertion on return value
**File:** `src/api.ts:136, 165`
**Issue:** Both handlers use `updated!` (non-null assertion) when passing the result of `updateLead` to `shapeLead`. If the lead is deleted between the existence check and the update call, this would silently pass `null`.
**Suggestion:** Handle the `undefined` case explicitly with a 404 response.

---

### [P3] Client-side credential storage via window.prompt
**File:** `public/dashboard.html:936`
**Issue:** The dashboard prompts for credentials via `window.prompt()`, which shows the password in plain text (no masking).
**Suggestion:** Consider using a login form with `type="password"` input instead.

---

### [P3] getLeadStats month boundary uses string comparison on ISO dates
**File:** `src/leads.ts:268-276`
**Issue:** String comparison works correctly for ISO 8601 format but is fragile if a future code path writes dates in a different format.
**Suggestion:** Add a comment documenting the assumption, or use SQLite's `date()` function.
