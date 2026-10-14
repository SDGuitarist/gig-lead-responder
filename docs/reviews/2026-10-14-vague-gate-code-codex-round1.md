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
