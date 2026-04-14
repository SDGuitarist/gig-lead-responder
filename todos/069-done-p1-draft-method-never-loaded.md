---
status: done
priority: p1
issue_id: "069"
tags: [prompts, context-docs, conflict]
dependencies: []
unblocks: []
sub_priority: 1
---

# RESPONSE_CRAFT.md References DRAFT_METHOD.md Which Is Never Loaded

## Problem

RESPONSE_CRAFT.md lines 17-18 say:
- "Do not skip to DRAFT_METHOD.md without completing Steps 6-8 here first."
- "Do not produce any draft text until DRAFT_METHOD.md is loaded."

Line 257: "PROCEED TO DRAFT_METHOD.md (Step 9)."

But Stage 3 (`src/pipeline/context.ts`) never loads DRAFT_METHOD.md or
VERIFICATION.md. The AI sees instructions to wait for files that will never
arrive. Same issue with cross-references pointing to VERIFICATION.md.

## Proposed Fix

Either:
- **Option A:** Load DRAFT_METHOD.md and VERIFICATION.md in context.ts (adds
  token cost but makes the doc flow complete)
- **Option B:** Remove all references to DRAFT_METHOD.md and VERIFICATION.md
  from RESPONSE_CRAFT.md since their content is already encoded in the generate
  and verify prompts

Option B is better — the generate prompt already contains the drafting
instructions, and the verify prompt already contains the gate logic. Loading
the original docs would create more duplication and conflicts.

## Files

- `docs/RESPONSE_CRAFT.md` (lines 8-19, 257-259, 268-271)
- `src/pipeline/context.ts` (no changes needed if Option B)
