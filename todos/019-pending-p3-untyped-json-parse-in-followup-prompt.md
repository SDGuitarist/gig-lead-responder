---
status: done
priority: p3
issue_id: "019"
tags: [code-review, type-safety, follow-up-pipeline]
dependencies: []
---

# Untyped JSON.parse in follow-up prompt builder

## Problem Statement

`buildFollowUpPrompt()` parses `classification_json` with `JSON.parse()` returning `any`. The `Classification` type exists in `types.ts` and should be used.

## Findings

- **Source:** TypeScript reviewer (MEDIUM)
- **File:** `src/prompts/follow-up.ts:25`
- **Evidence:** `const c = JSON.parse(lead.classification_json)` — result is `any`

## Proposed Solutions

### Option A: Cast to Classification type

```typescript
import type { Classification } from "../types.js";
const c = JSON.parse(lead.classification_json) as Classification;
```

- **Effort:** Small (2 min)

## Acceptance Criteria

- [ ] `JSON.parse` result typed as `Classification`
- [ ] `tsc --noEmit` passes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-26 | Created from code review | |
