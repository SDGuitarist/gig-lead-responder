---
status: pending
priority: p3
issue_id: "039"
tags: [code-review, performance]
dependencies: []
unblocks: []
sub_priority: 5
---

# 039: Performance future-proofing -- pagination, SELECT *, analytics, scheduler

## Problem Statement

Performance patterns that work at current scale (single-digit leads/day, <100 rows) but would degrade at 10x: (1) no pagination on list endpoints, (2) SELECT * fetches large blobs on list/scheduler paths, (3) analytics queries scan entire table with json_extract, (4) sequential follow-up processing in scheduler.

**Found by:** Performance Oracle + Architecture Strategist + Agent-Native Reviewer

## Findings

- `src/leads.ts:578-621` -- `listLeadsFiltered`, `listFollowUpLeads` return all rows, no LIMIT
- `src/leads.ts:252,261,385,394,579,612` -- SELECT * fetches raw_email, full_draft, classification_json on list queries
- `src/leads.ts:664-738` -- analytics runs 3 queries with json_extract on all done leads
- `src/follow-up-scheduler.ts:43-77` -- sequential for...of loop, one lead at a time

## Proposed Solutions

### Solution A: Add pagination + lite queries
1. Add `?limit=50&offset=0` to list endpoints
2. Create `listLeadsLite` selecting only display columns
3. Add date windowing to analytics queries
4. Use `Promise.allSettled` with concurrency limit in scheduler

**Effort:** Medium | **Risk:** Low

## Acceptance Criteria

- [ ] List endpoints support pagination
- [ ] List queries don't fetch blob columns
- [ ] Analytics queries bounded by date window
- [ ] Scheduler supports concurrent processing

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-05 | Created from final verification review | Fine at current scale, problem at 10x |
