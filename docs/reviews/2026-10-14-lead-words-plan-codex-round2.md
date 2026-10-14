# Codex plan review round 2: the lead_words field, 2026-10-14

**Verdict: NO-GO** (3 P1, 2 P2), pasted by Alex. **Reviewed:** plan Revision 1 at HEAD `3089abe00b...`. Prior verdict: R1 NO-GO,
`docs/reviews/2026-10-14-lead-words-plan-codex-round1.md`. This is the second NO-GO on the same plan: **automatic
iteration stops**; round 3 only with the literal `Round 3 authorized by Alejandro: YES`.

| # | Codex finding | My check | Status |
|---|---|---|---|
| P1-1 | both prompts serialize `sanitizeClassification(classification)`; the plan only says it truncates phrases, so a malformed stored `lead_words` can reach a prompt unchanged | CONFIRMED: `sanitizeClassification` spreads the classification (`src/utils/sanitize.ts:20-33`); it must set `lead_words` from the accessor, and an end-to-end test must cover it (LW10 tests the accessor alone) | valid |
| P1-2 | the negation guard's "word immediately before" is undefined (punctuation, quotes, line breaks, `n't`); `doubt` is exempt without being constrained to a doubt, so an occasion phrase placed in `doubt` bypasses the guard | CONFIRMED: both are open in Revision 1 | valid |
| P1-3 | no tie rule for the modal value with 5 runs (2/2/1), none for missing or error rows; the exact JSON fields are not named | CONFIRMED: the existing comparator sorts by count and compares value sets | valid |
| P2-4 | the control texts (2+2+3+3 = 10) contradict the spend (14 x 2 = 28) and "10 texts" elsewhere; `grep -c` over five logs is not a single pass/fail | CONFIRMED: an arithmetic error of mine (10 texts, 20 verifies); the check is a human-read | valid |
| P2-5 | the controls do not say the planted classifications go through the same accessor/sanitization path; no malformed-stored-field control | CONFIRMED in part: `verifyGate` builds its prompt through `sanitizeClassification`, so planted objects DO take the production path once P1-1 is fixed, but the plan does not say so and has no malformed-stored cell | valid |

Counters: plan fix attempts so far 1 (Revision 1); Codex plan reviews 2 (R1 NO-GO, R2 NO-GO).
