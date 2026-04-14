---
status: done
priority: p2
issue_id: "033"
tags: [code-review, architecture]
dependencies: []
unblocks: []
sub_priority: 8
---

# 033: shapeLead cross-import -- follow-up-api.ts imports from peer api.ts

## Problem Statement

`follow-up-api.ts:4` imports `shapeLead` from `api.ts`. Two sibling API routers should not import from each other. `shapeLead` is a data transformation function that belongs in a shared location (e.g., `src/presenters.ts` or `types.ts`).

**Found by:** Architecture Strategist

## Findings

- `src/follow-up-api.ts:4` -- `import { shapeLead } from "./api.js"`
- `shapeLead` transforms `LeadRecord` to `LeadApiResponse` -- belongs with the types

## Proposed Solutions

### Solution A: Extract to src/presenters.ts (Recommended)
**Effort:** Small | **Risk:** Low

## Acceptance Criteria

- [ ] `shapeLead` lives in a shared module, not api.ts
- [ ] Both api.ts and follow-up-api.ts import from the shared module
- [ ] No peer-to-peer imports between API routers

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-05 | Created from final verification review | Peer imports set precedent for coupling creep |
