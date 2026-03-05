---
status: pending
priority: p2
issue_id: "028"
tags: [code-review, security, llm-pipeline, type-safety]
dependencies: []
unblocks: []
sub_priority: 3
---

# 028: Shallow LLM output type validation -- `as T` cast with no runtime checks

## Problem Statement

`callClaude<T>()` in `claude.ts:49` parses JSON and casts with `as T` -- a compile-time assertion with zero runtime validation. LLM output is an untrusted boundary. Invalid values flow through unchecked: an unexpected `competition_level` produces `undefined` in the pricing switch, `gate_status` controls the retry loop, and `shapeLead` in `api.ts` uses `as string`/`as number` casts on JSON from the DB.

**Found by:** LLM Pipeline Security Agent + TypeScript Reviewer

## Findings

- `src/claude.ts:49` -- `return JSON.parse(cleaned) as T`
- `src/pipeline/classify.ts:16-42` -- validates 4 fields but not `competition_level`, `stated_budget` type, etc.
- `src/pipeline/price.ts:49-66` -- switch on `competition_level` has no default (undefined `quote_price`)
- `src/api.ts:59-71` -- `as string`, `as number`, `as string[]` casts on JSON.parse output in shapeLead

## Proposed Solutions

### Solution A: Add Zod schemas at callClaude boundary (Recommended)
**Effort:** Medium | **Risk:** Low
Define Zod schemas for Classification, GenerateResponse, GateResult. Validate at the JSON.parse boundary.

### Solution B: Lightweight manual validators
**Effort:** Small | **Risk:** Low
Add runtime type checks for branching-critical fields only (competition_level, gate_status, format_recommended). Add default case to price.ts switch.

## Acceptance Criteria

- [ ] LLM output validated at parse boundary (at minimum: branching-critical fields)
- [ ] price.ts switch has default case
- [ ] shapeLead uses runtime type checks instead of `as` casts
- [ ] Invalid LLM output produces graceful error, not silent wrong behavior

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-05 | Created from final verification review | as T at untrusted boundary = silent type confusion |
