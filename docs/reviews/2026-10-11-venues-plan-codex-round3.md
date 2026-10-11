# Codex PLAN review, round 3: venues Alex has played (private file)

**Plan:** `docs/plans/2026-10-11-feat-venue-history-private-file-plan.md` at `a028e84` (Revision 2). **Round 3
authorized by Alejandro: YES** (2026-10-11, after the 2nd NO-GO). Prior Codex verdicts: round 1 NO-GO both runs,
round 2 NO-GO both runs.
**Reader and trigger:** Revision 3 of the plan; the work phase.

**Verdict: NO-GO on BOTH runs. HARD CAP fired: no round 4.** Both runs: every round-2 finding closed; no matcher,
exit-code, isolation, command or design blocker left. Run A: 2 P2. Run B: 1 P2, 1 P3. All fixed in Revision 3
under the fix contract; work starts on the revised plan.

| # | Runs | Finding | Disposition (Revision 3) |
|---|---|---|---|
| 1 | A P2, B P2 | "What must not change" still says the privacy line is "enforced" by the bounded sentinel (a paraphrase or a <30-character copy passes) | FIXED. The gate is Claude Code reading every staged diff before each commit; the sentinel is named a bounded backstop everywhere |
| 2 | A P2 | V15 needs `tableRows`, which is local to `src/port-manifest.test.ts` and not exported | FIXED. V15 goes in `src/port-manifest.test.ts` beside it (file added to the change table as F2); no new sharing |
| 3 | B P3 | Stale "V1-V14" and "made-up venues only" once V15 exists | FIXED. V1-V14 stay in the new file; V15 named as the one test reading the real public manifest |

Also in Revision 3 (Alex, 2026-10-11, outside the Codex runs): the `confirmed` date is a label, not proof Alex approved
a sentence. The plan no longer claims otherwise; the gate is his yes in chat (project `CLAUDE.md` rule, memory
`feedback_venue-sentences-need-alex-yes`).

## Run A (Claude Code, `codex exec -s read-only`, 2026-10-11; HEAD `a028e84`)

```
NO-GO — Round 3. The hard cap fires; there is no Round 4.

Round-2 findings are closed: V15 mapping, sliding-window sentinel, exit-1 control, calendar dates, and `test-files.mjs`.

Findings:

- **P2 — Privacy requirement still overclaims what the sentinel proves.**  
  Plan lines 136–140 correctly call it bounded, but lines 186–187 still say “No source text in the repo” is enforced by that check.  
  Failing input: a claim shorter than 30 characters, such as `"Alex played here."`, appears in a tracked file; the sentinel finds no 30-character window and passes.  
  Fix the requirement to state the bounded guarantee and require a human tracked-diff review for full-source absence.

- **P2 — V15 leaves the implementation boundary for `tableRows` ambiguous.**  
  Plan lines 264–266 require row-by-row assertions “by id (`tableRows`)”, but `tableRows` is local to `src/port-manifest.test.ts:11` and is not exported. The plan’s file list does not authorize changing that file.  
  Concrete input: R085 remains `TO PORT` while R086 becomes `PORTED`; implementation must specify whether to duplicate the parser, export/share it, or use another exact row-map assertion.  
  State the intended helper/test-file change explicitly.

No runtime tests were run, as required for this review; runtime behavior remains for the Execution Path before code review.
```

## Run B (Alex, inside Codex, 2026-10-11; HEAD `a028e84`)

```
NO-GO — Round 3. No tests or runtime execution performed.

Revision 2 closes all five round-2 findings:

- V15 checks the exact nine row statuses.
- The leakage sentinel checks every 30-character window.
- Exit 1 has a macOS/zsh-compatible known-answer control.
- `test-files.mjs` is correctly left unchanged; its glob already includes the new test.
- Calendar validation covers `2026-99-99` and `2026-02-30`.

Remaining findings:

P2 — The privacy requirement still contradicts the bounded-check limitation
Plan: lines 136-140, 186-187. Decision 5 correctly says the sentinel is not proof: it misses paraphrases, line splits, and claims shorter than 30 characters. But "What must not change" still says that no source text in the repo is "enforced" by this check.
Concrete failing input: a committed paraphrase of Alex's sentence, or an exact copied claim shorter than 30 characters. The sentinel passes, contradicting the stated enforcement claim.
The plan should call this a bounded leakage sentinel everywhere and explicitly retain human tracked-diff review as the privacy gate.

P3 — Revision 2 leaves stale V1–V14 wording
Plan: lines 164-170, 212-214. The file-change table still says `src/port-manifest-venues.test.ts` contains "EARS tests V1-V14," while V15 was added. The next paragraph also says all tests use made-up venues only, but V15 necessarily reads real public `port-manifest.md` rows through `tableRows`.
Concrete failing input: implementing V15 in the planned test file makes both statements false.
Update the wording to V1–V15 and identify V15 as the public-manifest exception.

No remaining matcher, exit-code, isolation, command, or design-choice blocker was found. Round 3 is the hard cap; there is no round 4.
```
