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

## Answers (plan Revision 1b; Alex chose "Fix the 5, then authorize round 3")

| # | Answer |
|---|---|
| P1-1 | `sanitizeClassification` sets `lead_words` from `leadWordsOf`; LW14 is end to end (malformed string, array, numeric member, 81-character member all build prompts byte-equal to all-null); a bounded classification-to-prompt inventory is in the plan |
| P1-2 | token-level negation guard (token = run of letters, digits, apostrophes; "no" in "know" is not a match; a whole `n't` token; punctuation, quotes and line breaks separate tokens); `doubt` kept only with a bounded doubt marker and never equal to the occasion or time frame |
| P1-3 | per (lead, field): counts per value over 5 rows, mode with the smallest-value tie-break, error rows as `__error__`; exit 1 on a changed mode, a rise of 2 off-mode runs, or any new error row; malformed file exits 2; fields read named |
| P2-4 | 12 texts (cells A-E), 24 verifies, 24 calls; one `RESULT=PASS|VOID` line computed from failed jobs, usage-limit count, file count and the two exit statuses |
| P2-5 | planted classifications go through `verifyGate` and so `sanitizeClassification`; a malformed-stored cell E, with a `leadWordsOf` assertion before any model call |

**Round 3 is NOT generated yet:** the literal `Round 3 authorized by Alejandro: YES` has not been written by Alex (the
option was chosen in a chooser, which is not that line).
