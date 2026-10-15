---
status: pending
priority: p3
issue_id: "092"
tags: [draft-shape, vague-lead, measurement]
dependencies: []
unblocks: []
sub_priority: 1
---

# 092: Quoted vague drafts: exactly one question, length and copying

## Problem Statement

From the 2026-10-14 arm (50 runs, scripts/clarification-measure.ts, the lead_words code at fa71347): exactly one question
in 38 of 50 drafts; median 197 words and 11 sentences against about 100 words in Alex's own reply; 40 of 50 drafts share
at least one 30-character window with the example reply (max 83 windows). Earlier cycles named the first as the next
failure and the third as a risk; none is fixed.

## Proposed approach (a plan to write)

1. Treat them as one cycle (same arm, same prompt section: src/data/vague-quote-reference.ts and the generate prompt).
2. "Exactly one question": a code-side check that FAILS the draft (the project pattern: COI sentence, stated prices),
   with the wording fix measured.
3. Length and copying: a word limit in the drafting steps and the existing shared-window instrument as the measure
   (src/route-metrics.ts `sharedWindows`, 30-char windows after cutting mandated sentences).
4. Measure paired against the same leads with a noise floor; descriptive first, a bar only after Alex sets one (see 087).

## Owner and trigger

Claude plans; Alex judges the copying (it is voice). Trigger: after 090 and 091, or sooner if Alex asks.
