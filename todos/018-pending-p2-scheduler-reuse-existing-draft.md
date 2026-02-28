---
status: done
priority: p2
issue_id: "018"
tags: [code-review, performance, follow-up-pipeline]
dependencies: []
---

# Scheduler should reuse existing draft on retry

## Problem Statement

If SMS sending fails after the draft is stored (step 2 succeeds, step 3 fails), the lead stays `pending` with a draft in `follow_up_draft`. On the next scheduler cycle, `generateFollowUpDraft()` is called again, overwriting the stored draft with a new Claude API call. This wastes API credits and produces a different draft than the one that was stored.

Additionally, if the server crashes between SMS send (step 3) and status update (step 4), Alex receives the SMS but the lead stays `pending`. Next cycle generates a NEW draft and sends a SECOND SMS — duplicate follow-up requests.

## Findings

- **Source:** Performance oracle (Priority 1 recommendation), Architecture strategist (CRITICAL), TypeScript reviewer (HIGH)
- **File:** `src/follow-up-scheduler.ts:42-57`
- **Evidence:** Steps 2 and 4 are separate `updateLead()` calls with async SMS in between. No check for existing draft.

## Proposed Solutions

### Option A: Check for existing draft before regenerating (Recommended)

```typescript
const draft = lead.follow_up_draft ?? await generateFollowUpDraft(lead);
updateLead(lead.id, { follow_up_draft: draft });
await sendSms(formatFollowUpSms(lead, draft));
updateLead(lead.id, { follow_up_status: "sent" });
```

- **Pros:** Saves API dollars on retry, prevents draft overwrite, simple null check
- **Cons:** Draft from a previous attempt may be stale if lead data changed (unlikely — lead data is immutable after initial processing)
- **Effort:** Small (5 min)
- **Risk:** None

### Option B: Combine draft storage + status update atomically

```typescript
const draft = await generateFollowUpDraft(lead);
runTransaction(() => {
  updateLead(lead.id, { follow_up_draft: draft, follow_up_status: "sent" });
});
await sendSms(formatFollowUpSms(lead, draft));
```

- **Pros:** Eliminates the window between draft-store and status-update entirely
- **Cons:** If SMS fails, lead is already "sent" — Alex never sees it. Leads to stuck "sent" leads.
- **Effort:** Small
- **Risk:** Medium — creates a different failure mode (silent undelivered drafts)

## Recommended Action

Option A — simple, safe, saves money.

## Technical Details

- **Affected files:** `src/follow-up-scheduler.ts:45` (add null check before generateFollowUpDraft)

## Acceptance Criteria

- [ ] If `lead.follow_up_draft` is already populated, skip `generateFollowUpDraft()` and use existing draft
- [ ] If `lead.follow_up_draft` is null, generate new draft as before
- [ ] Draft is still stored in DB (updateLead) before SMS send
- [ ] API credit savings confirmed by checking that retry doesn't call Claude

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-26 | Created from code review | Performance oracle: "saves real API dollars on retries — extremely low complexity, high value" |
