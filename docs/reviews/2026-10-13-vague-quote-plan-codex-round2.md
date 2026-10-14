---
date: 2026-10-13
phase: plan review, round 2
subject: docs/plans/2026-10-13-feat-vague-lead-quote-with-question-plan.md (Revision 1, HEAD 81b1a82)
prior_verdicts: docs/reviews/2026-10-13-vague-quote-plan-codex-round1.md (NO-GO)
verdict: NO-GO (one P1 and one P2, both in the measurement text; the six round 1 items FIXED)
---

# Round 2 (plan): NO-GO. The 2nd NO-GO: automatic iteration STOPS.

One run. Pasted by Alex 2026-10-13; verdict verbatim below, the appended fix prompt summarized (two items). Round 3
only with the literal `Round 3 authorized by Alejandro: YES`; a 3rd NO-GO is the hard cap.

## Verdict (verbatim, condensed to the verdict lines)

Round 2 review: the worktree remained clean at the pinned HEAD. No files were changed.

1. **R1 P1-1 -- FIXED.** D2 excludes incompatible payment modes and nonprofit/cultural/sourced modes, while allowing
   `coi_required`; D3 explicitly exempts only Quote Terms sentences. Evidence: plan lines 95-117;
   `payment-terms.ts:60-65`; `coi.ts:20-27`; `generate.ts:296-301`.
2. **R1 P1-2 -- FIXED.** D1 distinguishes category-only requests from explicit ensembles and covers Latin music,
   Spanish guitar, Latin band, a band, and a trio. The current hard gate declines only listed rock/country/cover
   bands. Evidence: plan lines 83-93; `hard-gate.ts:20-28, 93-97`.
3. **R1 P1-3 -- FIXED.** Alex's salutation choice is recorded, the existing nameless rule is preserved, and the hard
   stop forbids production code before review. Evidence: plan lines 149-157 and 247-250; `generate.ts:97-98`.
4. **R1 P1-4 -- FIXED BUT INTRODUCES P1.** The formulas and descriptive/non-causal interpretation are now explicit
   (plan lines 223-245). However, the exact execution path claims 55 runs including `r1`, while the current runner
   defines only ten leads (`v1-v6`, `h1-h4`) and no `r1` (plan lines 225-227, 262-264;
   `clarification-measure.ts:41-55, 109`). The plan does not explicitly add `r1` or reconcile the runner/report's
   fixed 50-run assumptions.
5. **R1 P1-5 -- FIXED.** D2 and V2 cover clarification, quote modes, budget tiers, past dates, residency, no viable
   scope, graceful decline, platform terms, unknown-platform terms, nonprofit, cultural, sourced, hybrid, and format
   boundaries. The `coi_required` positive control is consistent with `coiTermsFor`.
6. **R1 P2-6 -- FIXED.** V7 names changed and unchanged cases, including C8, C13, C14, C15, C16, and C17. V8 is
   correctly relabelled instrumentation with deterministic tests and no pass bar.

New defects caused by `c9fbb62..HEAD`:

- **P1:** The stated 55-run measurement cannot execute as written because `r1` is absent from the current runner, and
  the plan does not explicitly add it.
- **P2:** The COI metric denominator is `quoteTermsOff === false`, but graceful-decline mode also has
  `quoteTermsOff === false` while `coiTermsFor` returns no COI sentence. The denominator should be based on
  `coiTermsFor(...).kind === "sentence"`. Evidence: plan line 239; `coi.ts:24-26`.

Final verdict: **NO-GO**

## Claude Code's check (2026-10-13)

| Finding | Check | Result |
|---|---|---|
| P1: `r1` is not in the runner; 55 runs cannot execute | `scripts/clarification-measure.ts` defines v1-v6 and h1-h4 only; `ARM_SHAPE` in `src/arm-manifest.ts:67` is 5 files and 50 runs, so a 55-run arm B would also be VOID against arm A in the comparing report. Re-reading my own reason for r1: it is the lead the REFERENCE was written for, so putting it in the measurement would let the example's own lead sit in the data it is meant to steer. | **Valid**, and the better fix is to drop r1 (50 runs, the shape the report already requires), not to add it. |
| P2: COI denominator | `coiTermsFor` returns `none` for `quoteTermsOff` AND for `graceful_decline === true` (`src/pipeline/coi.ts:24-26`); the plan's denominator used `quoteTermsOff` false only. | **Valid.** |

Both accepted. Both are text of the measurement section; none touches code.
