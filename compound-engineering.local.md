# Review Context -- Gig Lead Responder

## Risk Chain

**Brainstorm risk:** None -- **no brainstorm** (skip gate: two measurements with records,
`docs/reviews/2026-10-13-clarification-verify-measurement.md` and `...-clarification-gate-measurement.md`).

**Plan mitigation:** `docs/plans/2026-10-13-fix-clarification-gate-opening-plan.md` (Revision 1b). The verify prompt's
section 6b and the `lead_specific_opening` gut-check line are scoped to clarification mode: the opener must repeat a
fact or uncertainty the lead supplied; generic references fail. Every other mode is byte-equal to a snapshot outside
the voice-reference block, which G8 pins by SHA-256. Plan review R1 NO-GO (4 P1, 3 P2), R2 NO-GO (2 not fixed, 1 P2)
at the cap; Alex chose to fix and build.

**Work risk (from Feed-Forward):** the verifier follows a scoped definition; `gate_status` is the model's judgment,
not arithmetic in code, so the same drafts can fail for a reason the booleans do not show.

**Review resolution:** code review R1 NO-GO (2 P2: the voice block hidden from byte-equality, salutation handling in
the runner's `opening`), both reproduced and fixed; R2 NO-GO (1 P2, plan prose says "byte-equal" without "outside the
voice-reference block"), fixed at the cap with Alex's choice. Re-run: 0 of 17 verified became 2 of 16; the
pre-registered stop row fired (4 runs still fail on the opening alone).

## Files to Scrutinize

| File | What changed | Risk area |
|------|-------------|-----------|
| `src/prompts/verify.ts` | two spans scoped by `clarificationMode`: `DEFAULT_LEAD_SPECIFICITY` / `CLARIFICATION_LEAD_SPECIFICITY` and the gut-check line | the predicate is shared with three other clarification lines; the blank line before `### 7.` was off by one once |
| `src/clarification-gate-prompt.test.ts` | G0-G8 | G2/G4 compare outside the voice block; G8 is the only guard for edits inside it |
| `src/verify-prompt-cases.ts`, `src/fixtures/verify-prompt-baseline/` | 13 cases, `sectionOf`, `snapshotForm`, `voiceBlockOf` | a legitimate voice-reference edit needs a `snapshot refresh:` commit and a new hash |
| `scripts/clarification-measure.ts`, `src/draft-opening.ts` | records the final gate detail and `opening` | `rule_implied_pass` excludes `competitor_test` (it passes when false) |
| `src/prompts/generate.ts` | NOT changed | the generate-side gap (structural scene, competitor test) is plan 2 |

## Plan Reference

`docs/plans/2026-10-13-fix-clarification-gate-opening-plan.md`
