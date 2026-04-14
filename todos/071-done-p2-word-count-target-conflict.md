---
status: done
priority: p2
issue_id: "071"
tags: [prompts, generate, context-docs, conflict]
dependencies: []
unblocks: []
sub_priority: 1
---

# Word Count Targets Conflict Between Generate Prompt and QUICK_REFERENCE

## Problem

Generate prompt (line 203): Uses "145-165" for both premium AND
premium + cultural leads. Uses "100-125" for standard.

QUICK_REFERENCE.md (lines 79-84):
- Standard: 100-125
- Premium: 125-145
- Premium + Cultural: 145-165

The generate prompt collapses Premium and Premium + Cultural into one range.
A plain premium lead (no cultural context) gets 145-165 in the generate prompt
but should get 125-145 per QUICK_REFERENCE. The AI sees both.

## Proposed Fix

Update the generate prompt to use three tiers matching QUICK_REFERENCE:
```typescript
const wordCount = classification.cultural_context_active
  ? "145-165"
  : classification.tier === "premium"
    ? "125-145"
    : "100-125";
```

## Files

- `src/prompts/generate.ts` (line 203)
