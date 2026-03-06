---
status: pending
priority: p2
issue_id: "058"
tags: [code-review, architecture, data-integrity]
dependencies: []
unblocks: ["query-6-cleanup"]
sub_priority: 1
---

# 058: Move event_type normalization from webhook to insertLead()

## Problem Statement

PR #10 commit #051 normalizes `event_type` at write time in `webhook.ts` line 127:

```typescript
event_type: lead.event_type?.trim().toLowerCase() ?? null,
```

This only covers the webhook write path. The `insertLead()` function in `leads.ts` passes `event_type` through without normalization. Any future write path (import script, manual DB entry, Analyze tab) would store unnormalized data.

Meanwhile, Query 6 in `queries.ts` lines 178-185 still applies `LOWER(TRIM(event_type))` at read time — this is currently acting as defense-in-depth for legacy data AND for the incomplete write-time normalization.

**Found by:** Architecture Strategist (P2), Learnings Researcher (flagged as constants-at-the-boundary violation — downgraded because event types are external strings, not app-defined enums), Agent-Native Reviewer (observation)

## Proposed Solutions

### Option A: Move normalization to insertLead() (Recommended)

Push `trim().toLowerCase()` into `insertLead()` in `src/db/leads.ts` so ALL callers get normalization.

```typescript
// In insertLead(), before the INSERT:
const normalizedEventType = input.event_type?.trim().toLowerCase() ?? null;
```

Then remove the normalization from `webhook.ts` line 127 (revert to `lead.event_type ?? null`).

- **Effort:** Small (move 1 line, adjust 1 line)
- **Risk:** Low — single source of normalization
- **Pros:** Covers all write paths, single responsibility
- **Cons:** None significant

### Option B: Keep both write-time and read-time normalization

Leave webhook.ts as-is, keep Query 6's `LOWER(TRIM())`. Add a comment to Query 6 explaining it's defense-in-depth for legacy data.

- **Effort:** Trivial (add comment)
- **Risk:** Low — but leaves the architectural gap
- **Pros:** No behavior change
- **Cons:** Two normalization layers, misleading code story

## Technical Details

- **Affected files:** `src/webhook.ts` (line 127), `src/db/leads.ts` (`insertLead()`), `src/db/queries.ts` (lines 178-185)
- **Related:** Query 6 LOWER(TRIM()) can be removed AFTER normalization is in insertLead() AND legacy data is cleaned up

## Acceptance Criteria

- [ ] `insertLead()` normalizes event_type (trim + lowercase) for all callers
- [ ] webhook.ts no longer applies its own normalization (delegates to insertLead)
- [ ] Query 6 retains LOWER(TRIM()) for legacy data with an explanatory comment
- [ ] TypeScript compiles clean
