# Review Context -- Gig Lead Responder

## Risk Chain

**Brainstorm risk:** None — **no brainstorm** (skip gate: a measured defect). The same made-up Tom Ham's lead priced
$895 (5 runs) and $1,200 (2 runs) on 2026-10-11; recorded in END-TO-END-STATUS known risks.

**Plan mitigation:** `docs/plans/2026-10-12-fix-tier-b-venue-rule-conflict-hold-plan.md` (Revisions 1-5b). The app
decides Tier B from a copied guest count and holds with both rate-card prices where a judgment would decide; never
writes the tier. Plan review R1-R3 NO-GO (hard cap; round 2's top finding was a duplicate test block from Claude Code's
own unanchored edit script); Alex: fix and build.

**Work risk (from Feed-Forward):** extraction of guest count; then (Revision 5) the corporate call deciding price at
four venues. Measured: guest count right 15/15 real runs; Revision 5b removed corporate as a decider.

**Review resolution:** code R1 GO both runs (Revision 4 rules); Alex then set one shared rule (Revision 5) and, after a
heads-up, 5b (under 100 always held); code R2 GO both runs. Real runs pre-registered: 9/9 and 6/6.

## Files to Scrutinize

| File | What changed | Risk area |
|------|-------------|-----------|
| `src/data/venues.ts` | `TIER_B_VENUES` (shared / always), `matchTierB`, `tierBPromptLine` | adding a venue changes holds and the prompt line |
| `src/pipeline/price.ts` | `tierBHold` | any branch that returns null for an under-100 shared lead is a silent price |
| `src/pipeline/classify.ts`, `src/prompts/classify.ts`, `src/types.ts` | `guest_count`, `event_start_hour`, `normalizeWholeNumber`, `tier_b:` prefix | an odd value must become null, never fail a lead; `event_start_hour` is unread |
| `src/run-pipeline.ts` | one `tierBHold` call after `t4FallbackHold` | the edit path reuses stored notes |
| `src/tier-b-hold.test.ts` | B1-B14 | pinned prompt line and dashboard renderer |

## Plan Reference

`docs/plans/2026-10-12-fix-tier-b-venue-rule-conflict-hold-plan.md`
