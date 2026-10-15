---
status: pending
priority: p2
issue_id: "091"
tags: [lead-words, classifier, drafter, verify-gate]
dependencies: []
unblocks: []
sub_priority: 1
---

# 091: A route for the lead's own words that is not a classifier-prompt paragraph

## Problem Statement

Quoted vague drafts fail the verifier's opening check in 32 to 33 of 50 runs because neither the drafter nor the verifier
sees the lead's words (the drafter never sees lead text by project rule; the verifier sees only the classification JSON).
The lead_words classifier field was built to carry them and its classifier-prompt paragraph moved an unrelated lead's
format and price 15 of 15, so it was reverted (solution doc
docs/solutions/architecture/2026-10-14-lead-words-field-measured-stopped-and-reverted-and-the-gate-scoping-that-did-not-help.md).
The field, grounding code and the drafter and verifier sections stay in the code, inert.

## Options (to plan, not decided)

1. **A code-side extractor** that finds the occasion, time frame and doubt phrases in the lead text without a model
   (patterns plus the existing substring grounding). No prompt edit; narrower coverage.
2. **A separate small extraction call** (its own prompt, run only for vague one_question leads) that returns the three
   phrases; the classifier prompt stays pinned. A new model call and cost, so it is a new subsystem and needs Alex's yes.
3. **Accept the opening failure** and move the vague lead's reading to Alex's own check (the router already holds every
   vague one_question lead).

## Acceptance

Whichever option: the regression gate exits 0, the five-cell controls pass (see 090), opening-false is measured over all
runs, and a paired comparison against the same drafts uses a noise floor. The seam must call production functions.

## Owner and trigger

Alex picks the option. Depends on 090 (the verifier must not be loose before more is measured through it).
