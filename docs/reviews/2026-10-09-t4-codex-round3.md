# Codex round 3 — flipped T4 rule (`f43210b`)

**Run A (Claude Code, 2026-10-09, at `f43210b`; tree clean after): NO-GO** (1 P1). **Round 3 authorized by Alejandro: YES** ("fix + Round 3 authorized by Alejandro: YES, with the flipped rule"). **Third NO-GO: the HARD CAP FIRED. No round 4; Alex decides what ships.** Run B (Alex) appended if he pastes it.

**Claude Code note (2026-10-09):** the finding is CORRECT about the code: the flip was described as "must be direct" but coded as "not P and not a listed platform", a negative check, the very shape the flip was meant to remove. In practice it is unreachable through the pipeline: `src/pipeline/classify.ts:91,121` reject a missing or non-P/D `lead_source_column`, and the edit pipeline reuses a parsed classification. The fix is one positive condition plus a router test.

## Run A, verbatim

## Verdict: NO-GO

### P1 — T4 does not require `lead_source_column === "D"`

File: `src/pipeline/classify-verify.ts:170`

A T4 classification with `lead_source_column` missing or set to an unexpected value, and no listed platform, passes the “direct” check. With the other conditions satisfied, it receives no T4 hold and `routeLead` can return `auto-send`.

Root cause: the condition rejects only `P` or three platform names instead of positively requiring source column `D`.

Required fix: require `classification.lead_source_column === "D"` and retain the platform exclusion. Add a regression test for missing and invalid source columns through `routeLead`.

Checked clean:

- T4 focused tests: 9 passed
- `runPipeline` focused tests: 20 passed
- `npx tsc --noEmit`: passed
- No files edited; no server, poller, database, network, or browser used


---

**Closed 2026-10-09 (Alex chose option (a): fix and ship; hard cap honoured, no round 4).** `f3c44a2`: a T4 lead with a
missing or unexpected `lead_source_column` fails the "direct" condition and is held. Tested through the matrix and the
real `routeLead`; mutation-checked. Not Codex-reviewed, by Alex's decision. T4 review CLOSED.
