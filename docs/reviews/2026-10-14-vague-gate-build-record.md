# Vague-gate plan (Revision 1b): build record, 2026-10-14

**Plan:** `docs/plans/2026-10-14-fix-vague-quote-gate-opening-plan.md`. **Alex:** "Accept, fix the 4, build" after plan
review R2 NO-GO (2 NO-GOs, no round 3). Code is NOT yet code-reviewed and the real-model arm has NOT run.

## What was built (commits, in order)

1. `90bfee0` snapshots S13-S17 and the retained S8-pre from the current code (`VAGUE_GATE_CASES`, a list separate from
   `VERIFY_CASES`: `src/generate-prompt-cases.ts` derives its C0-C12 from `VERIFY_CASES` by id and has its own C13-C17).
2. the prompt change: `vagueQuoteMode` (`one_question` + `vague` + `solo`/`duo`), `VAGUE_QUOTE_LEAD_SPECIFICITY`, the
   `lead_specific_opening` line, `VerifyPromptOptions` and the `verifyGate` pass-through; tests `src/vague-gate-prompt.test.ts`
   VG1-VG10; plan 1's G2 and G7 stop covering S8 (it is the changing mode now).
3. `snapshot refresh:` S8, S13, S17 (VG7 pins the diff to the two spans).
4. `src/gate-pairing.ts` (+ tests GP1-GP3), the runner's `--paired`, the report line, `scripts/vague-gate-controls.ts`.

## Mutation map (each row applied by hand, then `npm run test:match -- "Vague Gate"`, then restored)

| # | Mutation | Failing tests (each row fails) |
|---|---|---|
| 1 | predicate drops `vagueness` | VG2 S15, VG4 |
| 2 | mode drops the format clause | VG2 S16, VG4 |
| 3 | mode widened to any resolved format | VG2 S16, VG4 |
| 4 | seam ignored | VG4 |
| 5 | `verifyGate` pass-through dropped | VG4 |
| 6 | `preempted_questions` moved into the mode | VG2b, VG3, VG7 |
| 7 | the assumed-format sentence removed | VG1, VG2b, VG7, VG9 |
| 8 | the duo fail example removed | VG1, VG2b, VG7, VG8, VG9 |
| 9 | the format anchor removed | VG1, VG2b, VG7, VG8, VG9 |
| 10 | mode applied to `assume_and_quote` | VG2 S14, VG4 |
| 11 | a production call site passes `openingRule` | VG10 |

All 11 killed. **The plan said each row fails "exactly its own test"; that is not what happened:** rows 7-9 edit the same
text that VG1, VG2b, VG7 and VG9 each pin, and rows 1-3 and 10 also trip VG4's positive control. The map shows every
mutant caught, not one-to-one isolation. A mutant that wrongly passes nothing was not found.

## Verification (CHECKED on the build)

`npm test` 1099 pass / 0 fail / 1 skip; `npx tsc --noEmit` clean; leak check exit 0.

## Not done, and why

- **The arm and the controls were not run** (real API spend; Alex's "go").
- **The replays verify `o.drafts`, the post-check-cleaned drafts**, not the raw drafts the pipeline's own gate saw; a
  difference is possible (em-dash cleaning) and counts in the noise floor (`pipeline` vs `replay_mode`).
- **The verifier sees only the classification JSON, not the raw lead text**; "the lead wrote a birthday" can only be
  judged from what the classification holds. The planted controls test this directly.
