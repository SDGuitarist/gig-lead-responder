---
status: done
priority: p2
issue_id: "016"
tags: [code-review, quality, follow-up-pipeline]
dependencies: []
---

# Magic number 3 scattered across files

## Problem Statement

The maximum follow-up count (3) appears as a literal `3` in `handleFollowUpSend()` and is implied by the length of `FOLLOW_UP_DELAYS_MS` in `leads.ts`. If someone changes one without the other, the state machine breaks silently.

## Findings

- **Source:** TypeScript reviewer (MEDIUM)
- **File:** `src/twilio-webhook.ts:180` (`newCount >= 3`), `src/leads.ts:262-266` (array length implies 3)

## Proposed Solutions

### Option A: Extract MAX_FOLLOW_UPS constant (Recommended)

```typescript
// In leads.ts
export const MAX_FOLLOW_UPS = FOLLOW_UP_DELAYS_MS.length; // 3
```

Then in twilio-webhook.ts: `if (newCount >= MAX_FOLLOW_UPS) { ... }`

- **Pros:** Single source of truth, self-documenting
- **Cons:** None
- **Effort:** Small (5 min)
- **Risk:** None

## Recommended Action

Option A.

## Technical Details

- **Affected files:** `src/leads.ts` (add export), `src/twilio-webhook.ts` (import + use)

## Acceptance Criteria

- [ ] `MAX_FOLLOW_UPS` exported from leads.ts, derived from FOLLOW_UP_DELAYS_MS.length
- [ ] `handleFollowUpSend()` uses `MAX_FOLLOW_UPS` instead of literal `3`
- [ ] `tsc --noEmit` passes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-26 | Created from code review | Pattern: constants-at-the-boundary from docs/solutions/ |
