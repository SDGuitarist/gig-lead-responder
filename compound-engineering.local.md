# Review Context -- Gig Lead Responder

## Risk Chain

**Brainstorm risk:** None -- no brainstorm (the plan came from the measured verify-gate failure and Alex's rule that
the drafter never sees the lead text).

**Plan mitigation:** `docs/plans/2026-10-14-feat-lead-words-field-plan.md` (Revision 1c): a `lead_words` classifier field,
copied lexically and checked in code; a pre-registered regression gate, grounding count, arm and five-cell controls.
Plan review R1 NO-GO (5 P1/2 P2), R2 NO-GO (3 P1/2 P2), R3 (b) at the cap; Alex accepted, fixed one line, built.

**Work risk (from Feed-Forward):** that the drafter would use the phrases against the reference block's scene-first
order; only the arm could show it.

**Review resolution:** code review R1 NO-GO (2 P1/1 P2), R2 NO-GO (1 P1/1 P2), R3 (b) (1 finding); all six were in the
measurement tooling, none in the product path; all fixed with failing-first tests (Alex: no further round). The
real-model measurement then STOPPED twice (L1 format/price moved 15 of 15; control B2 passed a generic opening 6 of 6);
the classifier prompt edit was reverted byte for byte (SHA-256 eb8c9b54). 1143 pass / 0 fail / 1 skip.

## Files to Scrutinize

| File | What changed | Risk area |
|------|-------------|-----------|
| `src/prompts/classify.ts` | restored to 73fd38e bytes (pin eb8c9b54...) | must stay unedited until the next route is measured against the regression gate |
| `src/lead-words.ts`, `src/utils/sanitize.ts`, `src/pipeline/classify.ts` | the field, its coercion and grounding; INERT (the model is not asked) | a stored classification with the field is still honored; all-null equals today's text (LW5) |
| `src/prompts/verify.ts` | `vagueQuoteMode`, lead-specificity anchors, the lead_words sentence | control B2 ("Spring private event ... the guitar is already the one thing you've decided on") passes with all-null words |
| `src/lead-words-measure.ts`, `src/lead-words.test.ts` | the seam calls production `classifyLead`, `stripCodeFences`, `content[0]` | a seam must equal production exactly or its numbers mean nothing |

## Plan Reference

`docs/plans/2026-10-14-feat-lead-words-field-plan.md`
