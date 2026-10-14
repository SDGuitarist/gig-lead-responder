---
date: 2026-10-13
phase: plan review, round 1
subject: docs/plans/2026-10-13-fix-clarification-internal-terms-plan.md (Revision 0, HEAD d28813d)
prior_verdicts: none
verdict: NO-GO (4 P1, 2 P2)
---

# Round 1 (plan): NO-GO, 4 P1, 2 P2

One run. Pasted by Alex 2026-10-13; findings verbatim, the appended fix prompt summarized (its seven bullets map onto
the six findings). Claude Code's check is in the last table.

## Findings (verbatim)

P1 -- The diagnosis is not fully supported by the named evidence, and the replay expectation contradicts the plan.

- `docs/plans/2026-10-13-fix-clarification-internal-terms-plan.md:22-35` claims 172 runs and 816 distinct drafts, but
  the named shape-measurement file documents only the two 50-run arms and four observed false rejects. The 172
  arithmetic is correct (`18 + 3x18 + 2x50`), but the 816-draft inventory and its six term occurrences are not
  present in the files reviewed.
- The plan says `investment` occurs among the six ordinary uses (`:32-35`), keeps `investment` rejected (`:52-53`,
  `:109-111`), then expects the new replay pattern to match zero drafts (`:140-141`). If an ordinary stored draft
  contains `investment`, the new pattern must still match it. Resolve the inventory and expected count before
  implementation.

P1 -- The proposed possessive form still knowingly rejects ordinary prose.

At `:57-60`, the third alternative rejects any `my anchor` or `our floor`, except for three floor-following words.
Therefore it still rejects ordinary sentences such as: "My anchor is my family." "Our floor is upstairs." "Our floor
is crowded tonight." This directly leaves open the user-facing false positives the plan is meant to remove. Either
narrow these forms further, or explicitly accept and document this residual false-reject boundary with Alex's
approval and tests.

P1 -- The grammar misses plausible plural pricing leaks.

The second alternative uses singular word boundaries `(?:price|rate|quote|pricing)\s+(?:anchor|floor)\b`, so `price
anchors`, `price floors`, `rate anchors`, and `rate floors` pass. The plan calls the alternatives "pricing-noun forms"
(`:71-75`) but does not state that plural forms are excluded. Add plural coverage or document this as an intentional
limitation with tests.

P1 -- Amending V4a changes a previously explicit guarantee and needs a settled decision.

The change is visible at `:61-63` and in the EARS test at `:100-102`, which is good. However, the previous test
explicitly rejected "The anchor for this is a conversation" (`src/clarification-validator.test.ts:80`), and the
earlier plan described bare `anchor` and `floor` as an intentional guarantee. "Stated here for Alex" is not evidence
that Alex approved weakening it. The plan should mark this as pending human approval, or cite the approval before
work begins.

P2 -- V15 is largely redundant and its mutation map does not prove the named alternatives independently.

`V12` already exercises the ordinary forms listed at `:104-106`; V15 adds volume but no new semantic cases
(`:112-113`). The mutation map also overclaims isolation: removing the third alternative cannot make amended V4a fail,
because "My anchor price" still matches the first alternative; the combined V13 test can remain green for the wrong
reason when one alternative is removed. Split these into per-alternative tests or state that the mutations are
aggregate coverage only.

P2 -- The replay is sound as an observational check, but its limits and inputs are underspecified.

Comparing the old and new regex over stored drafts is a reasonable deterministic regression check. It cannot
establish pricing recall on unseen drafts, and the stored drafts were generated under the old validator/prompt
behavior. The execution command uses placeholder directories (`:133-137`), while the repo currently contains no
stored result files under the stated paths. Record the concrete source directories and a deterministic missing/empty
input failure. Do not describe "816 distinct drafts" as independently reproducible until those inputs or their
provenance are available.

No ReDoS finding.

Verdict: **NO-GO**

## Claude Code's check (2026-10-13)

| Finding | Check | Result |
|---|---|---|
| Evidence not in the files named | The 816 distinct drafts are in session-local result files (`q1`, `q2`, `q3`, `armA`, `armB` in the session scratchpad: 19 files, 154 runs); the committed record has only the four rejection contexts. Re-derived: 96 + 106 + 100 + 260 + 254 distinct drafts, matches `anchor` 3, `anchors` 2, `floor` 1. The earlier 18-run rerun is NOT in that corpus (an older file format), so the corpus is 154 runs while the rejection count is over 172. | **Valid.** |
| `investment` among the six | **My misstatement.** The six matches are `anchor` (3), `anchors` (2), `floor` (1); `investment` occurs 0 times. The plan's sentence listed the four words searched, not four words found. There is no contradiction in the expected count. | **Valid** (wording), fixed. |
| Possessive rejects ordinary prose | "My anchor is my family", "Our floor is upstairs" match `my anchor` / `our floor`. | **Valid.** |
| Plural pricing forms | `price anchors` does not match `(anchor|floor)\b`. | **Valid.** |
| V4a amendment needs approval | The plan said "stated here for Alex". | **Valid:** marked PENDING ALEX; asked in chat. |
| V15, mutation isolation | V12 covers the ordinary forms; "My anchor price" matches alternative 1, so removing alternative 3 cannot fail V4a. | **Valid.** |
| Replay inputs | The command used `<scratchpad>` placeholders. | **Valid.** |

All six accepted; none rejected.
