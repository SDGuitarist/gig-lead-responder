---
status: pending
priority: p2
issue_id: "090"
tags: [verify-gate, false-pass, controls]
dependencies: []
unblocks: []
sub_priority: 1
---

# 090: Verify gate passes a generic opening with no lead words (control B2)

## Problem Statement

Control B2 of the 2026-10-14 five-cell matrix, `lead_words` all null: "Spring private event, no venue yet, and the guitar
is already the one thing you've decided on." passed `lead_specific_opening` in 6 of 6 verifies over 3 runs
(scripts/vague-gate-controls.ts; docs/reviews/2026-10-14-lead-words-measurement.md). A false pass is the harm direction.

## Not shown

Whether the pre-change verifier also passes B2 (cell B is new, so the earlier controls never planted it), and which anchor
in VAGUE_QUOTE_LEAD_SPECIFICITY (src/prompts/verify.ts: occasion, time frame, own doubt, concrete named format) it passes
through. "the guitar" and "spring" are the likely ones: a named instrument and a season the lead did not write.

## Proposed approach (a plan to write)

1. FIRST a check, not a fix: run cell B against the verifier at 95f3dda (the opening rule before the gate scoping) and at
   HEAD; record both.
2. If only HEAD passes it, tighten the anchor wording; if both pass it, the rule needs a different test (the verifier
   still cannot see the lead text, so the anchors must be about what the draft asserts, not what the lead wrote).
3. Re-run the five-cell controls; every generic cell must fail in both verifies.

## Owner and trigger

Claude plans; Codex reviews. Trigger: before any further gate or lead-words work.
