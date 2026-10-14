# Codex code review round 1: vague-gate (plan Revision 1b), 2026-10-14

**Verdict: NO-GO** (3 P1, 1 P2), pasted by Alex. **Reviewed:** `7946b16..59dfc3f` (HEAD `59dfc3f2ef...`). Codex's sandbox
blocked the leak check (`tsx` IPC `EPERM`) and the full suite: both UNEXECUTED on its side; my run at the same HEAD:
1099 pass / 0 fail / 1 skip, `tsc` clean, leak check exit 0. It confirmed the predicate, the three quote-mode lines, the
S8/S13/S17 snapshots, the seam, plan 1's amendments and the sign test.

| # | Codex finding | My check | Status |
|---|---|---|---|
| P1-1 | `--paired` replays `o.drafts` (post-check cleaned) while the pipeline gated the raw drafts, so "pipeline vs replay_mode" is not a same-input noise floor | CONFIRMED in `src/run-pipeline.ts:258-301` (gate, then post-check) and `scripts/clarification-measure.ts` (`o.drafts`); the build record even said so, but still called it the noise floor | valid |
| P1-2 | the controls script exits 0 on a stop condition and on all-null verifier errors | CONFIRMED: no `process.exit` on the decision; `null` verdicts are in neither list | valid |
| P1-3 | any `format_requested` text counts as the "format the lead named", but only "a solo guitarist" is tested; "musician" or "live music" could pass a generic opener | CONFIRMED by reading the text: it says "a format the lead itself named" with no definition of a concrete format | valid |
| P2-4 | VG10 is a line-based source scan (misses a multiline call, counts strings/comments) | CONFIRMED | valid |

Counters: code fix attempts so far 0; Codex code reviews 1 (R1 NO-GO). A second NO-GO stops automatic iteration.

## Fixes applied (fix attempt 1; commits `04e52f0` and `6d4d1c7`)

| # | Root cause | Fix | Test (positive control) |
|---|---|---|---|
| P1-1 | the runner called the pipeline's raw-draft gate the "same-input noise floor" while the replays verify cleaned drafts | the noise floor is `replay_mode` vs a second same-rule call `replay_mode_repeat` on the same cleaned draft; `pipeline` is context only; plan text corrected | GP2 (a pipeline-vs-replay difference alone adds 0) |
| P1-2 | the decision was only printed; a null verdict sat in neither list | `src/gate-controls.ts` `evaluateControls`; the script exits with its `exitCode` (1 on a stop or any verifier error) | GC1 (clean exits 0; generic pass in either verify; two specific misses; one miss tolerated; all-null exits 1) |
| P1-3 | the anchor text said "a format the lead itself named" without defining concrete | "a CONCRETE format"; generic words "musician", "live music", "entertainment", "music" named as NOT an anchor; a fail example; case S18 (`format_requested` = "live music"); a sixth generic planted opening in the controls | VG11 (S17 concrete vs S18 generic share one text; the generic-word clause and example are pinned) |
| P2-4 | a line scan | the TypeScript compiler API parses every non-test `src` file for `verifyGate` call expressions (three, three arguments, no `openingRule`) | VG10 plus a control: the parser finds a multiline 4-argument call and ignores a string and a comment |

**Bounded inventory for the format anchor (P1-3):** accepted = a term naming an instrument or ensemble the lead wrote
("a solo guitarist", "a duo", "flamenco guitar"); rejected = a category word ("musician", "live music",
"entertainment", "music"). Whether the model reads an unlisted generic word ("something live") as an anchor is NOT
tested here; the planted generic control (g6) probes one such case.

**Mutations added (each caught, then restored):** 12 generic-word clause removed (VG1, VG11, VG2b, VG7); 13 noise floor
read from the pipeline verdict (GP2); 14 controls exit ignores errors (GC1); 15 controls exit ignores a stop (GC1).

**Results:** `npm test` 1108 pass / 0 fail / 1 skip; `tsc` clean; leak check exit 0; worktree clean at `6d4d1c7`.
Not run: the real-model arm and the controls (API spend, Alex's "go").
