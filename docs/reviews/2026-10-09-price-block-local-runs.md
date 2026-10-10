# Price block, real-model measurement (plan Execution Path part 2), 2026-10-09

**Reader and trigger:** Alex (STOP decision below) and the Codex CODE review round-1 prompt, which must cite this
file and state that marker reliability is UNMEASURED unless a later run measures it.
**Code under test:** `45f2ed6` (plan steps 0-5 built). **Command:** `DATABASE_PATH=<scratchpad>/runs.db npx tsx
src/index.ts --json < lead-X.txt` (nothing sent; the CLI copied each full draft to the clipboard). `data/leads.db`
last modified Oct 3 09:20, before and after every run. Lead texts: verbatim from the plan. The venue lookup
attempted PF-Intel and failed (`fetch failed`), so no run had venue context.

## Results

| Run | np_tier | organization_name | Tier | Price | NP2 priced? | Marker / block |
|---|---|---|---|---|---|---|
| a | NP2 | Example Arts Foundation | T2D | $595 (1h) | no: $595 is not $100 above the NP2 $500 | not asked for (none in either draft) |
| b | NP2 | Example Literacy Foundation | T2D | $700 (2h) | no: $700 is not $100 above $695 | not asked for |
| c | NP2 | **Example Grand Hotel** (the venue) | T2D | $595 (1h) | no | not asked for |
| d | none (not nonprofit) | none | T2D | $700 (2h) | n/a | none; today's model-written price line |
| a, re-run | NP2 | Example Arts Foundation | T2D | $595 | no | not asked for |
| c, re-run | NP2 | **Example Grand Hotel** | T2D | $595 | no | not asked for |

Every NP lead carried both hold notes ("Alex reviews every nonprofit lead"; "no NP price (... not $100 above
...); Alex prices it"). Lead (b)'s compressed draft states `Solo guitarist, $700, 2 hours | Professional sound,
setup and breakdown, repertoire shaped to their event`: the non-NP2 path is unchanged, as designed.

## STOP rule: FIRED ("insufficient sample")

NP2-priced runs: **0 of 3** (after the one allowed unchanged re-run of (a) and (c)). Plan rule: fewer than 2 =
STOP regardless of markers; Alex decides (re-word leads, run more, or proceed). **Marker reliability is
UNMEASURED.** The insertion contract is proven only offline (H7, stubbed model).

Same as the 2026-10-09 NP2 local runs: NP2 at 1h flips with the classifier's T2/T3 call. On these texts it was T2
on all six runs (it was T3D for similar texts on the earlier run).

## New finding (outside this plan): the classifier fills organization_name with the VENUE

Lead (c) names no organization ("Our foundation is hosting ... at the Example Grand Hotel"). The classifier
returned `organization_name: "Example Grand Hotel"` on **2 of 2** runs. Had (c) been NP2-priced, the app would have
written "...my in-kind contribution to the Example Grand Hotel." and **no check would hold it**: the post-check
confirms the block is the app's, not that the organization is right. The `[organization]` hold
(`in_kind_org_missing`) never fires when the classifier invents a name. Every nonprofit lead is held for Alex, so
nothing would send unreviewed, but the draft would be wrong in a way that is easy to miss.
