---
status: done
priority: p2
issue_id: "012"
tags: [code-review, architecture, type-safety, follow-up-pipeline]
dependencies: []
---

# Raw SQL in webhook handlers bypasses normalizeRow() and breaks data layer

## Problem Statement

`handleFollowUpSend()` and `handleFollowUpSkip()` in `twilio-webhook.ts` import `initDb()` directly and run raw SQL queries, bypassing the data-access layer in `leads.ts`. Every other query in the codebase goes through helper functions that call `normalizeRow()`, which converts SQLite's `0/1` for `gate_passed` back to `boolean`. These two handlers skip normalization, so `gate_passed` is `0 | 1 | null` at runtime while the `LeadRecord` type declares it as `boolean | null`.

Not a runtime bug today (the handlers don't read `gate_passed`), but a type lie that will silently break if anyone adds logging or serialization that touches `gate_passed` on these lead objects.

## Findings

- **Source:** TypeScript reviewer (CRITICAL), Architecture strategist (MEDIUM), Simplicity reviewer (observation)
- **File:** `src/twilio-webhook.ts:169-171` (SEND handler), `src/twilio-webhook.ts:208-210` (SKIP handler)
- **Evidence:** Both handlers call `initDb().prepare("SELECT * FROM leads WHERE ...").get() as LeadRecord | undefined` — raw SQL with no `normalizeRow()`.
- **Pattern violation:** Every other module accesses the database through `leads.ts` helpers. This is the only file (besides `leads.ts` itself) that imports `initDb()`.

## Proposed Solutions

### Option A: Add query helpers to leads.ts (Recommended)

Add two helpers that return properly normalized `LeadRecord` objects:

```typescript
export function getLeadAwaitingFollowUpApproval(): LeadRecord | undefined {
  const row = initDb()
    .prepare("SELECT * FROM leads WHERE follow_up_status = 'sent' ORDER BY updated_at DESC LIMIT 1")
    .get() as LeadRecord | undefined;
  return row ? normalizeRow(row) : undefined;
}

export function getLeadWithActiveFollowUp(): LeadRecord | undefined {
  const row = initDb()
    .prepare("SELECT * FROM leads WHERE follow_up_status IN ('pending', 'sent') ORDER BY updated_at DESC LIMIT 1")
    .get() as LeadRecord | undefined;
  return row ? normalizeRow(row) : undefined;
}
```

Then remove `initDb` import from `twilio-webhook.ts`.

- **Pros:** Restores data layer encapsulation, normalizeRow() applied, reusable by future API endpoints
- **Cons:** Two more exported functions in leads.ts
- **Effort:** Small (15 min)
- **Risk:** Low

### Option B: Call normalizeRow() inline in webhook

Import `normalizeRow` from leads.ts and call it on the raw query result.

- **Pros:** Minimal change
- **Cons:** Still breaks the layering pattern (initDb in webhook), normalizeRow would need to be exported
- **Effort:** Small (5 min)
- **Risk:** Low but doesn't fix the architectural issue

## Recommended Action

Option A — extract query helpers to leads.ts.

## Technical Details

- **Affected files:** `src/twilio-webhook.ts` (remove initDb import, use new helpers), `src/leads.ts` (add 2 helpers)
- **Components:** Data access layer, Twilio webhook

## Acceptance Criteria

- [ ] `initDb` is NOT imported in `twilio-webhook.ts`
- [ ] SEND handler uses `getLeadAwaitingFollowUpApproval()` from leads.ts
- [ ] SKIP handler uses `getLeadWithActiveFollowUp()` from leads.ts
- [ ] Both helpers call `normalizeRow()` on the result
- [ ] `tsc --noEmit` passes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-26 | Created from code review | TypeScript reviewer flagged as critical type safety issue; Architecture strategist flagged as layering violation |
