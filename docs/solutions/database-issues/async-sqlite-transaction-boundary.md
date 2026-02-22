# Async Work Inside SQLite Transactions

**Category:** Data integrity
**Tags:** sqlite, async, transactions, better-sqlite3

## Problem

You need to send an SMS and update a database row atomically — either both
happen or neither does. The natural instinct is to wrap both in a transaction.
But `better-sqlite3` is synchronous, and SMS is async. You can't `await` inside
a `db.transaction()` callback.

## What Was Tried

1. **Wrapping async SMS in a better-sqlite3 transaction** — Doesn't compile.
   `db.transaction()` expects a synchronous function. Even if you force it,
   the transaction commits before the `await` resolves.
2. **Using an async SQLite library** — Adds complexity and loses better-sqlite3's
   WAL mode performance and synchronous transaction guarantees.

## What Worked

Do the async work first, then do all DB writes in one call:

```ts
async function postPipeline(leadId: number, output: PipelineOutput) {
  // 1. Async work FIRST (outside any transaction)
  await sendSms(compressedDraft);

  // 2. ALL DB writes in one synchronous updateLead call
  updateLead(leadId, {
    classification_json: JSON.stringify(output.classification),
    full_draft: output.drafts.full_draft,
    compressed_draft: output.drafts.compressed_draft,
    status: "sent",
    sms_sent_at: new Date().toISOString(),
    // ... all 10 fields at once
  });
}
```

**Why this works:** A single `UPDATE ... SET col1=?, col2=?, ...` statement is
inherently atomic in SQLite. No transaction wrapper needed. If SMS fails, the
function throws before the UPDATE runs — the lead stays in `received` status.

**Failure modes:**
- SMS fails → no DB write → lead stays `received` → stuck-lead sweep catches it
- SMS succeeds, DB fails → SMS sent but lead not marked → stuck-lead sweep
  re-processes it (idempotent because dedup catches the re-send attempt)
- Both succeed → happy path

## Reusable Pattern

When mixing async I/O with synchronous-only DB libraries:

1. Do all async/external calls first (HTTP, SMS, email)
2. Collect results in memory
3. Write everything to the DB in a single statement or synchronous transaction
4. A single SQL UPDATE is atomic — you don't need `BEGIN/COMMIT` for one statement
5. Design your failure recovery around the gap between steps 1 and 3
   (the async call succeeded but the DB write hasn't happened yet)
