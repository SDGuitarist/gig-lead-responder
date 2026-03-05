---
status: pending
priority: p3
issue_id: "036"
tags: [code-review, cleanup, simplicity]
dependencies: []
unblocks: []
sub_priority: 2
---

# 036: Dead code cleanup -- venues.ts, spent migrations, duplicated helpers

## Problem Statement

~130 LOC of dead or redundant code identified across the codebase. Removing it reduces cognitive load and startup time.

**Found by:** Code Simplicity Reviewer + Architecture Strategist

## Findings

- `src/data/venues.ts` (83 LOC) -- entirely dead, zero importers. Replaced by PF-Intel API in `venue-lookup.ts`
- `src/leads.ts:87-146` -- table rebuild migration (60 lines), already ran on all existing DBs, fresh DBs get correct schema from CREATE TABLE
- `src/leads.ts:69-73` -- migration entries for outcome/actual_price columns, permanently no-op after rebuild
- `src/leads.ts:416-420` -- `TERMINAL_CLEAR` constant used only once, while skipFollowUp and markClientReplied write same fields inline
- Duplicated `baseUrl()` helper in `follow-up-scheduler.ts:13` and `twilio-webhook.ts:26`
- `req.params.id as string` unnecessary cast (5 occurrences)

## Proposed Solutions

### Solution A: Delete dead code, extract shared helpers
**Effort:** Small | **Risk:** Low
1. Delete `src/data/venues.ts`
2. Remove spent migration entries (keep the ADD COLUMN mechanism)
3. Extract `baseUrl()` to `src/utils/env.ts` or `constants.ts`
4. Make TERMINAL_CLEAR consistent or inline it

## Acceptance Criteria

- [ ] `src/data/venues.ts` deleted
- [ ] Spent migration code removed
- [ ] `baseUrl()` lives in one place
- [ ] All tests pass, no import errors

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-05 | Created from final verification review | ~130 LOC removable |
