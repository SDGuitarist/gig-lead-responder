---
status: done
priority: p3
issue_id: "007"
tags: [code-review, security, enhancement]
dependencies: []
---

# POST /api/leads/:id/edit has no rate limiter or edit-round cap

## Problem Statement

The edit endpoint accepts user-edited drafts and writes to the database. While it doesn't call external APIs (no cost), a runaway script could flood the DB with writes and increment `edit_round` without bound. The `MAX_EDIT_ROUNDS` constant in `twilio-webhook.ts` only applies to the SMS editing flow, not the dashboard.

## Findings

- **Source:** security-sentinel (Medium — but out of scope for this PR)
- **File:** `src/api.ts:164`
- **Note:** Plan explicitly scoped this out — edit endpoint has no external API cost

## Proposed Solutions

### Option A: Add edit-round cap in endpoint
```typescript
if (lead.edit_round >= 10) {
  res.status(400).json({ error: "Maximum edit rounds reached" });
  return;
}
```

### Option B: Apply approveLimiter (or dedicated limiter)
Same middleware pattern as analyze/approve routes.

- **Effort:** Small
- **Risk:** Low

## Technical Details

- **Affected files:** `src/api.ts`

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-26 | Created from code review of cb7e3f3 | Security sentinel caught a gap in the threat model — edit endpoint has no external cost but has no abuse guard |
