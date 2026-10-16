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

## Result of the check (2026-10-16; real model claude-sonnet-4-6; 6 verifies per text per tree; same planted drafts and `solo` case)

| Verifier | B1 (app-label control) | B2 |
|---|---|---|
| `95f3dda` (script written from `scripts/vague-gate-controls.ts` at that commit; B-cell texts copied from HEAD) | false x6 | **true x6** |
| HEAD `86d4f7e`, scoped rule | false x6 | **true x6** |
| HEAD with `{ openingRule: "default" }` (the strict pre-scoping rule) | false x6 | **true x6** |

Reading: B2 passes under all three, including the strict rule, so the false pass is NOT caused by the gate scoping or by
`lead_words`; it is how the verifier judges that sentence. B1 fails everywhere, so the check could tell a pass from a fail.
Correction to the line above: `95f3dda` is NOT the opening rule "before the gate scoping": it already contains
`VAGUE_QUOTE_LEAD_SPECIFICITY` (`git grep` at that commit); the strict rule is only reachable through the
`openingRule: "default"` seam, which is why the third row exists. Not shown: which words of B2 the verifier cites (the
verifier's reason text was not recorded); whether the earlier 6-of-6 and this 6-of-6 are independent (same text, same seed
of nothing: they are repeat calls, not new texts); other generic openings of the same shape. Cost: about 36 verifier calls,
roughly $0.5 to $1 (estimate: scripts that inject their own requester are not in `logs/usage.jsonl`, see below).

## Proposed approach (a plan to write)

1. DONE (table above): all three verifiers pass B2.
2. So the next step is the second branch: the rule needs a different test. The verifier cannot see the lead text, so the anchors
   must be about what the draft asserts, not what the lead wrote. First record the verifier's `fail_reasons`/rationale on B2
   (one run) to see which words it accepts as lead facts; then write more generic openings of the same shape (a season, an
   instrument, an absent venue) as controls before changing any wording.
3. Re-run the five-cell controls; every generic cell must fail in both verifies.

## Owner and trigger

Claude plans; Codex reviews. Trigger: before any further gate or lead-words work.
