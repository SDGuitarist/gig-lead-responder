---
status: done
priority: p2
issue_id: "032"
tags: [code-review, architecture, api]
dependencies: []
unblocks: []
sub_priority: 7
---

# 032: Inconsistent response envelopes between api.ts and follow-up-api.ts

## Problem Statement

Main API returns shaped leads directly (`res.json(shapeLead(updated))`). Follow-up API wraps in `{ success: true, lead: shaped }`. Dashboard must handle both shapes. Agents (future) must know which envelope to expect per endpoint.

**Found by:** Architecture Strategist + Agent-Native Reviewer

## Findings

- `src/api.ts:169,213,288` -- bare `shapeLead(lead)` response
- `src/follow-up-api.ts:30,81` -- `{ success: true, lead: shaped }` wrapper

## Proposed Solutions

### Solution A: Standardize on bare lead object (Recommended)
**Effort:** Small | **Risk:** Low (update dashboard fetch handlers for follow-up endpoints)

## Acceptance Criteria

- [ ] All mutation endpoints return the same envelope shape
- [ ] Dashboard handles the unified shape correctly

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-05 | Created from final verification review | Two API modules, two envelope shapes |
