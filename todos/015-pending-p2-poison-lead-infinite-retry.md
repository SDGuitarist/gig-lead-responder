---
status: done
priority: p2
issue_id: "015"
tags: [code-review, architecture, follow-up-pipeline]
dependencies: []
---

# No retry limit for poison leads in scheduler

## Problem Statement

If `generateFollowUpDraft()` consistently fails for a specific lead (corrupt `classification_json`, token limit exceeded, etc.), the lead stays `follow_up_status = 'pending'` and the scheduler retries it every 15 minutes indefinitely. This wastes Claude API credits, floods logs, and could push other due leads past the `LIMIT 10` window if enough poison leads accumulate.

## Findings

- **Source:** Architecture strategist (HIGH), Security sentinel (LOW), Performance oracle (related)
- **File:** `src/follow-up-scheduler.ts:53-56`
- **Evidence:** Catch block leaves lead as 'pending' with no retry counter or failure tracking

## Proposed Solutions

### Option A: In-memory failure counter (Recommended for V1)

```typescript
const failureCounts = new Map<number, number>();

// In the catch block:
const count = (failureCounts.get(lead.id) ?? 0) + 1;
failureCounts.set(lead.id, count);
if (count >= 3) {
  updateLead(lead.id, { follow_up_status: "skipped" });
  await sendSms(`Follow-up for Lead #${lead.id} failed ${count} times. Skipped.`);
  failureCounts.delete(lead.id);
}
```

- **Pros:** No schema change, simple, effective
- **Cons:** Counter resets on server restart (acceptable — rare leads with persistent failures will re-fail 3 more times then get skipped)
- **Effort:** Small (15 min)
- **Risk:** Low

### Option B: Add follow_up_retry_count column

- **Pros:** Survives restarts
- **Cons:** Schema change for edge case; over-engineering for V1
- **Effort:** Medium
- **Risk:** Low

## Recommended Action

Option A — in-memory Map.

## Technical Details

- **Affected files:** `src/follow-up-scheduler.ts` (add Map + counter logic in catch block)

## Acceptance Criteria

- [ ] After 3 consecutive failures, lead is set to `follow_up_status = 'skipped'`
- [ ] Alex receives an SMS notification about the failure
- [ ] Counter resets when lead succeeds or is skipped
- [ ] Other leads in the batch continue processing after a poison lead is skipped

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-26 | Created from code review | Architecture strategist + Security sentinel both flagged infinite retry risk |
