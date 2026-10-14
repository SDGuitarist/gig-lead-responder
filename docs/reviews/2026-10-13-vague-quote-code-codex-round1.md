# Codex code review round 1: vague-lead quote route (plan Revision 2), 2026-10-14

**Verdict: NO-GO** (3 P1, 1 P2), pasted by Alex. **Reviewed:** `c9fbb62..687995b` (HEAD `687995b48f...`). Plan Revision 2 had
no plan review; this was its first independent look. Codex's sandbox blocked `tsx` IPC and localhost sockets, so the
full suite and leak check were UNEXECUTED on its side (not passes); my own run: 1057 pass / 0 fail / 1 skip, `tsc`
clean, leak check exit 0, at the same HEAD.

## Findings and my check (each read against the code, not taken on trust)

| # | Codex finding | My check | Status |
|---|---|---|---|
| 1 P1 | `defaultVagueFormat` runs only in fresh `classifyLead`; `runEditPipeline` reuses a stored classification, so an OLD vague/unresolved lead still gets the no-price path | CONFIRMED in `src/run-pipeline.ts:319-342` (no raw text there, so the ensemble test cannot be re-applied; the stored `pricing` is also unresolved, so changing only the format would desync it). Practical reach: only leads classified before this change; none has been sent (Mac poller not started) | valid; fix is a documented limitation + a pinning test unless Alex wants stored leads re-run |
| 2 P1 | `summarizeRoute` counts every run without a route as "no classification", even when generation failed after classification | CONFIRMED in `src/route-metrics.ts:31-36` and `scripts/clarification-measure.ts:121-154`. No effect on the rerun (0 errors); it would mislabel any run with a `GenerationError` | valid; fix is to record the failure stage |
| 3 P1 | The "order, not sentences" contract is not holding: 44 of 50 drafts share a non-mandated window | CONFIRMED by my own measurement record. One cause is in the prompt itself: `src/data/vague-quote-reference.ts:48` tells the model to give setup needs while the example supplies a concrete claim ("home, backyard, or restaurant") | valid; the remedy is a POLICY call (see below) |
| 4 P2 | "group" not followed by "of" is a false-positive boundary with no test ("the bride's group will be there") | CONFIRMED in the regex; it errs to the conservative side (stays unresolved, held for Alex), and the plan lists "a group" as an ensemble | valid as a missing test; accept as a documented boundary |

## Not findings (what passed, per Codex)
58 vague tests pass; `tsc` clean; the gate covers the withholding cases; C13-C17 hashes match; the classifier
regression stayed inside the baseline; worktree clean at the expected HEAD.

## Where this stands
Iteration cap: 0 fix attempts so far. Round counter: 1 Codex review. A NO-GO in round 2 stops automatic iteration.

## Fixes applied (iteration 1; Alex's answers: "Accept your own words", "Document the limit, pin with a test")

| Finding | Root cause | Fix | Test (failed first / control) |
|---|---|---|---|
| 1 | the edit path has no raw lead text and a stored unresolved price | documented limit in plan Revision 2b; no code change | V10a (stored unresolved keeps clarification; the same lead with the default applied gets the block) |
| 2 | `summarizeRoute` read "no route" as "no classification" | runner records `error_stage` (the PipelineStageError stage or "unknown"); distribution has three failure labels | V10b (verified to fail on the old function: 1 of 2 failed) |
| 3 | the block asked for a setup sentence and showed one; the check counted it | `VAGUE_QUOTE_SETUP_SENTENCE` allowed verbatim in the block; cut by `sharedWindows` in the runner; every other sentence stays forbidden | V10c (positive: setup cut gives 0; negative: another clause still counts; block text pinned) |
| 4 | no test for benign "group" | tests only; boundary documented (conservative side) | V10d (with a "group of 40" positive control) |

**My own error, caught by the suite:** running `scripts/snapshot-verify-prompts.ts` to look at its output rewrote
`src/fixtures/verify-prompt-baseline/S0.txt`, which `git add -A src` then committed; G6 failed. I also regenerated the
generate-prompt hashes, which broke V7 (it expects C8/C15/C16 to differ from the stored pre-block hash). Both were
restored from the prior commit. No snapshot or hash changes ship in this round. Suite after: 1061 pass / 0 fail / 1
skip; `tsc` clean; leak check exit 0.
