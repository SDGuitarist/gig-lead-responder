---
status: pending
priority: p2
issue_id: "042"
tags: [code-review, architecture, data-integrity, analytics]
dependencies: []
unblocks: []
sub_priority: 2
---

# 042: setLeadOutcome + skipFollowUp coupling enforced by JSDoc only

## Problem Statement

When `setLeadOutcome()` records an outcome (`!== null`), the caller must also call `skipFollowUp(id)` to freeze the follow-up pipeline. This contract is documented with a JSDoc comment on `setLeadOutcome` (added in this branch) but not enforced by code. There are already 2+ callers (`src/api.ts`, `src/twilio-webhook.ts`). If a future caller (e.g., PF-Intel integration, CLI tool) calls `setLeadOutcome` without `skipFollowUp`, follow-up count silently increments after outcome recording, corrupting follow-up effectiveness analytics.

This violates the project's own "atomic claim" pattern from `docs/solutions/architecture/atomic-claim-for-concurrent-state-transitions.md`.

**Found by:** TypeScript Reviewer, Architecture Strategist, Learnings Researcher (3 agents independently)

## Findings

- JSDoc added at `src/db/leads.ts:205-211` documents the contract
- `skipFollowUp` call at `src/api.ts:219-221` implements it correctly
- Architecture reviewer: "This is a real architectural smell -- implicit contract enforced by comments"
- Learnings researcher: Follow-up lifecycle doc confirms follow-up status is a separate state machine
- Circular dependency concern (leads.ts importing from follow-ups.ts) was the original reason for keeping them separate

## Proposed Solutions

### Option A: Internalize skipFollowUp into setLeadOutcome (Recommended)
Import `skipFollowUp` from `./follow-ups.js` into `leads.ts` and call it at the end of `setLeadOutcome` when `outcome !== null`. Remove caller-side `skipFollowUp` calls.
- **Pros:** Self-enforcing, eliminates implicit contract, one place to maintain
- **Cons:** Creates import from leads.ts -> follow-ups.ts (check for circular dep)
- **Effort:** Medium (touch 3 files: leads.ts, api.ts, twilio-webhook.ts)
- **Risk:** Low -- verify no circular dependency (follow-ups.ts imports from leads.ts?)

### Option B: Create recordOutcome() wrapper function
New function in a shared module that calls both `setLeadOutcome` + `skipFollowUp` atomically.
- **Pros:** No circular dependency risk, explicit
- **Cons:** New function, callers must be updated, old function still accessible
- **Effort:** Medium
- **Risk:** Low

### Option C: Keep as-is with JSDoc (defer)
Accept the JSDoc-enforced contract for now. Only 2 callers exist.
- **Pros:** No code change
- **Cons:** Silent corruption risk on any new caller
- **Effort:** None
- **Risk:** Medium (PF-Intel integration is planned)

## Recommended Action

Option A if no circular dependency exists, otherwise Option B.

## Technical Details

- **Files:** `src/db/leads.ts` (setLeadOutcome), `src/api.ts` (caller), `src/twilio-webhook.ts` (caller)
- **Check first:** Does `follow-ups.ts` import from `leads.ts`? If yes, Option A creates a circular dep.

## Acceptance Criteria

- [ ] `skipFollowUp` called automatically when outcome is set (not cleared)
- [ ] No caller needs to remember the contract
- [ ] No circular dependency introduced
- [ ] Existing behavior unchanged (outcome=null does NOT trigger skipFollowUp)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-05 | Created from review | Three independent agents flagged this -- high confidence finding |
