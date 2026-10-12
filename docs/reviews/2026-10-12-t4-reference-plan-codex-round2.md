---
title: "Codex plan review, round 2: T4 reference-lead plan (Revision 1)"
date: 2026-10-12
plan: docs/plans/2026-10-11-feat-t4-reference-lead-plan.md
plan_revision_reviewed: 1 (commit 30311a6)
prompt: narrow re-review of the 7 round-1 fixes; Prior Codex verdicts cited round 1
---

# Round 2 (2026-10-12): NO-GO, one P1

**Verdicts recorded:**

| Run | Verdict | Where |
|---|---|---|
| Run 1 (pasted by Alex; A/B label not confirmed) | **NO-GO** (1 P1, new, caused by Revision 1) | below, verbatim |
| Run 2 | NOT YET RECEIVED | add here if Alex pastes it; stricter verdict wins |

This is the **2nd NO-GO** on this plan: automatic iteration stops. Round 3 only with `Round 3 authorized by Alejandro: YES`.

## Claude Code's check of the finding (2026-10-12)

CONFIRMED, and mine. T5/D6 listed `familiar` as forbidden over the whole reply; the approved reply contains
"familiar songs" (plan line 60 at `30311a6`). Reproduced by running the old rule over the reply text: exactly one hit
(`familiar`); the corrected rule (word list applied to sentences naming the Del; `familiar with`): 0 hits over the 2
sentences naming the Del, and a known-positive ("I've played the Del's beach before.") fires. Fixed in Revision 1b.

## Verdict text (verbatim, run 1)

- **P1-1 — FIXED.** The example now says "Full payment holds the date" (plan:60–63); D2 and D7 correctly defer payment wording to `PAYMENT_SENTENCES` (plan:91–95, 115–118). Source confirms `full` is selected within 14 days (`payment-terms.ts:43–50`).
- **P1-2 — FIXED.** Execution Path now provides four exact lead texts, pinned date, expected classifications, prices, payment terms, and prerequisites (plan:202–218). `runPipeline`'s fifth parameter is `today` (`run-pipeline.ts:89–95`). Expected date arithmetic and rate values match the source (`rates.ts:26–52`).
- **P1-3 — FIXED.** T1–T8 each have mutation, command, and expected assertion (plan:170–184). The runner's semantics match the plan: name matching is supported, failure exits 1, and zero matches exits 3 (`run-tests.mjs:1–7, 57–70`).
- **P1-4 — FIXED.** T2 covers all non-T4 tiers; T6 covers verify exclusion, unchanged `VOICE_REFERENCES`, and the import graph (plan:149–163). `verify.ts:38` uses `VOICE_REFERENCES`, while the generate insertion point is `generate.ts:81`.
- **P1-5 — FIXED.** The plan now labels the runs as a smoke test, sets a one-copy/one-invented-claim/one-untraceable-number failure threshold, and specifies stop-and-rerun behavior (plan:231–235; Feed-Forward:249–257). This remains unexecuted until implementation.
- **P2-6 — FIXED.** The revised references match the source: `generate.ts:81`, `:96`, `:266–267`, Quote Terms `:271`, payment `:272`, setup `:273`; `verify.ts:38` is also correct (plan:27–34, 77–95).
- **P2-7 — FIXED BUT INTRODUCES A NEW BLOCKING DEFECT.** D6 adds explicit public-venue handling, paraphrase checks, and a positive control (plan:109–118, 224–230). The script does read `CHECK_REPO_ROOT` and scans tracked files (`check-venue-history.ts:100–110`), so the control description is accurate.

## New defects in Revision 1

**P1 — T5 is impossible as written.** T5 requires `T4_REFERENCE_REPLY` to contain none of the D6 words, including `familiar` (plan:157–159). But the required verbatim reference still contains "familiar songs" (plan:60). D6 also explicitly claims the example contains none of `familiar` (plan:109–114). The test cannot pass while preserving the approved reply verbatim.

No other new defects found in the bounded sweep.

Runtime behavior remains unexecuted as pre-registered: the real-model runs and mutation checks require implementation first.

## Final verdict: NO-GO

(Codex's attached Claude Code fix prompt asked for: keep the reply verbatim, narrow the forbidden check to venue
claims instead of banning "familiar", update D6/T5 consistently, preserve the venue-leak protection, report root
cause / corrected text / how to confirm / bounded inventory / remaining risks, note runtime is UNEXECUTED, and add no
second review request. Applied as Revision 1b.)
