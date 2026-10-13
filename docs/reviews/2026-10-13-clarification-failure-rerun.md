# Clarification-mode failure: the 18-run re-run after the fix (plan step 4), 2026-10-13

**Code:** `1750cd6` (the validator rejects a supported price grammar plus the internal terms; the bare words
"quote" and "rate" are allowed). **Plan:** `docs/plans/2026-10-13-fix-clarification-pricing-validator-plan.md`
(Revision 1b). **Method:** `scripts/clarification-measure.ts`, 3 parallel processes x 6 made-up vague leads, 1 run
each (18 runs), real model, scratch `DATABASE_PATH`, today pinned to 2026-10-12. Nothing was sent; `data/leads.db` was
untouched. **This is observational evidence of what the model wrote on 18 runs, not proof that the validator catches
every price.**

## Result against the baseline (`docs/reviews/2026-10-13-clarification-failure-measurement.md`)

| | Before (`7995d04`) | After (`1750cd6`) |
|---|---|---|
| runs | 18 | 18 |
| runs with no draft | **17** | **3** |
| of those, `must not include pricing language` | 17 | **0** |
| of those, `must contain exactly one question` | 0 | 3 |
| generate calls logged | 21 | 46 |
| calls holding a stated class (dollar figure, currency-word number, spelled-out amount, k amount, internal term) | 0 | **0** |
| calls using the allowed vocabulary: `quote` / `price` words / `rate` | 16 / 1 / 1 (of 21) | 33 / 15 / 2 (of 46) |

- **The defect is gone:** zero pricing-language rejections in 18 runs, and no draft in 46 generate calls carries a
  stated amount, a spelled-out amount or an internal term. The model uses the word "quote" in 33 calls, as before,
  and it is no longer rejected.
- **Generate calls doubled** because the drafts now get past the validator and reach the verify gate, which sends
  failing drafts back for a rewrite (up to 3 attempts). The runner does not record `verified` or the gate's reasons,
  so how many of the 15 drafts passed verification is NOT known from this run.

## A different failure now visible (not part of this plan)

3 of 18 runs (2 in one process) still end with no draft, now for the existing rule **"exactly one question"**
(`enforceClarificationDraft`, unchanged here, pinned by V9). In the logged calls, 43 had one question mark in each
draft, 3 had two in the full draft (the model split the binary question: "... or more of a featured moment?" plus a
second sentence ending "?"). It did not appear in the 21 calls before (0 of 21), so it may be sampling noise or it may
be a rule that was hidden behind the first. 3 of 18 runs is 17%, with no draft and no retry. **Its own item.**

## Limits

- 18 runs, one model, made-up leads; one run per lead per process.
- The scan counts what matches the supported grammar and the allowed vocabulary; an unmarked amount ("around fifteen
  hundred") would not be a "stated class" hit (documented limit, V10). No such text was seen in the vocabulary
  counts' contexts, but contexts for the vocabulary classes were not read draft by draft.
- `verified` and the gate's fail reasons are not in the runner's output (a gap in `scripts/clarification-measure.ts`).
