# Clarification-mode generation failure: measurement (HANDOFF open item 5), 2026-10-13

**Question:** why does a vague lead sometimes end in `GenerationError: Clarification mode <draft> must not include
pricing language` with no draft? **Code:** `7995d04` (the COI work included; the failure was reproduced earlier on the
pre-COI `72490b7`, 2 of 2). **Method:** the real model call was wrapped to log every generate response (the pipeline
throws the rejected draft away), and the exact alternatives of `PRICE_SIGNAL_PATTERN`
(`src/pipeline/generate.ts`) were tested one at a time on each logged draft. 3 parallel processes x 6 made-up vague
leads = 18 pipeline runs, real model, scratch `DATABASE_PATH`, today pinned to 2026-10-12. **No repo code changed.**
The runner and raw JSON are in the session scratchpad (not committed).

## Result

| | Count |
|---|---|
| pipeline runs | 18 |
| runs that ended in `GenerationError` (no draft) | **17** |
| runs that produced a draft | 1 (and only after a rewrite) |
| generate calls logged | 21 |
| generate calls whose draft held a banned token | **17 of 21** |
| token `quote` | 16 calls |
| token `rate` | 1 call |
| token `$` figure, `anchor`, `floor`, `investment` | **0** |

Every erroring run's LAST generate call held a token (two runs had a clean first call, a failed verify gate, then a
rewrite that held one). No draft stated a price.

## What the model actually wrote (all made-up leads, drafts of the model's own prose)

The hits are a bridging phrase announcing that a quote WILL follow, not a price:

- "Before I quote, one question: are you picturing something intimate and in the background ..."
- "Before I send you a quote, one question ..."
- "... changes the configuration and the quote. Let me know and I'll come back ..."
- "... I'll send a specific recommendation and a rate."
- "Most vendors pick a format and quote it. I want to pick the right one ..."

## Reading

- **The validator is stricter than the prompt's invariant.** The prompt's hard constraint is "Do NOT state a price,
  rate, anchor, floor, or package"; the validator rejects the bare WORDS "quote" and "rate", so "Before I quote" fails
  although it states nothing.
- **The prompt invites the word.** The same prompt says "No quote yet" and "before pricing" for the clarification
  mode, so the model echoes it. 16 of 17 failures are "quote".
- **It is not intermittent noise:** about 81% of generate calls in clarification mode hold the token, so a vague lead
  is likely to fail, not occasionally.
- **Limits:** made-up leads, one model, 18 runs; whether the real inbox sees mostly vague leads is not known (the
  earlier 6-lead COI run and this one used leads written to be vague).

## Candidate fixes (for the plan; none applied)

1. **Narrow the validator** to what the invariant is about: keep the `$` figure and the internal terms
   (`anchor`, `floor`, `investment`), add a bare price number next to a currency word, and stop rejecting the bare
   words "quote" and "rate".
2. **Change the prompt** so it does not plant the word ("No price yet") and tell the model not to use "quote" or
   "rate". The model may still say it; this alone does not guarantee a draft.
3. **Both**, with a retry that feeds the rejection back, as the verify loop does for the gate.

Each needs positive controls (a `$850`, "my floor is ...", "anchor" are still rejected) and a re-run of this same
18-run measurement to show the failure rate, before and after.
