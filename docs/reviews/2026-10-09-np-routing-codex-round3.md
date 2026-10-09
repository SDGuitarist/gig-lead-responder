# Codex round 3 — NP routing PTO fix (`d6e0323`)

**Verdict: NO-GO** (2 P2). **Round 3 authorized by Alejandro: YES** (2026-10-09, his words: "fix and Round 3 authorized by
Alejandro: YES"). **Third NO-GO: the HARD CAP FIRED. No round 4; Alex decides what ships.** Run B (Alex) recorded first;
run A (Claude Code) appended when it lands. Both findings are about the limits of a keyword BACKUP behind the classifier's
`nonprofit_buyer`: one is extra holds only (never a wrong price out), the other is misses the classifier must catch first.

## Run B (Alex), verbatim

## Verdict: NO-GO

- P2 — `src/pipeline/classify-verify.ts:22,26-28`: the detector still falsely holds ordinary corporate/private leads such as an employee “benefit dinner,” or paid-time-off text that also mentions a school. Root cause: broad words and PTO context are combined with an OR-style backup detector, without requiring nonprofit-specific context. Required fix: add regression cases for these false positives and narrow the signals or require stronger contextual matches.
- P2 — `src/pipeline/classify-verify.ts:22-28`: clear nonprofit organizations without the listed keywords can be missed, for example a YMCA or similar nonprofit event without “fundraiser,” “gala,” “foundation,” PTA, or PTO. Root cause: the detector is a fixed keyword list rather than an explicit organization allow-list or a documented lower-bound detector. Required fix: add an approved organization/signal list and regression tests, or explicitly narrow the contract so this backup is not claimed to catch all clear nonprofit leads.

The PTO-specific bare-word regression is fixed, but the whole-detector uncertainty is not resolved. The Tier A bypass still produces a nonprofit hold through the later nonprofit branch.

## Checked clean

- `npm run test:match -- "port manifest R403"` — 128 passed.
- `npm run test:match -- "tier A venue hold"` — 121 passed.
- `npx tsc --noEmit` — passed.
- Revert-test concern: the added PTO tests are mutation-sensitive according to the commit evidence.

## Run A (Claude Code), verbatim: GO

The two runs of the same prompt DISAGREE (run A GO, run B NO-GO with 2 P2). Treated conservatively: the round counts as NO-GO and the hard cap stands; Alex decides what ships.

## Verdict: GO

No P1, P2, or P3 findings.

- `PTO` now requires school-related context.
- Paid-time-off examples remain unheld.
- Clear nonprofit signals, PTA, parent-teacher, and foundation cases remain covered.
- Tier A skipping still applies only when classified or detected as nonprofit.
- Regression tests are mutation-sensitive: reverting the PTO condition would fail the paid-time-off cases.

Checks passed:

- R403 tests: 128 passed
- Tier A venue tests: 121 passed
- `npx tsc --noEmit`
- Worktree clean

Checked clean.


---

**Closed 2026-10-09 (Alex chose option (a); hard cap honoured, no further Codex round).** `4c4b2fa`: the backup's
contract is stated in code (a minimum safety net behind `nonprofit_buyer`, not a complete detector) and named
nonprofits are caught by name (YMCA, YWCA, Rotary, Kiwanis, Lions Club, Boys & Girls Club, Junior League; tested,
with ordinary-word controls). Remaining extra holds (e.g. an employee "benefit dinner") are accepted as the cost of
failing safe; misses with no keyword are left to the classifier (HANDOFF known gap). NP routing review CLOSED.
