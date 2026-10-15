---
title: "The verify-gate scoping that did not help, and the lead_words field that moved an unrelated price: both measured, one reverted"
category: architecture
tags: [verify-gate, classifier, lead-words, regression-gate, controls, measurement-seam, paired-comparison, noise-floor, codex-review, revert]
module: src/prompts/verify.ts, src/prompts/generate.ts, src/lead-words.ts, src/lead-words-measure.ts, src/regression-compare.ts, scripts/vague-gate-controls.ts
symptom: "Quoted vague-lead drafts failed the verify gate's opening check in 32 to 33 of 50 runs because neither the drafter nor the verifier ever sees the lead's own words."
root_cause: "The verifier sees only the classification JSON and the drafts, and the drafter never sees the lead text (project rule), so 'cite a detail the lead wrote' has nothing to cite. A paragraph added to the classifier prompt to carry the words shifted another field on an unrelated lead."
date: 2026-10-14
model: claude-sonnet-5-5
predecessor: architecture/2026-10-14-vague-lead-quote-route-default-in-code-and-the-gate-it-left-behind.md
related:
  - docs/plans/2026-10-14-fix-vague-quote-gate-opening-plan.md
  - docs/plans/2026-10-14-feat-lead-words-field-plan.md
  - docs/reviews/2026-10-14-vague-gate-measurement.md
  - docs/reviews/2026-10-14-vague-gate-code-codex-round2.md
  - docs/reviews/2026-10-14-lead-words-code-codex-round1.md
  - docs/reviews/2026-10-14-lead-words-code-codex-round2.md
  - docs/reviews/2026-10-14-lead-words-code-codex-round3.md
  - docs/reviews/2026-10-14-lead-words-measurement.md
---

# Two measured attempts to give the opening check something to cite: one inconclusive, one stopped by its own gates

## Prior Phase Risk

> "Whether the drafter will open on a quoted phrase when the reference block's scene-first order and Alex's own reply
> both start with a scene; the new section must outrank them and only the arm shows whether it does."
> (docs/plans/2026-10-14-feat-lead-words-field-plan.md, Feed-Forward, least confident)

The arm did show movement (verified 20 of 50, opening-false 10 of 50), but two control stops made it uninterpretable, so the
risk is **still open**: the build never produced a clean answer to whether the drafter uses the phrases.

## What happened, in order

1. **Gate scoping** (`vagueQuoteMode`: one_question + vague + solo/duo). Built with a measurement seam
   (`VerifyPromptOptions {openingRule: "default"}`) and measured paired against the old rule on the same drafts with a
   replay noise floor. Result: 6 drafts changed to pass, 2 to fail, exact sign test p = 0.145, noise floor 2 of 50. The
   scoping was **not distinguishable from noise**. The verifier could not cite a detail it had never been shown.
2. **lead_words** (the lead's own occasion, time frame and doubt as a classifier field, copied lexically and checked in
   code). Planned through three Codex plan rounds, built, three Codex code rounds (below), then measured.
3. **Measurement stopped itself twice** and a rerun reproduced both; the classifier prompt edit was reverted byte for byte.

## The two stops (and why they are not noise)

| Stop | Evidence | Rerun |
|---|---|---|
| Regression: L1 wedding `format_recommended` and `quote_price` moved | before 3 duo / 2 flamenco_duo; after 5 of 5 flamenco_duo; price 1495 to 1595 | before 15 runs: 8 duo, 7 flamenco_duo; after 15 of 15 flamenco_duo (chance about 3 in 100,000) |
| Control B2 passed `lead_specific_opening` with all-null `lead_words` (a false pass, the harm direction) | passed both verifies | 6 of 6 verifies over 3 runs |

The other 6 leads were identical on all 8 fields. Grounding was fine (14 of 115 values dropped, 12%).

## Lessons

1. **A paragraph added to one prompt can move an unrelated field.** The edit was meant to add an optional output; it also
   shifted a format and a price. The regression gate existed exactly for this and fired. Run it before the arm, not after.
2. **Five runs per side cannot separate an effect from a coin flip when the baseline is already split.** The rule fired on
   the mode; 10 more runs per side settled it cheaply. Pre-register the rerun rule next to the stop rule.
3. **When the controls fail, the arm is not an answer.** The arm improved (20 of 50 verified, was 9 to 11) but B2 showed
   the verifier can pass a generic opening, so some of the improvement may be looseness. The two cannot be separated.
4. **A measurement seam must call production, not copy it.** All five Codex code findings (rounds 1 to 3) were in the
   tooling that measures the pipeline, none in the pipeline: the denominator, a script that bypassed `classifyLead`, a raw
   read, a cleaner that didn't trim, and a block-selection that joined every block where production reads `content[0]`.
   Each fix shared production's own function. The review verified the instrument, which is the part that makes a number
   mean something.
5. **A raw-read guard should enumerate syntaxes, not one.** The AST allowlist saw dot access only until round 2; the
   scanner now covers bracket access and destructuring and has rejecting and allowing controls.
6. **An inert field is a valid way to stop.** The code, drafter section and verifier sentences stay; with all-null input
   they produce today's text (LW5), so the pipeline is that of `95f3dda` and a later route can supply the words.

## What is not shown

- Which sentence of the classifier paragraph moved L1.
- Whether B2 would also have passed on the pre-change verifier (cell B is new in this plan).
- Whether the drafter uses the phrases when they are present and the verifier is not loose.

## Review loop record

Plan R1 NO-GO 5 P1/2 P2, R2 NO-GO 3 P1/2 P2, R3 (b) at the cap (Alex accepted, fixed one line, built). Code R1 NO-GO 2 P1/1
P2, R2 NO-GO 1 P1/1 P2, R3 (b) 1 finding (Alex chose fix, no further round). Every code finding was reproduced by a
failing-first test and a caught mutant (21 mutation rows).

## Feed-Forward

- **Hardest decision:** reverting the classifier prompt edit instead of keeping it and planning a fix for L1 and B2: the
  arm moved the right way, but a price shift on a rich wedding is the harm, and the controls could not clear the arm.
- **Rejected:** interpreting the arm over the stops; re-running with a looser stop rule; reverting the whole change.
- **Least confident:** that the lead's own words can reach the drafter and verifier at all without a classifier-prompt
  paragraph; the next route (a code-side extractor, or a separate small extraction call) is unmeasured, and B2 shows the
  verifier's specificity anchors may pass an opening that cites nothing the lead wrote.

## Three Questions

1. **Hardest pattern to extract from the fixes?** That the review's six findings were all about the measurement
   instrument; the product code was never wrong, and the stop came from the instrument doing its job.
2. **What did you consider documenting but left out, and why?** The per-field normalization rules and the token-level
   negation guard: the code and LW11 pin them, and the field is now inert, so a doc would describe unused behavior.
3. **What might future sessions miss that this solution doesn't cover?** That the code for lead_words is still present
   and inert; someone may assume the classifier returns it. LW6 asserts the prompt no longer asks, but a stored
   classification with the field would still be honored by the accessor.
