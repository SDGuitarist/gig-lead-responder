# Codex plan review round 2: verify gate opening rule for a quoted vague lead, 2026-10-14

**Verdict: NO-GO** (3 P1, 1 P2), pasted by Alex. **Reviewed:** plan Revision 1 at HEAD `99f712ab91...`. Prior verdict:
R1 NO-GO, `docs/reviews/2026-10-14-vague-gate-plan-codex-round1.md`. Codex stated that the sign test is appropriate and
that the inventory counts, the retained S8 fixture, the verification commands, the sending boundary and the work-step
order answer round 1. This is the second NO-GO on the same plan: **automatic iteration stops**; round 3 only with
the literal `Round 3 authorized by Alejandro: YES`.

| # | Codex finding | My check | Status |
|---|---|---|---|
| P1-1 | `replay_mode verified` / `replay_default verified` are undefined: `verifyGate` returns a `GateResult`, and the plan says "gate-only" | CONFIRMED in the plan's table and decision rows. The value to compare is `gate_status === "pass"` (the gate's own rule), post-check excluded on purpose | valid, small |
| P1-2 | the mode includes a lead that named "a solo guitarist", but the text lists three anchors and calls the format assumed | CONFIRMED: the text says the format is not a supplied fact "unless `format_requested` shows the lead named it", yet the minimum-anchor list has no format anchor, and S16 covers only non-solo/duo. A real contradiction | valid; a behaviour of the prompt predicate |
| P1-3 | the control rows can pass for the wrong reason: a generic opening passing once, or a specific one failing once, is not a stop | CONFIRMED: my rule needed BOTH verifies, which hides a single-call false pass | valid |
| P2-4 | VG4's spy proves `verifyGate` without options, not that every production call site omits the option | CONFIRMED: `grep verifyGate src` is not in the plan as a bounded inventory | valid |

Counters: plan fix attempts so far 1 (Revision 1); Codex plan reviews 2 (R1 NO-GO, R2 NO-GO).

## Answers (plan Revision 1b; Alex chose "Accept, fix the 4, build"; no round 3)

| # | Answer |
|---|---|
| P1-1 | `pass` = `gate.gate_status === "pass"` is the recorded value; the comparison uses `replay_mode.pass` and `replay_default.pass` only; a `replay_error` run is excluded and reported; post-check excluded on purpose |
| P1-2 | the vague-quote text gains a fourth anchor, "a format the lead itself named" (visible in `format_requested`); an app-chosen format is not an anchor; S17 and VG9 added |
| P1-3 | asymmetric rules: ANY generic text passing in EITHER verify is a control defect and stops; 2 or more specific texts failing in at least one verify stops |
| P2-4 | VG10: a bounded call-site inventory (three sites, three arguments, none with `openingRule`) plus a spy through `runWithVerification` |
