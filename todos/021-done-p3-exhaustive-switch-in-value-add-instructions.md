---
status: done
priority: p3
issue_id: "021"
tags: [code-review, type-safety, follow-up-pipeline]
dependencies: []
---

# Add exhaustive check to getValueAddInstructions switch

## Problem Statement

`getValueAddInstructions()` has no `default` case. If a fourth value-add type is added to `VALUE_ADD_TYPES`, the function would return `undefined` at runtime with no compiler error.

## Findings

- **Source:** TypeScript reviewer (LOW)
- **File:** `src/prompts/follow-up.ts:63-77`

## Proposed Solutions

### Option A: Add exhaustive default case

```typescript
default: {
  const _exhaustive: never = type;
  return _exhaustive;
}
```

- **Effort:** Small (2 min)

## Acceptance Criteria

- [ ] `default` case with `never` type assertion added
- [ ] Adding a new VALUE_ADD_TYPE without a switch case causes a compile error

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-26 | Created from code review | |
