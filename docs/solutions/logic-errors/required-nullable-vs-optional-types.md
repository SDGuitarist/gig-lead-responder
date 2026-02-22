---
title: "Required-Nullable vs Optional for LLM Contracts"
category: logic-errors
tags: [typescript, types, llm, contracts, null]
module: types
symptoms:
  - TypeScript doesn't catch missing fields from LLM response
  - Ambiguity between "field absent" and "field is null"
  - Test fixtures missing required fields without compiler error
date_documented: 2026-02-21
---

# Required-Nullable vs Optional for LLM Contracts

## Problem

The `Classification` interface in `src/types.ts` used `?` (optional) combined
with `| null` on fields like `event_date_iso` and `event_energy`. This created
ambiguity: TypeScript couldn't distinguish between the LLM omitting a field
entirely (a bug) and the LLM explicitly returning `null` (correct behavior when
the value is unknown). Test fixtures could also omit these fields without any
compiler error, masking incomplete test data.

## Root Cause

TypeScript treats `field?: T | null` and `field: T | null` differently.
Optional (`?`) means the field can be missing from the object entirely —
`undefined` is implicitly added to the type. Required-nullable (no `?`, but
`| null`) means the field must exist on the object, but its value can be `null`.
When the LLM contract says "always return this field, set it to null if
unknown," only required-nullable enforces that contract at compile time.

## Solution

**Before** (optional-nullable — hides the contract):

```typescript
export interface Classification {
  event_date_iso?: string | null;
  event_energy?: "background" | "performance" | null;
}
```

**After** (required-nullable — enforces the contract):

```typescript
export interface Classification {
  event_date_iso: string | null;
  event_energy: "background" | "performance" | null;
}
```

Removing the `?` makes TypeScript error on any object literal or test fixture
that omits these fields. The LLM prompt already requires them, so the type now
matches the contract.

## When to Use Which

| Pattern | Syntax | Use when |
|---|---|---|
| **Required-nullable** | `field: T \| null` | The LLM (or API) always returns this field, but the value can be absent. This is the common case for structured LLM output. |
| **Optional** | `field?: T` | The field is genuinely sometimes not part of the response shape — different modes return different fields. |
| **Optional-nullable** | `field?: T \| null` | Almost never correct. If the field can be missing AND can be null, you probably have two different concepts collapsed into one field. |
| **Computed fields** | `field?: T` | The field is added by code after the LLM response (e.g., `past_date_detected` is computed in TypeScript, not returned by the LLM). Optional is correct here because the field doesn't exist until a later pipeline stage stamps it. |

In this codebase, `past_date_detected?: boolean` correctly uses `?` because
TypeScript computes it after classification — the LLM never returns it.
Meanwhile `event_date_iso: string | null` correctly uses required-nullable
because the LLM always returns the field.

## Prevention

- **Default to required-nullable for LLM output fields.** When adding a new
  field to a structured LLM response interface, use `field: T | null` unless
  you have a specific reason for optional. The LLM prompt should always return
  the field.
- **Reserve `?` for code-computed fields.** If TypeScript adds the field after
  the LLM response (like `past_date_detected` or `platform`), optional is
  correct because the field legitimately doesn't exist at parse time.
- **Let the compiler catch test gaps.** When you tighten a type from optional
  to required, TypeScript will immediately flag every test fixture that omits
  the field. This is a feature, not a chore — each error is a test that was
  silently incomplete.

## Related

- Commit `0874426` — the fix that removed `?` from `event_date_iso` and
  `event_energy`
- `docs/fixes/rubric-comparison-fixes/plan.md` — batch 3, fix #5
