---
status: pending
priority: p1
issue_id: "001"
tags: [code-review, typescript, security]
dependencies: []
unblocks: ["003"]
sub_priority: 1
---

# Unsafe `as T` cast in `callClaude<T>`

## Problem

`callClaude<T>` in `src/claude.ts` casts the LLM response with `as T` — no runtime validation. If Claude returns the wrong shape, it silently propagates through the entire pipeline. Flagged by TypeScript reviewer, Architecture reviewer, and Learnings researcher.

## Location

- `src/claude.ts` lines 49 and 59

## Fix

Add a validator function parameter to `callClaude<T>` or use Zod schemas. The classify stage has partial field checks (`classify.ts` lines 16-27) but generate and verify do zero validation.
