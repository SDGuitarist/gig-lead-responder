---
status: done
priority: p2
issue_id: "063"
tags: [code-review, data-integrity, migration, leads]
dependencies: []
unblocks: []
sub_priority: 2
---

# 063 — Add event_type normalization to updateLead

## Problem Statement

`updateLead()` in `src/db/leads.ts` accepts `event_type` in its allowed columns
(line 119) but does NOT apply `trim().toLowerCase()` normalization. If any code
path calls `updateLead(id, { event_type: "Wedding" })`, it writes un-normalized
data — re-introducing the exact problem that the event_type migration (commit
f65d371) fixes.

No code currently calls `updateLead` with `event_type`, so this is a structural
gap, not a current bug.

## Findings

- **Data Migration Expert (P2):** "This is the kind of latent gap that causes
  exactly the bug this migration is fixing to recur six months from now."
- **Architecture Strategist (P3):** Noted the inconsistent `??` vs `||` pattern
  across insertLead fields as related context.

## Proposed Solutions

### Option A: Normalize in updateLead (Recommended)

Add normalization after building the params object:

```typescript
// In updateLead, after building params:
if ('event_type' in params && params.event_type != null) {
  params.event_type = String(params.event_type).trim().toLowerCase() || null;
}
```

- **Effort:** Small (~3 lines)
- **Risk:** Very low — no current callers pass event_type
- **Pros:** Closes the structural gap, matches insertLead behavior
- **Cons:** None significant

### Option B: Remove event_type from allowed columns

Remove `event_type` from `updateLead`'s allowed columns list so it can only be
set via `insertLead`.

- **Effort:** Small (1 line)
- **Risk:** Low — but prevents future legitimate updates
- **Pros:** Eliminates the gap entirely
- **Cons:** Too restrictive — event_type updates may be needed eventually

## Recommended Action

Option A. Add normalization.

## Technical Details

- **File:** `src/db/leads.ts`, around line 129-164
- **Components:** updateLead function
- **Related:** insertLead (line 90) already normalizes with `|| null`

## Acceptance Criteria

- [ ] `updateLead(id, { event_type: "  Wedding  " })` stores `"wedding"`
- [ ] `updateLead(id, { event_type: "  " })` stores `NULL`
- [ ] Existing updateLead behavior unchanged for all other fields

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-08 | Created from P3 bundle 061 review | Data Migration Expert flagged structural gap |

## Resources

- Review: `docs/reviews/p3-bundle-061/REVIEW-SUMMARY.md`
- Plan: `docs/plans/2026-03-08-fix-p3-bundle-061-plan.md`
- Past solution: `docs/solutions/logic-errors/2026-03-06-dashboard-defensive-patterns-normalization-and-loop-guards.md`
