# Review Context -- Gig Lead Responder

## Risk Chain

**Brainstorm risk:** None -- **no brainstorm** (the route came from Alex's own reply to a vague lead and the
measurement that showed the clarification route was the wall).

**Plan mitigation:** `docs/plans/2026-10-13-feat-vague-lead-quote-with-question-plan.md` (Revision 2b). The default
format lives in code (`defaultVagueFormat`), the classifier PROMPT is pinned by SHA-256; a reference block shows
Alex's reply for ORDER. Plan review R1 NO-GO (5 P1, 1 P2), R2 NO-GO (1 P1, 1 P2) at the cap; **Revision 2 (code
default) had no plan review**.

**Work risk (from Feed-Forward):** that the verify-gate opening rule is the whole reason 40 of 50 drafts failed; I read
counts and two reasons and have not run the verifier with the rule changed.

**Review resolution:** code review R1 NO-GO (3 P1, 1 P2), R2 NO-GO (1 P1), all four fixed or documented; no round 3
(Alex's choice). 1061 pass / 0 fail / 1 skip. Final-prompt arm: verified 10 of 50, copying 30 of 50, 17 of 40
unverified fail the opening check alone.

## Files to Scrutinize

| File | What changed | Risk area |
|------|-------------|-----------|
| `src/pipeline/classify.ts` | `defaultVagueFormat` after the classifier | ensemble word match (a miss or a false "group" changes the route); stored leads keep their old route |
| `src/prompts/generate.ts` | `buildVagueQuoteReferenceSection` gate | withheld cases; COI deliberately not withheld |
| `src/data/vague-quote-reference.ts` | Alex's reply, conditional setup sentence | copying (30 of 50 windows); the "compatible" judgment is unmeasured |
| `src/prompts/verify.ts` | NOT changed | the strict opening rule applies again to a quoted vague lead |
| `src/route-metrics.ts`, `scripts/clarification-measure.ts` | formulas, `error_stage` | a failed run is not a classification failure |

## Plan Reference

`docs/plans/2026-10-13-feat-vague-lead-quote-with-question-plan.md`
