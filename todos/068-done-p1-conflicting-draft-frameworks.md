---
status: done
priority: p1
issue_id: "068"
tags: [prompts, generate, context-docs, conflict]
dependencies: []
unblocks: ["069", "072"]
sub_priority: 1
---

# Conflicting Draft Frameworks: 7-Component vs 5-Step

## Problem

QUICK_REFERENCE.md and CULTURAL_CORE.md define a **7-Component Framework**
(Hook, Validation, Being in Picture, Creating Emotion, Differentiation, Answer
Everything, Close).

The generate prompt (`src/prompts/generate.ts`) teaches a **5-step sequence**
(Cinematic hook + validation, Differentiator + Named Fear, Fear/concern
resolution, Recommendation + price, CTA).

These don't map cleanly. The AI sees both in the same context window and has to
guess which takes priority. The 5-step is in the system prompt (higher weight);
the 7-component is in injected docs.

## Proposed Fix

Either:
- **Option A:** Reconcile them by adding a mapping table to the generate prompt
  showing how the 7 components map into the 5 steps
- **Option B:** Remove the 7-component framework from QUICK_REFERENCE.md and
  CULTURAL_CORE.md since the generate prompt already encodes the actual structure

Option B is simpler and eliminates the conflict entirely.

## Files

- `docs/QUICK_REFERENCE.md` (lines 148-158)
- `docs/CULTURAL_CORE.md` (lines 156-168)
- `src/prompts/generate.ts` (lines 68-78)
