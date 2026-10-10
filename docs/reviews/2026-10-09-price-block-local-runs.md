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

## Re-worded leads (Alex chose "re-word leads, run again", 2026-10-09)

Leads a2/b2/c2: the same organizations and dates, re-worded as black-tie galas in luxury ballrooms ("budget is
not a concern" / "quality matters more than price"); c2 names no organization AND no venue (so the venue cannot
be taken as the organization; its job is the `[organization]` case). Texts: `<scratchpad>/runs/lead-{a2,b2,c2}.txt`,
quoted here:
- a2: "Hello, I'm the events director at the Example Arts Foundation, an established 25-year-old foundation that
  funds youth music programs across San Diego County. We're hosting a black-tie donor gala in the grand ballroom of
  a luxury oceanfront resort in La Jolla, about 250 guests. We'd like one hour of elegant solo guitar during the
  cocktail reception. Budget is not a concern; we want the best. Event date: 2026-12-10."
- b2: "We're the Example Literacy Foundation, an established foundation that has funded library programs in San
  Diego since 2004. Our black-tie benefactor gala is in the ballroom of a five-star hotel downtown, about 300
  guests, with a seated dinner. We want a polished solo guitarist for two hours during dinner. Quality matters
  more than price for us. Event date: 2027-02-20."
- c2: "Our foundation is hosting a black-tie donor gala at a luxury resort ballroom in La Jolla, around 200 guests.
  We've been funding arts education for over 15 years. We'd like a refined solo guitarist for one hour during
  cocktails, and budget is not a concern. Event date: 2026-12-03."

| Run | Tier | Price | Model's marker line | Block in full / compressed | Post-check |
|---|---|---|---|---|---|
| a2 | T3D, NP2 | $500 1h (standard $650) | valid | yes / yes, exact | no in_kind violation (held for `voice_kill: "lands"`, unrelated) |
| b2 | T3D, NP2 | $695 2h (standard $895) | valid | yes / yes, exact | passed, verified |
| c2 | T3D, NP2 | $500 1h (standard $650) | `[[PRICE: Solo guitar, 1 hour]]` in BOTH drafts | no / no | held: `in_kind_line_full`, `in_kind_line_compressed`, `in_kind_org_missing` |

**Block count: 2 of 3 NP2-priced runs carry the block in both drafts.** c2: the model put the hours inside the
marker name; the name rule rejects digits by design (no number reaches the price line through the name), so
nothing was inserted and the draft was HELD (fail-closed, as designed). That is a false hold, 1 of 3.
**STOP rule:** 3 NP2-priced (>= 2); block missing in 1 (< 2): the rule does NOT fire; the plan proceeds to code
review. Sample is 3; the false-hold rate on real leads is unmeasured.

Both inserted blocks, verbatim (a2, b2 compressed drafts): "Solo guitar, $500, 1 hour | Professional sound,
setup and breakdown, repertoire shaped to their event" / "My standard rate is $650, so the difference is my
in-kind contribution to the Example Arts Foundation." and "Solo guitar, $695, 2 hours | ..." / "My standard rate
is $895, so the difference is my in-kind contribution to the Example Literacy Foundation." Each sits after the
pitch, before the deposit line and the sign-off.

Pre-existing, unrelated: the em-dash fixer leaves "doing its job , present" (a space before the comma).
