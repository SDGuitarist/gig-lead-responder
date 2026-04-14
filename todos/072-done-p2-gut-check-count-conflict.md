---
status: done
priority: p2
issue_id: "072"
tags: [prompts, context-docs, conflict]
dependencies: ["068"]
unblocks: []
sub_priority: 1
---

# Gut Check Count Conflict: 4 in Docs vs 15 in Verify

## Problem

PRINCIPLES.md (lines 140-154) and QUICK_REFERENCE.md (lines 163-171) both
define a **4-check** quality standard:
1. Can they SEE it?
2. Named the fear?
3. Differentiated?
4. Creates relief?

The verify prompt defines **15 gut checks** (can_see_it, validated_them,
named_fear, differentiated, preempted_questions, creates_relief,
best_line_present, prose_flows, competitor_test, lead_specific_opening,
budget_acknowledged, past_date_acknowledged, mariachi_pricing_format,
cultural_vocabulary_used, sounds_like_alex).

The generate AI sees the 4-check version in the injected context docs and might
think it only needs to pass 4 checks. The evaluator checklist at the end of the
generate prompt lists all 15, but the context docs contradict this with a
simpler standard.

## Proposed Fix

Update PRINCIPLES.md and QUICK_REFERENCE.md to reference the full 15-check
system, or remove the 4-check sections entirely since the generate prompt
already includes the evaluator checklist. The 4-check version could be
reframed as "the 4 most critical checks" rather than "the quality standard."

## Files

- `docs/PRINCIPLES.md` (lines 140-154)
- `docs/QUICK_REFERENCE.md` (lines 163-171)
