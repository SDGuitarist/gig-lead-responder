---
status: pending
priority: p3
issue_id: "078"
tags: [prompts, generate, traceability]
dependencies: []
unblocks: []
sub_priority: 1
---

# Sparse Lead Type Classification Not in Output JSON

## Problem

The generate prompt says: "After classification, state: [Sparse Lead Type:
1/2/3/4] before writing pre-work."

But the output JSON schema has no field for this. It's a mental instruction
only. There's no way to verify which sparse lead type was chosen or whether the
AI followed the corresponding strategy.

## Proposed Fix

Add `sparse_lead_type` to the GenerateResponse reasoning block:

```typescript
interface GenerateResponse {
  reasoning: {
    details_present: string[];
    absences: string[];
    emotional_core: string;
    cinematic_opening: string;
    validation_line: string;
    sparse_lead_type?: 1 | 2 | 3 | 4 | null; // null when lead is not sparse
  };
  // ...
}
```

This makes the classification traceable and could be used by the verify stage
to check that the right strategy was applied.

## Files

- `src/prompts/generate.ts` — add to reasoning schema in output format
- `src/pipeline/generate.ts` — update GenerateResponse interface
