# Codex code review, round 2: lead_words build

Reviewed HEAD: d6461672302ae071a3397ab8d6b17836a8f9db2b. Verdict: **NO-GO** (1 P1, 1 P2). Second NO-GO on this change:
automatic iteration stops. A round 3 needs the literal `Round 3 authorized by Alejandro: YES`.

Codex confirmed the three round 1 fixes hold (opening-false over all runs; `groundingRun` calls production `classifyLead`;
the runner reads through `leadWordsOf`). Sandbox-blocked socket/IPC tests were UNEXECUTED on Codex's side.

## My check table

| # | Finding | Reproduced? | Verdict | Fix | Test (fails without the fix) |
|---|---|---|---|---|---|
| P1-1 | `src/lead-words-measure.ts` parsed the captured text with a regex that does not trim before stripping fences; production trims first (`stripCodeFences`). A fenced retry response with surrounding whitespace was accepted by `classifyLead` but recorded as all-null, inflating the dropped-phrase rate. | Yes: the new test failed before the fix | Valid | `stripCodeFences` exported from `src/claude.ts` and used by the seam: one cleaner, not two | LW15 fenced retry: requester called twice, raw phrase in `returned`, grounded phrase in `kept`; positive control: unfenced response, one call |
| P2-2 | The raw-read allowlist scanned dot access only; destructuring and bracket reads would evade it. | Yes: by reading the scanner | Valid | `rawLeadWordsReads` counts dot, string-literal bracket, object destructuring (declaration, parameter, assignment pattern) | LW15 scanner controls: 8 reads rejected, 4 allowed (accessor, other property, literal write, shorthand write) |

Inventory re-run over `src/` and `scripts/` with the stronger scanner: **identical** to the round 1 allowlist
(`src/lead-words.ts` 1, `src/pipeline/classify.ts` 4, `src/lead-words-measure.ts` 2, `src/utils/sanitize.ts` 1,
`scripts/clarification-arm-report.ts` 1). No new exceptions; no destructuring or bracket reads exist.

## Mutations (all caught)

| Row | Mutant | Result |
|---|---|---|
| 18 | seam back to the untrimmed regex | fenced-retry test fails |
| 19 | scanner without the bracket-access branch | scanner controls fail |
| 20 | scanner without the binding-element branch | scanner controls fail |

## Verification

`npm test`: 1143 tests, 1142 pass, 0 fail, 1 skipped. `tsc --noEmit` clean. Leak check exit 0.

## Remaining risks

- The scanner is lexical over TypeScript syntax: a read through a computed key held in a variable (`c[k]`) is not caught.
  No such read exists; it would need a runtime guard, which is a new subsystem and out of scope.
- Real-model measurement (regression, grounding, arm, controls) is still UNEXECUTED and needs Alex's "go".
