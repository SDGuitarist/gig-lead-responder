# Vague-lead quote route: arm B measurement, 2026-10-13

**Plan:** `docs/plans/2026-10-13-feat-vague-lead-quote-with-question-plan.md` (Revision 2). **Code:** `192a41e`
(`dirtyPromptFiles` empty). **Method:** `scripts/clarification-measure.ts --arm B --probe C8 --runs 1`, 5 processes
x the 10 made-up vague leads (v1-v6, h1-h4), real model (`claude-sonnet-4-6` per the manifest), scratch databases,
today pinned to 2026-10-12, nothing sent. **Exploratory and observational: 50 runs, one model, made-up leads.
Descriptive, no causal claim, no pass bar** (the classifier route and the prompt shape both differ from arm A).

## Attempt 1 was VOID

28 of 50 runs returned the API error "You have reached your specified API usage limits" (6-7 per process); they
never reached classification. Its 66% "unusable" figure measured the spend limit, not the model, and is not used.
The limit was raised and the arm rerun in full (below).

## Manifest check

Five manifests deep-equal; `probeCase` C8; `promptSha256` `b7820f37...e70`; `gitSha` `192a41e9...`; model
`claude-sonnet-4-6`; today 2026-10-12; lead set `7663845c...`. No error logs mention the usage limit (0 of 5).
**Arm A's raw files were in `/tmp` and no longer exist**, so the cross-arm manifest check and Fisher p did NOT run;
the arm A numbers below are the recorded ones in `2026-10-13-clarification-shape-arm-a.md`.

## Result (rerun, 50 of 50 returned a draft)

| Metric (numerator / denominator, formulas as pre-registered) | Arm B | Arm A (recorded) |
|---|---|---|
| Classifier distribution | solo 45, duo 5, unresolved 0 | n/a (clarification route) |
| Returned draft | 50 / 50 | 43 / 50 |
| Quote at the app's price | 50 / 50 | n/a (no price) |
| Unusable runs (no draft, scene not cinematic, competitor true) | 12 / 50 = 24% (Wilson 14%-37%) | 19 / 50 = 38% |
| Verified | 20 / 50 | 7 / 43 |
| Exactly one `?` | 34 / 50 | not recorded the same way |
| Payment sentence once | 49 / 50 | n/a |
| COI sentence once | 47 / 50 | n/a |
| No footer | 50 / 50 | n/a |
| Words median / sentences median | 199 / 11 | 157 / 8 |
| Shared windows with the example | max 111, **44 of 50 drafts above 0** | n/a |

Per lead (unusable / 5): h1 0, h2 0, h3 2, h4 0, v1 3, v2 3, v3 0, v4 1, v5 1, v6 2.

## Readings (descriptive)

- **The route worked as built:** every lead got a format (45 solo, 5 duo), the app's price in every draft, no footer.
- **Length went the wrong way:** median 199 words and 11 sentences against Alex's reply (about 100 words). The
  prompt does not hold the draft near the example's length.
- **"Exactly one question" failed in 16 of 50** drafts (zero or two-plus `?`); not touched by this plan.
- **Copying is real but mostly sentence-level.** The longest shared stretch per draft is dominated by mandated
  text (the date sentence, the deposit, COI), which the metric cuts. Outside it, drafts reuse Alex's sentences:
  the equipment line ("I bring my own sound and need one outlet and an armless chair, so home, backyard, or
  restaurant all work", 3 drafts, with the mandated text after it), "warm covers and standards that sit under the
  conversation" (1), "The usual mistake is booking" (2), "go with solo Spanish guitar: warm covers and" (2).
  44 of 50 with at least one 30-character window is not the intended "order, not sentences".
- **Unusable fell 38% to 24%, verified rose 7/43 to 20/50**, but this is not a controlled comparison.

## Limits

- One model, made-up leads, 5 runs per lead, no comparison statistic (arm A files gone).
- The shared-window check counts windows against ONE reference reply; the copying list above is from my own scan of
  the longest shared substring per draft, not a pre-registered metric.
- Drafts were not read in full.
