---
status: done
priority: p3
issue_id: "075"
tags: [prompts, context-docs, negative-prompt]
dependencies: []
unblocks: []
sub_priority: 1
---

# Vague Negative Prompt: "Don't Punish the Sparseness"

## Problem

RESPONSE_CRAFT.md line 155: "Never treat a sparse lead as permission to go
generic."

Earlier in the same section: "Don't punish the sparseness."

These are vague negative instructions. The AI knows what NOT to do but has to
guess what "punishing sparseness" looks like. Negative prompts are weaker than
positive ones because they define an absence, not a behavior.

Most other negative prompts in the system are fine because they're paired with
PASS examples (e.g., banned vocabulary has explicit replacements, em dash rule
shows what to use instead).

## Proposed Fix

Replace with positive instructions:

- "Don't punish the sparseness" → "Treat every lead as having enough signal to
  write a compelling response, regardless of how little detail was provided."
- "Never treat a sparse lead as permission to go generic" → "A lead with three
  words still has an event type, a person behind it, and a moment being created.
  Build from those three anchors."

(The second replacement already exists later in the same paragraph — just move
it up and remove the negative framing.)

## Files

- `docs/RESPONSE_CRAFT.md` (line 155)
