# Data Integrity Guardian — Review Findings

**Agent:** data-integrity-guardian
**Branch:** main
**Date:** 2026-02-20
**Files reviewed:** 5

## Findings

### [P2] Race condition between idempotency check and email insertion (TOCTOU)
**File:** `src/webhook.ts:103-110`
**Issue:** The idempotency check (`isEmailProcessed`) and the subsequent `markEmailProcessed` + `insertLead` calls are not wrapped in a single transaction. If two identical Mailgun webhook deliveries arrive at nearly the same time (Mailgun retries on slow responses, or duplicate POSTs from forwarding), the following interleaving is possible:

1. Request A calls `isEmailProcessed("msg-123")` — returns `false`
2. Request B calls `isEmailProcessed("msg-123")` — returns `false` (A hasn't written yet)
3. Request A calls `markEmailProcessed("msg-123")` — succeeds
4. Request A calls `insertLead(...)` — succeeds, lead #1
5. Request B calls `markEmailProcessed("msg-123")` — silently ignored (`INSERT OR IGNORE`)
6. Request B calls `insertLead(...)` — succeeds, lead #2 (duplicate!)

The `processed_emails` table uses `INSERT OR IGNORE`, which silently succeeds without raising an error. So Request B passes the dedup check and creates a second LeadRecord with the same data. The `mailgun_message_id UNIQUE` constraint on the `leads` table would catch this, but that throws an unhandled exception, crashing the request with a 500 error instead of a clean 200 "duplicate" response.

**Suggestion:** Wrap the check-then-insert in a transaction and use the `mailgun_message_id UNIQUE` constraint as the authoritative dedup gate. In `src/leads.ts`, add a `insertLeadIfNew` function that runs the check, mark, and insert inside a single `better-sqlite3` transaction:

```typescript
export function insertLeadIfNew(
  externalId: string,
  platform: string,
  input: InsertLeadInput,
): { duplicate: boolean; lead?: LeadRecord } {
  const txn = initDb().transaction(() => {
    if (isEmailProcessed(externalId)) {
      return { duplicate: true };
    }
    markEmailProcessed(externalId, platform);
    const lead = insertLead(input);
    return { duplicate: false, lead };
  });
  return txn();
}
```

This makes the read-then-write atomic. `better-sqlite3` transactions are serialized (SQLite's single-writer lock), so the TOCTOU window disappears entirely.

---

### [P2] No transaction boundary between pipeline write and status update in postPipeline
**File:** `src/post-pipeline.ts:18-51`
**Issue:** `postPipeline` performs three sequential steps: (1) write pipeline results to DB via `updateLead`, (2) send SMS via Twilio, and (3) update status to `"sent"` with a second `updateLead`. If step 2 succeeds but step 3 throws (for example, the database file is temporarily locked or the SQLite WAL checkpoint is running), the lead has pipeline data written and an SMS has been sent to the user, but the status remains `"received"`. This creates an inconsistent state: the user got the SMS and may reply YES, but the system thinks the lead is still in the `"received"` state. The Twilio reply handler (`resolveLead`) looks for leads with `status = "sent"`, so the user's YES reply will not find this lead.

**Suggestion:** Wrap steps 1 and 3 into a single transaction that sets status to `"sent"` atomically with the pipeline data write. Only commit after SMS succeeds. This way, either all DB state is consistent or none of it changes.

---

### [P2] SQL injection surface in updateLead via dynamic column names
**File:** `src/leads.ts:150-163`
**Issue:** The `updateLead` function builds a SQL `SET` clause dynamically from the keys of the `fields` object. The column names (`key`) are interpolated directly into the SQL string without sanitization. While the TypeScript type system restricts `fields` to `Partial<Omit<LeadRecord, "id" | "created_at">>` at compile time, this is erased at runtime. If any caller passes an object with a crafted key (for example from parsed JSON or an API payload), it could inject arbitrary SQL into the SET clause. In the current codebase, all callers pass hardcoded field names, so the practical risk is low.

**Suggestion:** Add a runtime whitelist of allowed column names:

```typescript
const ALLOWED_COLUMNS = new Set([
  "source_platform", "mailgun_message_id", "raw_email", "client_name",
  "event_date", "event_type", "venue", "guest_count", "budget_note",
  "status", "classification_json", "pricing_json", "full_draft",
  "compressed_draft", "gate_passed", "gate_json", "confidence_score",
  "error_message", "pipeline_completed_at", "sms_sent_at",
  "edit_round", "edit_instructions", "done_reason",
]);

for (const [key, value] of entries) {
  if (!ALLOWED_COLUMNS.has(key)) {
    throw new Error(`updateLead: invalid column name "${key}"`);
  }
  setClauses.push(`${key} = @${key}`);
}
```

---

### [P3] Webhook timestamp not validated for replay attacks
**File:** `src/webhook.ts:25-47`
**Issue:** The `verifyMailgunSignature` function validates the HMAC but does not check the `timestamp` field for freshness. Mailgun includes a Unix timestamp in the webhook payload, and their documentation recommends rejecting requests where the timestamp is more than a few minutes old. Without this check, a captured valid webhook payload can be replayed indefinitely. The `processed_emails` dedup table mitigates this for duplicate Message-Ids, but a replay of a different valid payload (one whose Message-Id was purged or not yet seen) would be accepted.

**Suggestion:** Add a timestamp freshness check (Mailgun recommends a 5-minute window):

```typescript
const ts = parseInt(timestamp, 10);
if (isNaN(ts) || Math.abs(Date.now() / 1000 - ts) > 300) {
  console.warn("Webhook timestamp too old or invalid");
  return false;
}
```

---

### [P3] external_id may collide across platforms
**File:** `src/webhook.ts:77`
**Issue:** The `processed_emails` table does not include `platform` in its dedup key — only `external_id`. GigSalad uses RFC Message-Id format while The Bash uses numeric Gig IDs (e.g., `"12345"`). While a collision between these formats is practically impossible today, the `processed_emails` table has no structural guarantee of cross-platform uniqueness. Two platforms with the same external_id string would collide, silently dropping a legitimate lead.

**Suggestion:** Make the `processed_emails` primary key a composite of `(platform, external_id)`:

```sql
CREATE TABLE IF NOT EXISTS processed_emails (
  platform TEXT NOT NULL,
  external_id TEXT NOT NULL,
  received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (platform, external_id)
);
```

---

### [P3] DISABLE_MAILGUN_VALIDATION is a data-safety risk if left enabled
**File:** `src/webhook.ts:63-64`
**Issue:** The `DISABLE_MAILGUN_VALIDATION` escape hatch disables HMAC signature verification entirely when set to `"true"`. With validation disabled, any HTTP client can POST to `/webhook/mailgun` with fabricated payloads, creating fake leads in the database and triggering the pipeline (which consumes Claude API credits and sends SMS messages). The code logs a warning, but there is no time-based auto-revert or periodic reminder.

**Suggestion:** Already well-documented. Consider adding a startup-time warning in `src/server.ts` that prints once when the server boots with either `DISABLE_` flag enabled.

---

## Summary

| Severity | Count | Key Theme |
|----------|-------|-----------|
| P1 | 0 | — |
| P2 | 3 | Race condition in dedup, non-atomic multi-step DB writes, dynamic SQL column names |
| P3 | 3 | Timestamp replay, cross-platform ID collision, validation escape hatch |
