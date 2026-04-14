---
status: done
priority: p2
issue_id: "077"
tags: [prompts, verify, enforcement]
dependencies: []
unblocks: []
sub_priority: 1
---

# Date Proximity Rule Has No Verify Enforcement

## Problem

RESPONSE_CRAFT.md line 184 and the generate prompt both say: "If the event date
is within 6 weeks, the draft MUST contain one sentence that acknowledges the
timeline." The generate prompt adds: "Never leave a short-timeline concern
unaddressed."

But the verify prompt has no gut check for timeline acknowledgment. A draft
could pass the gate without mentioning that the event is 10 days away.

## Proposed Fix

Add a conditional gut check `timeline_acknowledged` to the verify prompt:
- When `timeline_band` is "short" or "urgent": check that the draft contains
  language acknowledging the timeline (date mention, availability urgency,
  "coming up", hold offer)
- When `timeline_band` is "comfortable": always true (no-op)

## Files

- `src/prompts/verify.ts` — add gut check
- `src/types.ts` — add to GUT_CHECK_KEYS, update GUT_CHECK_TOTAL
