# Review Context -- Gig Lead Responder

## Risk Chain

**Brainstorm risk:** None — **no brainstorm this cycle** (skip gate: the input was a finding in
`docs/reviews/2026-10-09-price-block-local-runs.md`: lead (c) returned the venue as `organization_name`, 2/2 runs).

**Plan mitigation:** `docs/plans/2026-10-09-fix-organization-name-is-the-venue-plan.md`. A deterministic guard in
`normalizeOrganizationName` empties the field when it matches `venue_name` (folded word lists; identical, or 2+
whole words contained), which sends the draft into the existing `[organization]` hold. Same guard at
`runEditPipeline` entry; one prompt line. Plan review: round 1 NO-GO (both runs, 7 findings accepted), round 2 GO.

**Work risk (from Feed-Forward):** "whether the classifier puts the venue in `organization_name` while ALSO
leaving `venue_name` empty or different. Then the guard cannot fire, and only the prompt line helps."

**Review resolution:** Codex CODE review round 1 = **GO on both runs, 0 findings**
(`docs/reviews/2026-10-09-org-venue-codex-round1.md`). Real-model runs 3/3 null, control kept
(`docs/reviews/2026-10-09-org-venue-local-runs.md`). Whether the prompt or the guard produced the null is not
distinguishable from the CLI output.

## Files to Scrutinize

| File | What changed | Risk area |
|------|-------------|-----------|
| `src/pipeline/classify.ts` | `normalizeOrganizationName(value, nonprofit, venueName)`; helpers `nameWords`, `namesMatch` | Loosening containment to 1 word drops real orgs ("The Rock" / "Rock the Vote"); an empty word list must NEVER match. `St.`/`Saint` miss is pinned (O10). |
| `src/run-pipeline.ts` | `runEditPipeline` re-applies the guard at entry | Stored classifications skip `validateClassification`. Any NEW path that drafts from a stored classification must apply it too. |
| `src/prompts/classify.ts` | "Never the venue or the place the event is held." | Secondary defence; the only one when `venue_name` is empty. |

## Standing Warnings for This Repo

- **organization_name can still be a wrong NON-venue name** (event title, planner company). No check sees it;
  Alex reads every NP2 draft.
- **Local PF-Intel lookups fail** (`.env` has a Railway-internal URL). Production unverified. A failed lookup
  reads like "no venue notes".
- `parseYelpEmail` accumulated two defects, including a credential leak, because it could never run. **The same
  mechanism still applies to `YelpPortalClient.fetchLeadDetails()`**. Treat any newly-reachable Yelp code as
  unreviewed regardless of its age.
- The NP2 price block (`src/pipeline/price-block.ts`, `hasPriceBlock`): never re-add prose inference of "the price
  line" (see `docs/solutions/architecture/2026-10-09-app-writes-fixed-lines-model-writes-a-marker.md`).

## Plan Reference

Plan: `docs/plans/2026-10-09-fix-organization-name-is-the-venue-plan.md`
Solution: `docs/solutions/logic-errors/2026-10-10-organization-name-is-never-the-venue.md`
