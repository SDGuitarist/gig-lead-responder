---
status: done
priority: p2
issue_id: "076"
tags: [prompts, verify, enforcement]
dependencies: []
unblocks: []
sub_priority: 1
---

# Genre Default Rule Has No Verify Enforcement

## Problem

RESPONSE_CRAFT.md line 182 and the generate prompt both say: "ALWAYS state what
you default to" when genre/style is not specified. The generate prompt even
gives examples: "I default to fingerstyle jazz and light acoustic pop for
corporate rooms."

But the verify prompt has no gut check for this. A draft can pass the gate
without ever stating a genre default on a lead that didn't specify genre.

## Proposed Fix

Add a conditional gut check `genre_default_stated` to the verify prompt:
- When classification has no genre specified (vague_format_request or genre
  field is generic): check that the draft contains a sentence stating what
  genre/style will be played
- When genre is specified: always true (no-op)

## Files

- `src/prompts/verify.ts` — add gut check
- `src/types.ts` — add to GUT_CHECK_KEYS, update GUT_CHECK_TOTAL
