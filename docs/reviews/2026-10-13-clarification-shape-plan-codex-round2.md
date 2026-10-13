---
date: 2026-10-13
phase: plan review, round 2
subject: docs/plans/2026-10-13-fix-clarification-draft-shape-plan.md (Revision 1, HEAD 43b9920)
prior_verdicts: docs/reviews/2026-10-13-clarification-shape-plan-codex-round1.md (NO-GO)
verdict: NO-GO (three P2, all consistency / counting; no P1)
---

# Round 2 (plan): NO-GO. The 2nd NO-GO: automatic iteration STOPS.

One run. Pasted by Alex 2026-10-13; findings verbatim, the appended fix prompt summarized (its three numbered items
map one to one onto the three new defects below). Round 3 only with the literal
`Round 3 authorized by Alejandro: YES`; a 3rd NO-GO is the hard cap.

## Prior findings (verbatim, condensed to the verdict lines)

1. **R1 P1 D1 concern coverage: FIXED.** Step 3 is retained as a bundled sentence (plan 67-69); P1 and P8 test its
   presence and removal mutation (plan 125-147). P8 proves the prompt requests traceable coverage; it does not claim
   to prove model compliance, which is left to the measurement.
2. **R1 P1 Arm identity and ordering: FIXED BUT INTRODUCES a manifest-field inconsistency.** The manifest fields and
   mechanical checks (plan 175-183) are sufficient to establish prompt identity (A matches the pre-change hash, B the
   post-change hash, the ancestry check confirms ordering). New defect: the text says the five manifests may differ
   by "the process tag," but `processTag` is not a listed manifest field.
3. **R1 P2 Estimand and denominator: FIXED.** The primary rate is over all 50 runs (plan 190-194); exploratory
   framing and power limits are stated (plan 196-199); the power figures are arithmetically plausible.
4. **R1 P2 Word range: FIXED BUT INTRODUCES a sentence-count verification gap.** D2 chooses 70-100 words (plan
   72-75) and P2 uses it (plan 128-129). New defect: D2 also adds "4 to 6 sentences", but the decision table and the
   runner record only word count (plan 210, 230-232).
5. **R1 P2 P4/P5 inventory and refresh: FIXED.** Cases and files named (plan 151-159), refresh rule (plan 161-163),
   unique-anchor checks and controls (plan 120-140).
6. **R1 P3 Opening wording: FIXED.** D1 says "a fact or an uncertainty the lead supplied" (plan 63-64), matching the
   forcing rule (`src/prompts/generate.ts:350`).

## New defects (verbatim)

- **P2 -- Manifest process-tag field is referenced but not defined.** plan 175-181.
- **P2 -- The new 4-6 sentence requirement is not recorded or included in the measurement decision rule.** plan 72-74.
- **P2 -- Output-count error:** the plan says "ten JSON files per arm," but five processes produce one file each, so
  the expected count is five per arm and ten total. plan 234-241.

Final verdict: **NO-GO**. Review environment note: the process-list check was blocked (`ps`/`pgrep`); no repository
evidence of concurrent writing.

## Claude Code's check (2026-10-13)

| Finding | Check (`grep` on the plan) | Result |
|---|---|---|
| process tag | line 180: "identical in every field except the process tag"; the manifest field list (line 175-178) has no tag field | **Valid.** The tag is in the file name and `--tag`, not in `manifest`. |
| sentence count | line 72-73 says "4 to 6 sentences ... used identically in P2, the decision table and Expected"; the decision table (line 210) has the words row only; the runner records word count only | **Valid**, and the "used identically" claim is false. |
| ten files | line 240: "the ten JSON files per arm"; five processes x one file = five per arm, ten in total | **Valid.** |

All three accepted. Each is plan prose or a one-line consistency fix; none touches code.
