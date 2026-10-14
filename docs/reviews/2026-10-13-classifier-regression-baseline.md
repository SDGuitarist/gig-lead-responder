# Classifier regression baseline, before the vague-lead route change (2026-10-13)

**Plan:** `docs/plans/2026-10-13-feat-vague-lead-quote-with-question-plan.md` (Revision 1b), "Classifier regression".
**Trigger:** Alex's heads-up: the classifier wording change cannot be unit-tested, and the measurement only ran
vague leads, so ordinary leads could be misclassified unnoticed. **Method:** `scripts/classifier-regression.ts`,
the REAL classifier, 5 runs per lead, today pinned to 2026-10-12, `classify.ts` UNEDITED at `73fd38e`; the price is
`lookupPrice` on the returned classification. Seven leads: the four registered test leads
(`.claude/commands/lead-test.md`), the memorial lead (`tests/voice-baseline/lead-5-memorial.txt`) and two boundary
leads (an explicit "Latin band", a mariachi quinceanera). Observational: one model, 5 runs per lead.

## Result (5 of 5 runs each unless shown)

| Lead | action | format_recommended | quote price |
|---|---|---|---|
| L1 wedding at Hilton La Jolla (rich, GigSalad) | quote | `duo` x4, `flamenco_duo` x1 | $1,495 x4, $1,595 x1 |
| L2 birthday March 22, "not sure on details yet" (The Bash) | **one_question** | **unresolved** | **none** |
| L3 birthday Oct 2026, "just getting pricing info" (GigSalad) | **one_question** | **unresolved** | **none** |
| L4 corporate March 14, downtown (The Bash) | **one_question** | **unresolved** | **none** |
| L5 memorial | quote | solo | $595 |
| L6 "a Latin band for our company party" | one_question | unresolved | none |
| L7 mariachi for a quinceanera, Saturday Nov 14 | one_question | mariachi_full | $1,900 |

## Readings

1. **Three of the four registered test leads (L2, L3, L4) already get NO price today, 5 of 5 times.** The registry's
   "Expected" notes for them (Type 1 "memorable, not exhaustive", Type 3 "genre default stated, concern bundling")
   describe quoted replies. The no-price clarification mode is the ordinary path for sparse leads, not a rare one.
2. **L1 varies at baseline** (`duo` x4, `flamenco_duo` x1; the registry expects `flamenco_duo`). The classifier is a
   model: a comparison must allow for that variation and must not read one different run as a regression.
3. **L7** is an existing `one_question` with a resolved format (`mariachi_full`, $1,900): the path the plan relies
   on already exists in production behaviour.
4. **L6** ("Latin band") stays `unresolved`, which is what the plan's D1 keeps for an explicit ensemble.

## What the after-run must show (pre-registered in the plan)

L1, L5, L7: the same action and format values as here (a value not seen here is a defect). L6: still `unresolved`.
L2, L3, L4: moved from `unresolved` to `solo` (or `duo` for a dinner/cocktail/dance setting) with the table's price:
that movement is the intended change; anything else for them is a defect.
