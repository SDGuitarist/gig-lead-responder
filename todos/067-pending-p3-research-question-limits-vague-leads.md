---
status: pending
priority: p3
issue_id: "067"
tags: [pipeline, classify, generate, research]
dependencies: ["064"]
unblocks: []
sub_priority: 1
---

# Research: Question Limits on Vague Category Leads

## Context

The pipeline currently allows at most ONE clarifying question, and only when
the lead is vague + low competition. Medium/high/extreme competition leads
always assume and quote, even on completely ambiguous category requests like
"Latin Band."

The CTA ("Want me to hold the date?") is a closing move, not a clarifying
question — it doesn't give us useful classification information and should not
count toward the question limit.

## Research Questions

1. **Does the one-question limit hurt conversion on vague category leads?**
   When the pipeline assumes a format and quotes on a vague request with
   medium+ competition, does the client reply less often than when we ask?

2. **Is the competition-based suppression correct?** The logic assumes high
   competition = respond fast with a number or lose. But for genuinely
   ambiguous requests, a fast wrong answer might convert worse than a fast
   smart question. Is there data to support either approach?

3. **Should `assume_and_quote` ever ask a question?** Currently it never does.
   Could a hybrid work — assume, quote, AND ask a binary question as a
   secondary CTA? e.g., "Here's my rate for a duo. Are you picturing something
   more like that, or a full ensemble?"

4. **What's the right distinction between clarifying questions and CTA
   questions?** The pipeline should track these separately. A clarifying
   question gathers information to improve the response. A CTA question moves
   toward booking. They serve different purposes and shouldn't share a limit.

## Not a Blocker

This is research to inform future improvements. The binary question strategy
in todo 064 is the actionable fix. This research would refine the rules around
when and how many questions are appropriate.

## Origin

Discussion during pipeline architecture review (2026-04-13). Observation that
the CTA question doesn't provide classification signal and shouldn't count
toward the question limit.
