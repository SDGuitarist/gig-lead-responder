# Review Context -- Gig Lead Responder

## Risk Chain

**Brainstorm risk:** None — **no brainstorm this cycle** (skip gate: the input was the NP2 Codex round-3 record,
`docs/reviews/2026-10-09-np2-codex-round3.md`, which named the surface, the failing inputs and the fix).

**Plan mitigation:** `docs/plans/2026-10-09-feat-app-inserted-price-and-in-kind-lines-plan.md`. The model writes one
`[[PRICE: <format name>]]` marker on NP2 drafts; the app writes the price line + in-kind sentence inside
`generateResponse` (cut -> insert -> sign-off); the post-check confirms exact text. Plan review: 2 Codex rounds,
NO-GO on both runs each; all 13 findings fixed; Alex closed plan review.

**Work risk (from Feed-Forward):** "The marker on real, varied leads: 6 runs on 3 texts, and the classifier's T2/T3
call decides whether NP2 fires at all; plus organization_name filled with the venue, which no check sees."

**Review resolution:** Codex CODE review round 1 = **GO on both runs, 0 findings**
(`docs/reviews/2026-10-09-price-block-codex-round1.md`). Real-model runs: first texts 0/3 NP2-priced (STOP fired);
re-worded 3/3 priced, block 2/3; after one prompt line 3/3 (`docs/reviews/2026-10-09-price-block-local-runs.md`).

## Files to Scrutinize

| File | What changed | Risk area |
|------|-------------|-----------|
| `src/pipeline/price-block.ts` | New: `priceLineTail` (the ONE price-line tail builder), `priceBlockFor`, `insertPriceBlock`, `FORMAT_NAME` | Any non-match must leave the draft unchanged (fail closed). Loosening the marker or name rule lets a guessed or number-bearing price line through. |
| `src/pipeline/generate.ts` | Cut compressed to 2000 -> insert block -> sign-off | Moving insertion before the cut can slice the block; moving it out of `generateResponse` hides the real price from the verify gate and rewrites. |
| `src/pipeline/post-check.ts` | `hasPriceBlock` replaced the prose detector `hasInKindLine` | Counts run OUTSIDE the block; sign-off is a LINE match. Re-widening either reintroduces false holds (In Kind Foundation, mid-body name). Never re-add prose inference of "the price line". |
| `src/prompts/generate.ts` | NP2 PRICE LINE = marker instruction; `buildInKindBlock` deleted; uses `priceLineTail` | Non-NP2 PRICE LINE sections are pinned by `src/price-line-golden.test.ts`; change them only deliberately. |
| `src/run-pipeline.ts` | Both post-check calls pass `priceBlock: priceBlockFor(...)` | Must use the same final classification/pricing as generation. |

## Standing Warnings for This Repo

- **organization_name can be the VENUE** (2/2 real runs, lead with no organization named). The block is "intact"
  and still thanks the hotel; no check holds it. Separate planned item (HANDOFF). Until fixed, an NP2 draft's
  organization must be read by Alex.
- **Local PF-Intel lookups fail** (`.env` has a Railway-internal URL). Production unverified. A failed lookup
  reads like "no venue notes".
- `parseYelpEmail` accumulated two defects, including a credential leak, because it could never run. **The same
  mechanism still applies to `YelpPortalClient.fetchLeadDetails()`**. Treat any newly-reachable Yelp code as
  unreviewed regardless of its age.

## Plan Reference

Plan: `docs/plans/2026-10-09-feat-app-inserted-price-and-in-kind-lines-plan.md`
Solution: `docs/solutions/architecture/2026-10-09-app-writes-fixed-lines-model-writes-a-marker.md`
