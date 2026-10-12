---
title: "Codex plan review, round 1: T4 reference-lead plan (Revision 0)"
date: 2026-10-12
plan: docs/plans/2026-10-11-feat-t4-reference-lead-plan.md
plan_revision_reviewed: 0 (unchanged; plan HEAD 1e4a70a)
prompt: re-run of the 2026-10-11 R1 whose run A text was lost (transcript only)
---

# Round 1 (re-run, 2026-10-12)

**Verdicts recorded:**

| Run | Verdict | Where |
|---|---|---|
| Run 1 (first pasted by Alex; A/B label not yet confirmed) | **NO-GO** (5 P1, 2 P2) | below, verbatim |
| Run 2 | NOT YET RECEIVED | add here when Alex pastes it; stricter verdict wins |

The 2026-10-11 R1 run A (NO-GO, 3 P1 / 3 P2 / 1 P3 per HANDOFF) is unrecoverable; this re-run replaces it.

## Claude Code's check of the findings (2026-10-12, against files, before Revision 1)

- **P2 #6 line numbers: CONFIRMED.** `generate.ts:79` is the `buildVoiceRulesBlock` call and `:81` is
  `buildVoiceExamplesBlock()`; the salutation rule is `:96`; Quote Terms starts `:271`, setup (110V + armless chair)
  `:273`. `verify.ts:38` is correct (`const voiceReferences = VOICE_REFERENCES`).
- **Word count: the plan's "142 words" is RIGHT** (142 whitespace tokens, "Hi Dana," through "Alex Guillen"); Codex agrees.
- Everything else is a plan-text or test-spec gap, fixed in Revision 1 by design, not by a code check.

## Verdict text (verbatim, run 1)

NO-GO — the plan needs revision before implementation.

P1 findings

1. Payment sentence is stale and contradicts the completed payment-terms implementation.
   `docs/plans/2026-10-11-feat-t4-reference-lead-plan.md:32-47, 72-77`

   The example still says:

   > "A 50% deposit holds the date."

   But `src/pipeline/payment-terms.ts:10` defines the six-days-out sentence as:

   > "Full payment holds the date."

   The plan also describes the 50% deposit as a standing rule, although payment wording is now selected by lead time. Update the example, D2, T5, and tests to assert the exact current sentence.
2. The human execution path is not concrete enough to run reproducibly.
   `docs/plans/2026-10-11-feat-t4-reference-lead-plan.md:144-160`

   The leads lack exact stdin text, dates, guest counts, duration/band expectations, and explicit classifier inputs. "Urgent," "5 weeks," and "a claim allowed" leave classification outcomes uncertain. Provide four copy-pasteable lead texts and expected `rate_card_tier`, `timeline_band`, format, guest count, and price band. Until executed, these outcomes remain hypotheses.
3. The mutation plan does not mechanically cover T1–T8.
   `docs/plans/2026-10-11-feat-t4-reference-lead-plan.md:112-128`

   T7 and T8 have no named mutations. The listed mutations do not specify the exact test command or expected failure. "Rule line deleted" and "urgent branch inverted" are prose descriptions, not reproducible mutation checks. Add one explicit mutation, command, and expected failing assertion for every acceptance test.
4. The T4-only boundary is specified but insufficiently tested.
   `docs/plans/2026-10-11-feat-t4-reference-lead-plan.md:56-60, 112-123`

   The `rate_card_tier === "T4"` condition is correct, and the intended insertion is only in `generate.ts`. However, T6 only checks `VOICE_REFERENCES` count/names; it does not prove the T4 block is absent from `verify.ts` or from every non-T4 generated prompt. Add tests asserting:
   - T1–T3 prompts contain no T4 block.
   - `buildVerifyPrompt()` contains no T4 reference text.
   - `VOICE_REFERENCES` remains unchanged.
   - The generated block is imported only by `generate.ts`.
5. The Feed-Forward risk remains materially unresolved.
   `docs/plans/2026-10-11-feat-t4-reference-lead-plan.md:171-185`

   The plan correctly identifies copying as the least-confidence risk, but three manual runs cannot establish that the model will not copy the example across T4 leads. The plan should explicitly label this as a bounded smoke test, define the acceptable failure threshold, and state what happens if one copied sentence or venue claim appears.

P2 findings

6. Several line references are stale.
   - `generate.ts:79` is `buildVoiceRulesBlock`; `buildVoiceExamplesBlock()` is at line 81.
   - Salutation is at `generate.ts:95-96`, not `93-94`.
   - Sign-off/contact handling is at `generate.ts:264-267`, not `262-265`.
   - Quote terms begin at `generate.ts:268`, with payment/setup lines at `271-275`, not `270-271`.

   `verify.ts:38` is accurate. Update all references before implementation.
7. The venue-leak control is narrower than the plan's claim.
   `docs/plans/2026-10-11-feat-t4-reference-lead-plan.md:16-18, 64-70, 124-128`

   `scripts/check-venue-history.ts:7-8` only catches exact 30-character copies and explicitly misses paraphrases. The approved example contains venue-specific text such as "the Del's beach" and "send the Del a COI." That is not a private-data fingerprint, but it can still teach a venue-space claim. Add a precise acceptance rule for which public venue wording is allowed and require the real-model checks to test paraphrased venue claims, not only exact windows.

Checks that passed

- Manifest arithmetic is correct: six rows R020–R025 become PORTED, R329 becomes NOT PORTED.
  `197 + 171 + 35 + 3 = 406`.
- The T4 guard requirement is correctly stated: return `""` unless `rate_card_tier === "T4"`.
- The example is 142 whitespace-delimited tokens as written, though a word-like tokenizer counts 144 because of tokens such as `6:25` and `110V`.
- No runtime behavior was executed in this review; runtime expectations remain hypotheses until the post-step-3 runs.

The plan should be revised and reviewed again narrowly against these named fixes before implementation.
