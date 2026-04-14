---
status: pending
priority: p3
issue_id: "074"
tags: [prompts, classify, context-docs, ambiguity]
dependencies: []
unblocks: []
sub_priority: 1
---

# Social Proof Activation Decided in Two Places

## Problem

RESPONSE_CRAFT.md and QUICK_REFERENCE.md both define Social Proof conditions
(Standard/Qualification tier, no cultural context, no urgency, low/medium
competition).

The classify prompt also outputs `social_proof_active: boolean` as a field,
meaning the classify LLM decides whether Social Proof is active.

The generate LLM then sees both the classify decision AND the rules in the
context docs. Two different AIs could reach different conclusions.

## Proposed Fix

Single source of truth: either the classify LLM decides and the context docs
don't re-state the rules, or the rules are in the docs and classify doesn't
output the field. Since classify already evaluates the conditions, keep the
field and remove the conditional rules from the context docs (or add a note:
"Social Proof activation is pre-determined — see classification field").

## Files

- `docs/RESPONSE_CRAFT.md` (lines 73-82)
- `docs/QUICK_REFERENCE.md` (lines 134-142)
- `src/prompts/classify.ts` (social_proof_active field)
