---
status: pending
priority: p3
issue_id: "079"
tags: [prompts, verify, enforcement]
dependencies: []
unblocks: []
sub_priority: 1
---

# Concern Integration Requirement Weakly Enforced

## Problem

RESPONSE_CRAFT.md Step 7 says concerns must be "integrated proof — concern,
experience, and solution in adjacent sentences." Shows WRONG (scattered) vs
RIGHT (integrated) examples.

The verify prompt checks that each concern has a `draft_sentence` but doesn't
check whether concerns are integrated or scattered across the draft. A draft
could pass by addressing concerns in disconnected paragraphs.

## Proposed Fix

Add a `concerns_integrated` boolean gut check to the verify prompt:
"Are all flagged concerns addressed within 2 adjacent sentences of each other,
or scattered across the draft? If concerns are in separate paragraphs with
unrelated content between them, concerns_integrated = false."

This is harder to enforce than other checks since it requires positional
analysis, but the AI evaluator should be capable of it.

## Files

- `src/prompts/verify.ts` — add gut check
- `src/types.ts` — add to GUT_CHECK_KEYS, update GUT_CHECK_TOTAL
