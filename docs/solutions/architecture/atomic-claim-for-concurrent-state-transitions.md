---
title: "Atomic Claim for Concurrent State Transitions"
category: architecture
tags: [race-condition, concurrency, sqlite, state-machine, atomic, sms]
module: leads
symptoms:
  - Double SMS sent from concurrent approve requests
  - Race condition between status check and status update
  - Frontend button disable does not prevent server-side duplicate
  - Two requests both pass the status guard and execute the side effect
date_documented: 2026-02-22
---

# Atomic Claim for Concurrent State Transitions

## Problem

The approve endpoint read a lead's status, checked it was `"received"` or
`"sent"`, then sent an SMS and updated the status to `"done"`. Two concurrent
requests could both read the same status, both pass the check, and both send
the SMS — a classic TOCTOU (time-of-check-to-time-of-use) race. The frontend
disabled the button after click, but that's a UI convenience, not a server-side
guarantee.

## Root Cause

The approve flow was a three-step read-check-write sequence:

```ts
// BROKEN: read-check-write (race window between step 1 and step 3)
const lead = getLead(id);                           // 1. read
if (lead.status !== "received" && lead.status !== "sent") return 409;  // 2. check
await sendSms(lead.compressed_draft);               // 3. act (side effect!)
updateLead(id, { status: "done" });                 // 4. write
```

Between steps 1 and 4, another request can enter the same flow and pass the
same check. The side effect (SMS) happens before the write, so both requests
send the message.

## Solution

Replace the read-check-write with an **atomic claim** — a single SQL `UPDATE`
with a `WHERE` clause that acts as both the check and the write in one
operation:

```ts
// src/leads.ts
export function claimLeadForSending(id: number): boolean {
  const result = initDb()
    .prepare(
      "UPDATE leads SET status = 'sending', updated_at = @updated_at WHERE id = @id AND status IN ('received', 'sent')",
    )
    .run({ id, updated_at: new Date().toISOString() });
  return result.changes > 0;
}
```

The caller checks `result.changes > 0` — if another request already claimed the
lead (changed status to `"sending"`), this one gets `changes === 0` and returns
409 without sending the SMS:

```ts
// src/api.ts — approve handler
if (!claimLeadForSending(id)) {
  res.status(409).json({ error: "Lead is already being sent or is no longer approvable" });
  return;
}

try {
  await sendSms(lead.compressed_draft);
} catch (err) {
  // Revert to previous status on SMS failure
  updateLead(id, { status: lead.status });
  ...
}
```

### Key design decisions

1. **Dedicated function, not a parameter on `updateLead`** — The atomic
   `WHERE status IN (...)` guard is specific to the approve flow. Bolting a
   conditional `WHERE` onto the generic update function would complicate every
   other caller for one use case.

2. **Transitional `"sending"` status** — Added to `LeadStatus` union type. The
   dashboard displays a "Sending" badge and disables the approve button while
   a lead is in this state. If SMS fails, status reverts to whatever it was
   before the claim.

3. **Revert on failure uses `lead.status`** (the value read before claiming) —
   correct even if the previous status was `"sent"` from a prior webhook flow.

## What Was Rejected

- **Mutex/lock file** — Over-engineering for SQLite (single-writer already).
  The `WHERE` clause is the lock.
- **Idempotency key on the request** — Would require client-side key generation
  and a dedup table. The atomic claim is simpler and covers all clients
  (dashboard, future API consumers) without coordination.
- **Modifying generic `updateLead` with a `WHERE` clause parameter** — Breaks
  the clean separation between "update fields" and "guard state transitions."
  Every other caller would need to think about a parameter they don't use.

## Prevention

- **Any time a status check guards a side effect (email, SMS, API call),
  the check and the status change must be atomic.** If you can't do both in
  one SQL statement, wrap them in a transaction with a `SELECT ... FOR UPDATE`
  (or use SQLite's single-writer guarantee with a conditional `UPDATE`).
- **Name the pattern explicitly.** `claimLeadForSending` communicates intent
  better than `updateLeadIfStatus`. The function name should describe the
  business operation, not the SQL mechanics.
- **Transitional statuses make races visible.** A `"sending"` status in the UI
  shows when a claim is in-flight, making concurrent attempts obvious instead
  of silently conflicting.

## Related

- `docs/solutions/database-issues/async-sqlite-transaction-boundary.md` — related atomic transaction pattern for webhook dedup
