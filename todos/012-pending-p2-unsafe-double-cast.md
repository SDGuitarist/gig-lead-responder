---
status: done
priority: p2
issue_id: "012"
tags: [code-review, type-safety]
dependencies: []
unblocks: []
sub_priority: 5
---

# 012: Unsafe double cast `null as unknown as string` in api.ts

## Problem Statement

`api.ts:205` uses `compressed_draft: null as unknown as string` — a double cast to assign `null` to a field typed as `string`. This is an `any`-equivalent escape hatch. Since `LeadRecord.compressed_draft` is already typed as `string | null`, the `Partial<Omit<LeadRecord, "id" | "created_at">>` type should already allow `null`. The cast is either unnecessary (remove it) or reveals a TypeScript config issue (verify `strictNullChecks`).

**Found by:** TypeScript Reviewer

## Proposed Solutions

### Option A: Remove the cast (Recommended)
Change to `compressed_draft: null`. If TypeScript complains, fix the type definition.
- Effort: Small
- Risk: None

## Technical Details

- **Affected files:** `src/api.ts`, possibly `src/types.ts`

## Acceptance Criteria

- [ ] No `as unknown as` casts in the codebase
- [ ] `compressed_draft: null` compiles without error

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-04 | Created from review cycle 2 | |
