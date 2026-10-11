# Codex PLAN review, round 2: venues Alex has played (private file)

**Plan:** `docs/plans/2026-10-11-feat-venue-history-private-file-plan.md` at `41265aa` (Revision 1). Prior Codex
verdicts: round 1 NO-GO on both runs (`docs/reviews/2026-10-11-venues-plan-codex-round1.md`).
**Reader and trigger:** Revision 2 of the plan; Alex's round-3 decision.

**Verdict: NO-GO on BOTH runs.** Run A: 2 P2. Run B: 1 P1, 1 P2, 1 P3. Stricter: NO-GO. **This is the 2nd NO-GO:
automatic iteration stops; round 3 only with Alejandro's explicit YES.** Both runs: every round-1 finding closed;
the count rejection (19 − 9 = 10) confirmed correct; the alias fix accepted; the same-city residual accepted.

| # | Runs | Finding | Disposition (Revision 2) |
|---|---|---|---|
| 1 | B P1 | The manifest test never checks WHICH rows changed: R085 left TO PORT and another row marked PORTED would pass | ACCEPTED. V15 asserts the exact status of all 9 rows (R081-R084, R087, R088, R405 = PORTED; R085, R089 = BLOCKED). Mutation: swap R085 and another row |
| 2 | A P2 | Check (iii) searches only the first 30 characters: a committed middle of a sentence passes | ACCEPTED. Every 30-character window of each claim (sliding, step 1) is searched; described as a bounded local sentinel, not proof |
| 3 | B P2 | No command demonstrates exit 1 | ACCEPTED. Known-answer control: a temp venue file whose claim's MIDDLE window is a line in a temp file tracked in a throwaway git repo (`CHECK_REPO_ROOT`) → exit 1 |
| 4 | A P2 | `scripts/test-files.mjs` already globs `src/**/*.test.ts`; the planned entry would duplicate it | ACCEPTED. **Claude Code's round-1 "also found" note was wrong, written without opening the file.** Step removed; inclusion control `npm run test:match -- "port manifest venues"` |
| 5 | B P3 | `"confirmed": "2026-99-99"` passes the shape regex | ACCEPTED. Calendar check (`Date.UTC` round-trip); V7b gains `2026-99-99` and `2026-02-30` |

## Run A (Claude Code, `codex exec -s read-only`, 2026-10-11; HEAD `41265aa`)

```
NO-GO — Round 2. Automatic iteration stops; Round 3 requires `Round 3 authorized by Alejandro: YES`.

The identity gate passed: clean worktree, branch `feat/hub-phase0`, HEAD `41265aa1aef5c6af5e92e7339a78bbc228a8b55e`. `ps` was unavailable due macOS `EPERM`; no Git evidence of another writer or auto-continue exists.

Findings:

P2 — Decision 5(iii) is only a prefix check, not a full privacy check  
Plan lines 123–131, 178–179, 248.

Concrete input: a private claim is 80 characters, but a tracked file contains only characters 31–80. The check passes because it searches only the first 30 characters.

The plan honestly states CI cannot enforce this, but must not describe the local check as proving “no source text in the repo.” Rename it as a bounded first-30-character leakage sentinel and add an explicit human review of tracked diffs, or define a non-secret fingerprint check.

P2 — `test-files.mjs` disposition does not match the actual runner  
Plan lines 157–163, 260–263; `scripts/test-files.mjs:4`.

The runner already includes every `src/**/*.test.ts` file. Adding `src/port-manifest-venues.test.ts` explicitly would duplicate it; removing that explicit entry would not stop it from running. The intended mutation/control therefore does not test the claimed requirement.

Revise the plan to leave `test-files.mjs` unchanged and verify inclusion with:

```sh
npm run test:match -- "port manifest venues"
```

Expected result: matched tests run and pass.

Round-1 closures otherwise hold:

- Alias false positives are addressed; canonical containment and alias exact-match behavior are internally consistent.
- The count rejection is correct: `19 - (7 PORTED + 2 BLOCKED) = 10`.
- Exit `2` for missing, `1` for failed validation/check, and `0` for pass are distinguishable.
- V1–V14 name mutations, including V9b/V12 isolation.
- Same-city residuals are explicitly accepted.
- Execution commands and expected outcomes are substantially copy-pasteable.
- No runtime/model conclusions were drawn; execution remains required before code review.

I did not run the pipeline, server, poller, network, sends, or access `~/Data`/`data/leads.db`. The attempted plan-gate command hit the known sandbox `tsx` listen `EPERM`.

```
(Codex's fix handoff omitted.)

## Run B (Alex, inside Codex, 2026-10-11; HEAD `41265aa`)

```
NO-GO — Round 2. No tests or runtime execution performed.

Revision 1 closes the round-1 findings. The arithmetic rejection is correct: 7 `PORTED` + 2 `BLOCKED` = 9 rows; `19 - 9 = 10`.

P1 — Manifest test does not prove the planned rows changed
Plan: `docs/plans/2026-10-11-feat-venue-history-private-file-plan.md:165-169, 204-206`; test: `src/port-manifest.test.ts:52-99`
The test checks that a marker and named test exist somewhere in the test file, not that R081/R082/R083/R084/R087/R088/R405 are exactly the rows marked `PORTED` and R085/R089 exactly `BLOCKED`.
Concrete failing input: leave R085 as `TO PORT`, mark a different row `PORTED`, and reuse the same marker/test name. Counts and current structural checks can still pass while the wrong row is ported.
The plan needs an exact row-to-status mapping assertion or row-specific test names.

P2 — Exit 1 lacks a verification command
Plan: lines 123-131, 255-279. Exit 0 and exit 2 are distinguishable and specified. Check (iii) is a real local check when the private file exists, and the CI limitation is stated honestly. But no copy-pasteable control demonstrates exit 1.
Concrete failing input: a temporary venue file whose claim's first 30 characters appear in a tracked repository file. The verification section should expect exit 1 for that case.

P3 — "Valid confirmed date" only validates formatting
Plan: lines 60-63, 90-92, 229-230. Concrete input: "confirmed": "2026-99-99" matches the specified regex and could allow the claim through. Either document that only shape is intended, or add calendar-date validation.

Matcher review is otherwise acceptable: aliases match exactly after normalization; only canonical names use 2+ word containment. The documented same-city residual is accepted. Round 3 requires Alejandro's explicit authorization.
```
