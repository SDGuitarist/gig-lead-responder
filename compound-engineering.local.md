# Review Context -- Gig Lead Responder

## Risk Chain

**Brainstorm risk:** None -- **no brainstorm** (skip gate: the measured remainder after the verify-gate fix, 13 of 33
clarification drafts failing a hard condition, `docs/reviews/2026-10-13-clarification-gate-rerun.md`).

**Plan mitigation:** `docs/plans/2026-10-13-fix-clarification-draft-shape-plan.md` (Revision 1b). In clarification mode
only: steps 1-3 reshaped (step 3 kept as one bundled sentence so concern traceability is still requested), 70 to 100
words and 4 to 6 sentences, `price` dropped from the compressed retain list. Plan review R1 NO-GO (2 P1, 3 P2, 1 P3),
R2 NO-GO (3 P2) at the cap; Alex chose to fix and build.

**Work risk (from Feed-Forward):** that a shorter-reply instruction is followed at all (the prompt already said
100-125 words and 1 of 33 drafts complied).

**Review resolution:** code review R1 NO-GO (2 P1, 1 P2, all in the report path: a failed manifest check still
printed a statistic; incomplete arms accepted; one manifest printed), fixed and reproduced first; R2 GO. Measurement
(50 runs per arm, exploratory): unusable 38% -> 34% (p 0.42, power about 55-60% for 15 points), verified 16% -> 25%,
sentences 8 -> 5, competitor-test failures 4 -> 1, structural scene 10 -> 11. The pre-registered stop row fired.

## Files to Scrutinize

| File | What changed | Risk area |
|------|-------------|-----------|
| `src/prompts/generate.ts` | three spans scoped by `clarificationMode` (steps 1-3, word count, compressed "Must retain") | the hash fixture goes stale on ANY unrelated edit to this prompt; step 3 must stay requested (concern traceability) |
| `src/generate-prompt-cases.ts`, `src/fixtures/generate-prompt-hashes.json` | 13 cases, `removeSpans`, `spansOf`, SHA-256 pins | refresh only in a `snapshot refresh:` commit with the prompt diff |
| `src/clarification-shape-prompt.test.ts` | P1-P8 and the extractor controls | the span anchors (`1. **`, `4. **`, `- Word count:`, `- Must retain:`) must stay unique |
| `src/arm-manifest.ts`, `scripts/clarification-arm-report.ts` | `compareArms`, `assessArms`, a gated, aggregate-only report | residual: a duplicated result file or a partial lead set totalling 50 still passes |
| `scripts/clarification-measure.ts` | `--arm`, manifest, counts, held-out h1-h4 | `dirtyPromptFiles` covers `src/prompts` and `src/pipeline` only |
| `src/pipeline/generate.ts` | NOT changed | the internal terms `anchor` / `floor` still reject ordinary prose (4 of 172 runs) |

## Plan Reference

`docs/plans/2026-10-13-fix-clarification-draft-shape-plan.md`
