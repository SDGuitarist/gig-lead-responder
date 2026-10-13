# Review Context -- Gig Lead Responder

## Risk Chain

**Brainstorm risk:** None -- **no brainstorm** (skip gate: a measured defect; 17 of 18 real-model vague-lead runs
ended with no draft, `docs/reviews/2026-10-13-clarification-failure-measurement.md`).

**Plan mitigation:** `docs/plans/2026-10-13-fix-clarification-pricing-validator-plan.md` (Revision 1b). The
clarification-mode validator rejects text matching a supported price grammar (dollar figure, digits next to
dollars/bucks/USD, number words next to dollars/bucks, a k amount) and the internal terms anchor/floor/investment; the
bare words quote, rate and price are allowed. Alex: "narrow the validator, leave the prompt". Plan review R1 NO-GO
(3 P1, 3 P2), R2 NO-GO (1 wording P1, a contradiction between "no AMOUNT" and the documented unmarked-amount limit),
fixed in place at Alex's choice.

**Work risk (from Feed-Forward):** an unmarked amount ("around fifteen hundred") or a soft statement ("on the higher
end") now passes by decision (test V10); nothing deterministic stops it.

**Review resolution:** code review R1 = GO, no findings (919 pass / 0 fail / 1 skip). The 18-run re-run: no draft
17 of 18 -> 3 of 18, 0 pricing-language errors; the 3 remaining end on "exactly one question" (existing rule, V9).

## Files to Scrutinize

| File | What changed | Risk area |
|------|-------------|-----------|
| `src/pipeline/generate.ts` | `PRICE_STATEMENT_PATTERN` replaces the vocabulary pattern; error names only the match | a regex over model output: keep the number-word run bounded (V11), watch false rejects of ordinary prose |
| `src/clarification-validator.test.ts` | V1-V11 | V7's "no other part of the draft" assertion; stubbed model; sign-off added by `ensureSignOff` |
| `scripts/clarification-measure.ts` | committed runner (observational) | does not capture `verified` or the gate's reasons |
| `src/prompts/generate.ts` | NOT changed (Clarification Mode hard constraint) | prompt says "no price, rate, anchor, floor or package"; the validator no longer enforces the vocabulary half |

## Plan Reference

`docs/plans/2026-10-13-fix-clarification-pricing-validator-plan.md`
