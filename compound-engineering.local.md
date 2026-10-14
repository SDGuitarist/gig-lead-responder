# Review Context -- Gig Lead Responder

## Risk Chain

**Brainstorm risk:** None -- **no brainstorm** (skip gate: 4 real rejections of ordinary prose, each read in
context, named as an open risk by the first validator plan's review).

**Plan mitigation:** `docs/plans/2026-10-13-fix-clarification-internal-terms-plan.md` (Revision 1b). `anchor` and
`floor` are rejected as pricing compounds, not as words; `investment` unchanged; no possessive form. Alex's decision
2026-10-13 ("Pricing-noun compounds only") is recorded in the plan; V4a/V4b were amended by it. Plan review R1 NO-GO
(4 P1, 2 P2), R2 NO-GO (1 P2 mutation isolation) at the cap; Alex chose to fix and build.

**Work risk (from Feed-Forward):** that the two compound forms cover how the model would leak the terms; none has
been observed (0 pricing compounds in 816 stored drafts).

**Review resolution:** code review R1 GO, no findings (997 pass / 0 fail / 1 skip). Replay over 816 stored drafts:
old alternative 4 matches, new 0.

## Files to Scrutinize

| File | What changed | Risk area |
|------|-------------|-----------|
| `src/pipeline/generate.ts` | `PRICE_STATEMENT_PATTERN`: two compound alternatives plus `investment`; the pattern is now exported | a bare `the floor is firm` passes by decision; "price anchors the conversation" and "floor number" are accepted false rejects |
| `src/clarification-validator.test.ts` | V4a/V4b amended; V12, twelve V13 one-sentence tests, V14, V16 | each mutation row must fail exactly its own token test |
| `scripts/clarification-validator-replay.ts`, `src/clarification-replay.test.ts` | offline replay, exit 2 on empty input | corpus is session-local; stored drafts came from the old validator and mixed prompts |
| `src/prompts/generate.ts` | NOT changed | the prompt still says "Do NOT state a price, rate, anchor, floor, or package" |

## Plan Reference

`docs/plans/2026-10-13-fix-clarification-internal-terms-plan.md`
