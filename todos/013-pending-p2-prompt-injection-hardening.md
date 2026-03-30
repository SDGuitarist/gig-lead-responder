---
status: pending
priority: p2
issue_id: "013"
tags: [code-review, security]
dependencies: []
unblocks: []
sub_priority: 9
---

# Harden prompts against injection

## Problem

Raw user text is concatenated into Claude prompts without delimiters. Crafted input could manipulate classification. Blast radius is limited (single-user tool) but matters for automation.

## Location

- `src/pipeline/classify.ts` line 11
- `src/prompts/generate.ts`
- `src/prompts/verify.ts`

## Fix

Wrap user text in explicit delimiters (triple backticks or XML tags). Add output validation checking classification values are valid enum members.
