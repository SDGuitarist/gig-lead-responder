---
status: done
priority: p2
issue_id: "073"
tags: [prompts, generate, context-docs, conflict]
dependencies: []
unblocks: []
sub_priority: 1
---

# Contact Block Conflict Between Generate Prompt and QUICK_REFERENCE

## Problem

QUICK_REFERENCE.md (lines 189-193) shows the full contact block:
```
Alex Guillen
Pacific Flow Entertainment
(619) 755-3246
```

The generate prompt (line 199) says: "End with 'Alex Guillen' on its own line.
No business name, no phone number — just the name."

On non-GigSalad leads, the AI sees both instructions and has to choose between
including the phone number (QUICK_REFERENCE) or omitting it (generate prompt).

## Proposed Fix

Update QUICK_REFERENCE.md to match the generate prompt's instruction. If the
full contact block is needed for some contexts, make it conditional. But the
generate prompt should be the source of truth since it's in the system prompt
(higher weight).

## Files

- `docs/QUICK_REFERENCE.md` (lines 188-193)
