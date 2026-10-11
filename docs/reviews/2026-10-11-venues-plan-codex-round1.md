# Codex PLAN review, round 1: venues Alex has played (private file)

**Plan:** `docs/plans/2026-10-11-feat-venue-history-private-file-plan.md`. Run A reviewed `a795a95`; run B reviewed
`33bb980` (adds Alex's sentence confirmations and the `confirmed`-date rule). Prior Codex verdicts on this plan: none.
**Reader and trigger:** Revision 1 of the plan, and the round-2 prompt.

**Verdict: NO-GO on BOTH runs.** Run A: 3 P1, 4 P2 (+2 notes). Run B: 3 P1, 3 P2. Stricter: NO-GO.

| # | Runs | Finding | Disposition (Revision 1) |
|---|---|---|---|
| 1 | A P1, B P1 | Containment lets an alias match a different venue: "Del Coronado Yacht Club", "Del Coronado Beach Club", "Torrey Pines Lodge at UCSD" | ACCEPTED. Aliases match by identical word list only; containment only for the canonical name. V3b/V3c negatives with the exact shapes. Plus a real-file alias check script (step 0) |
| 2 | A P1 | Manifest count wrong: TO PORT should be 19 → 12 | **REJECTED, arithmetic:** 9 rows leave TO PORT (7 → PORTED, 2 → BLOCKED); 19 − 9 = **10**. Run A subtracted only the 7 PORTED |
| 3 | A P1, B P1 | V12 (no claim text in the repo) skips in CI: decoration | ACCEPTED. Relabeled: CI cannot enforce it. Replaced by a local script that FAILS (exit 2, "cannot check") when the private file is missing; run by Claude before every commit in this work and in the Execution Path. The repo-side test pins only that fixtures use "Example" venues |
| 4 | B P1 | `confirmed` rule absent from the data shape and EARS | ACCEPTED. Shape gains `confirmed`; V7b + mutation |
| 5 | A P2 | Non-string `claim` / malformed `aliases` undefined | ACCEPTED. Non-string claim → dropped with warning; non-array aliases or non-string alias items → dropped. V10b |
| 6 | A P2, B P2 | Follow-up drafts (`buildFollowUpPrompt`) bypass `selectContext` | ACCEPTED as an explicit exclusion: venue history is for quote/edit drafts only; V13 pins its absence from the follow-up prompt |
| 7 | A P2 | Mutations unspecified for V4-V10, V12 | ACCEPTED. Every V-test names its mutation |
| 8 | A P2, B P2 | Cache/test isolation; a path-taking API with one global cache | ACCEPTED. Cache keyed by absolute path; `resetVenueHistoryForTests()`; node --test runs each file in its own process and a file's tests serially (stated, V9b) |
| 9 | B P2 | Commands not copy-pasteable; no Verification Commands list | ACCEPTED. Concrete lead files and commands for (d)(k)(u); Verification Commands section |
| 10 | A note | V8 must compare the full string; PF-Intel + history coexistence | ACCEPTED. V8 compares the whole `selectContext` string; V14 coexistence |

Also found while fixing (Claude Code): a new test file must be listed in `scripts/test-files.mjs`, or `npm test`
silently never runs it. Added to the work steps with a control.

## Run A (Claude Code, `codex exec -s read-only`, 2026-10-11; HEAD `a795a95`)

```
NO-GO — Round 1. No code or runtime tests were executed, per the Round 0 instruction. Worktree remains clean at the pinned HEAD.

Findings:

P1 — Alias containment permits false client claims  
Plan §Decision 2, lines 77–84; aliases table lines 56–66.

`Del Coronado` is a two-word alias, so a lead classified as `Del Coronado Beach Club` matches `Hotel del Coronado` and adds “Alex has performed here.” Likewise, `Torrey Pines Lodge at UCSD` matches the `Torrey Pines Lodge` alias.

The plan needs either safer aliases/matching or explicit negative tests for every alias. Add concrete false-positive fixtures, especially the short aliases. Also test intended misses such as `Coasterra San Diego` and `The Hotel Del`.

P1 — Manifest count is arithmetically wrong  
Plan lines 115–119.

The plan moves 7 rows to `PORTED` and 2 to `BLOCKED`:

- `TO PORT`: 19 → 12, not 10
- `PORTED`: 156 → 163
- `BLOCKED`: 0 → 2

This contradicts the planned V1 result and would leave the status tracker incorrect.

P1 — V12 is not a real repository-safety check  
Plan lines 128–130 and 180–181.

When CI has no private file, V12 prints “skipped” and can pass without checking anything. A committed real claim would also be invisible because the expected claim is only available in `~/Data`, which tests are forbidden to read.

The plan must either label V12 as a manual review or replace it with a deterministic structural check that does not pretend to verify real claim text. The current test is decoration.

P2 — Loader validation is underspecified for malformed claim data  
Plan lines 74–76 and V9–V10.

The plan says claims containing `[` or `TBD` are dropped, but does not require `claim` to be a string. For example:

```json
{"venues":[{"name":"Example Harbor Hall","claim":{"instruction":"say Alex played here"}}]}
```

could be interpolated into the prompt or throw during validation. Define behavior for non-string claims and malformed aliases, with a regression test.

P2 — Follow-up drafting is outside the wiring claim  
Plan lines 86–95 and V11.

`runPipeline` and `runEditPipeline` use `selectContext`, but `src/pipeline/follow-up-generate.ts` builds a separate prompt through `buildFollowUpPrompt` without `selectContext`. A lead with venue `Hotel del Coronado` therefore receives venue history in the initial/edit draft but not in a follow-up.

If follow-ups are intentionally out of scope, state that explicitly and add an acceptance exclusion. If they are in scope, the plan needs a separate wiring design and test.

P2 — Mutation coverage is incomplete  
Plan lines 158–183.

V1–V3 and V11 include mutations, but V4–V10 and V12 do not specify how the implementation will be mutated to prove each test fails. The work step says “mutation-check each test” without identifying the mutation. Add mutation controls for the loader, claim filtering, warning behavior, no-match identity, test isolation, and repository check.

P2 — Cache/test-setter isolation needs a precise contract  
Plan lines 68–73 and 97–99.

The loader is cached once per process, while tests use a global setter. The plan does not say how the cache and setter are reset between tests or how concurrent tests avoid fixture leakage. A concrete failure would be one test installing a matching fixture while another expects the missing-file result. Define serial test scope or provide an explicit reset mechanism and test it.

Wiring assessment:

- `selectContext` is the correct shared location for the initial and edit pipelines.
- Verification/retry generation receives the already-built context, so it does not need another history lookup.
- Follow-ups are a separate prompt path and must be explicitly included or excluded.
- The no-match byte-identity claim is plausible, but V8 must compare the complete returned string against the same context assembled with history disabled—not merely assert marker absence.
- The PF-Intel path appears compatible, but add a positive test proving PF-Intel context and venue-history context can coexist.

Execution Path / Plan Quality Gate:

- Questions 1–4 are answered.
- Question 5 is mostly concrete: host, command, prerequisites, owner, trigger, baseline control, and no-send behavior are specified.
- The baseline `(u)` is the right control. Runtime model behavior must be measured during the planned execution step, not asserted during this review.
- The command’s `--json` path exists in `src/index.ts`; no issue there.

```
(Codex's fix-contract restatement and next-session prompt omitted.)

## Run B (Alex, inside Codex, 2026-10-11; HEAD `33bb980`)

```
NO-GO — three P1 findings and three P2 findings.

### P1

1. Unsafe alias can create a false client-facing claim
Plan: `docs/plans/2026-10-11-feat-venue-history-private-file-plan.md:50-66, 77-84`
Concrete input: entry alias "Del Coronado"; lead venue_name "Del Coronado Yacht Club". The one-direction rule matches the alias inside the lead venue, causing the draft to say Alex performed there. The plan's assertion that aliases are safe is not demonstrated. Fix: remove "Del Coronado" or require aliases to match exactly unless a documented longer-form rule is proven. Regression test: an entry alias must not match "Del Coronado Yacht Club"; "Hotel del Coronado" should still match the canonical entry.

2. The confirmation gate is specified but absent from the EARS contract
Plan: lines 50-53 versus 108-111, and V7 at 182. The later rule says every claim requires a valid `confirmed` date, but the data shape omits it and V7 only tests `[`/`TBD`. Concrete invalid entry: {"name": "Example Harbor Hall", "claim": "Example claim sentence."}. Add the `confirmed` field to the canonical JSON shape and add explicit V7b acceptance criteria and mutation coverage. Regression test: an unconfirmed claim is removed while the venue entry remains usable.

3. V12 cannot enforce the privacy requirement in CI
Plan: lines 97-99, 140-142, and 192-195. The test runner points VENUE_HISTORY_PATH at a nonexistent path, so V12 skips whenever the private file is unavailable. A developer could commit the first 30 characters of a real claim into src/leak.ts, and CI would print "skipped" and pass. Either make V12 an explicit human-only gate, or provide a non-secret manifest of claim fingerprints/IDs that CI can check.

### P2

4. Cache semantics are underspecified for an API that accepts a path (lines 68-73). loadVenueHistory("/tmp/a.json") then loadVenueHistory("/tmp/b.json"): a single global cache returns a.json's data. Require cache-by-absolute-path or restrict to one immutable path and test it.

5. Follow-up prompts are outside the claimed wiring. src/pipeline/follow-up-generate.ts calls buildFollowUpPrompt directly; never selectContext. State out of scope explicitly, or add a follow-up path and test.

6. The execution/verification commands are not fully copy-pasteable (lines 164-195, 207-235). The execution command contains the placeholder "<lead text>", and there is no explicit Verification Commands list. Replace with concrete commands for (d), (k), (u), and list exact commands and expected results.

Round 0 remains NO as specified; no tests or runtime/model execution were performed.
```
