---
status: done
priority: p2
issue_id: "080"
tags: [prompts, verify, enforcement]
dependencies: []
unblocks: []
sub_priority: 1
---

# Compressed Draft Validation Not Enforced in Verify

## Problem

The generate prompt says: "Even the compressed draft MUST contain one sentence
that validates the CLIENT specifically (not generic event praise)."

The verify prompt extracts the `validation_line` from the full draft but never
checks the compressed draft for validation. A compressed draft could strip the
validation sentence during compression and still pass the gate.

## Proposed Fix

Add a `compressed_validation_present` gut check to the verify prompt:
"Extract a validation sentence from the COMPRESSED DRAFT specifically. If no
client-specific validation exists in the compressed version,
compressed_validation_present = false."

The verify prompt already receives both drafts in the user message, so this
is straightforward to add.

## Files

- `src/prompts/verify.ts` — add gut check
- `src/types.ts` — add to GUT_CHECK_KEYS, update GUT_CHECK_TOTAL
