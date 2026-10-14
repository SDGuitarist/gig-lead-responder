# Codex plan review round 1: verify gate opening rule for a quoted vague lead, 2026-10-14

**Verdict: NO-GO** (5 P1, 3 P2), pasted by Alex. **Reviewed:** `docs/plans/2026-10-14-fix-vague-quote-gate-opening-plan.md`
Revision 0 at HEAD `07537deb24...`. Codex's sandbox blocked three tests with `listen EPERM`; its "22 matching tests,
0 matching failures" is a focused run, not a clean full suite.

| # | Codex finding | My check | Answer in Revision 1 |
|---|---|---|---|
| P1-1 | the paired verifier comparison is not specified (two calls, fields, retries, noise) | CONFIRMED: Revision 0 said "re-verifies" without fields; `verifyGate` has no way to pass the rule | "The paired measurement" table: `pipeline`, `replay_mode`, `replay_default`, `replay_error`; noise floor printed |
| P1-2 | the 3-of-10 and gain-of-8 thresholds are asserted, and the 10 control verifies reuse 5 texts | CONFIRMED: both numbers were mine; repeats are not independent | the table is descriptive; stop rules per TEXT; the gain is read by an exact sign test, with its reasoning |
| P1-3 | the predicate covers every resolved format but only `solo`/`duo` is inventoried | CONFIRMED by reading the paths: the classifier can set any resolved format | predicate narrowed to `solo`/`duo`; production paths enumerated; S16 pins a non-solo/duo format as unchanged |
| P1-4 | VG4 compares to a "pre-change S8" that is refreshed in place | CONFIRMED: no retained artifact | `S8-pre-vague-gate.txt` retained in the commit that adds S13-S16; VG4 and VG7 use it |
| P1-5 | no `Verification Commands` list | CONFIRMED | section added with exact commands and expected results; the EPERM limit stated |
| P2-6 | the runner seam is underspecified while `verify.ts` is frozen | CONFIRMED: `validateGateResult` is not exported | `verifyGate` gains an optional pass-through (one parameter); validator and retries untouched |
| P2-7 | no duo assumed-format negative control; the minimum anchor is unclear | CONFIRMED | a duo fail example (VG8), and the three anchors with "any one is enough" |
| P2-8 | "passing does not authorize sending" is not stated operationally | CONFIRMED: only in Expected | "Sending boundary" paragraph in the decision table |

Counters: plan fix attempts so far 1; Codex plan reviews 1 (R1 NO-GO). A second NO-GO stops automatic iteration.
