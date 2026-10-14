# Classifier regression after the wording edit: ordinary leads moved (2026-10-13)

**Plan:** `docs/plans/2026-10-13-feat-vague-lead-quote-with-question-plan.md` (Revision 1b), "Classifier regression".
**Baseline:** `docs/reviews/2026-10-13-classifier-regression-baseline.md`. **Method:** the same script and leads,
5 runs per lead after the edit, then a same-day control (old and new wording, 10 runs each, on L1 and L7) because the
first comparison flagged two ordinary leads. Observational: one model, small samples.

## The edit under test

The classifier's SPECIAL CASE was split into a CATEGORY-ONLY request (default `solo`, or `duo` for a dinner,
cocktail or dancing setting; "Do NOT use unresolved") and an EXPLICIT ENSEMBLE request (`unresolved`, as before). The
category list named "music", "live music", "entertainment", "Latin music", "Spanish guitar" and "not sure what kind of
music".

## Result: the intended change happened

| Lead | Before | After (5 runs) |
|---|---|---|
| L2, L3, L4 (sparse birthday, price shopper, corporate filler) | `unresolved`, no price (5 of 5 each) | **`solo`, $595 (5 of 5 each)** |
| L5 memorial | quote, solo, $595 | unchanged |
| L6 "a Latin band" | `unresolved` | **unchanged** (the ensemble boundary held, 5 of 5) |

## Result: two ordinary leads moved (the defect the regression was written to find)

| Lead / field | Old wording (before 5 + same-day 10) | New wording (after 5 + same-day 10) | One-sided Fisher |
|---|---|---|---|
| L1 hotel wedding, `format_recommended` = `flamenco_duo` (price $1,595 against `duo` $1,495) | 7 of 15 | **14 of 15** | p = 0.007 |
| L7 mariachi quinceanera, `action` = `quote` (was always `one_question`; same format, same $1,900) | 0 of 15 | **4 of 15** | p = 0.050 |
| L1 `competition_level` = `medium` (was always `low`) | 0 of 15 | 1 of 15 | -- |

## Reading

1. **The heads-up was right.** A paragraph that never mentions weddings or mariachi shifted both. The old wording
   was itself unstable on L1 (7 of 15 flamenco_duo, the registry expects `flamenco_duo`), so a single before/after
   run could not have told noise from effect; the same-day control did.
2. **By the rule fixed in the plan before the run, this is a defect of the wording:** a value for L1 or L7 that did
   not appear before (L7 `quote`, L1 `medium`), and a modal value that changed (L1). The wording is not to be built on.
3. **The cause is not known.** A plausible one: the new text names "Spanish guitar" and "Latin music" (which the
   existing FORMAT ROUTING RULES already cover) and primes the Spanish/flamenco branch; this was not tested.
4. **The intended behaviour is reachable without prompt wording.** The classifier already returns `unresolved` for
   L2-L4 and L6 and a resolved format elsewhere; a deterministic step after classification could set the default for
   a category-only `unresolved` and leave the classifier prompt, and every other lead, untouched.

## The rejected wording (not committed)

```
SPECIAL CASE (a vague request that names no format; plan 2026-10-13-feat-vague-lead-quote-with-question):
- CATEGORY-ONLY request: the client names no format ("music", "live music", "entertainment", "Latin music", "Spanish guitar", "not sure what kind of music"). Set action = "one_question" and format_recommended = "solo" (Alex alone), or "duo" when the lead names a dinner, cocktail hour or dancing. Do NOT use "unresolved" for a category-only request: the reply quotes the default and asks one binary question.
- EXPLICIT ENSEMBLE request: the client names a band or ensemble the default cannot answer ("Latin band", "a band", "a trio", "a quartet", "an orchestra"). Set action = "one_question" and format_recommended = "unresolved". This means: do NOT force a quote yet. Ask one binary clarifying question first.
```
