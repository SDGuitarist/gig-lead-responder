---
title: "Clarification validator: the internal pricing terms are rejected as compounds, not as words"
category: architecture
tags: [clarification, validator, regex, false-reject, human-decision, mutation-map, offline-replay, plan-review, codex-review, observational-evidence]
module: src/pipeline/generate.ts, src/clarification-validator.test.ts, scripts/clarification-validator-replay.ts
symptom: "A clarification draft ended with no draft because it used 'anchor' as a verb or 'floor' in 'dance floor': 4 of 172 runs."
root_cause: "The validator kept the app's internal pricing words (anchor, floor, investment) as bare-word rejections; the model uses two of them in ordinary prose, and the rule rejected the word, not a price."
date: 2026-10-13
model: claude-sonnet-5-5
predecessor: architecture/2026-10-13-a-shorter-instruction-shortens-the-reply-not-the-scene-two-arm-measurement.md
related:
  - docs/plans/2026-10-13-fix-clarification-internal-terms-plan.md
  - docs/reviews/2026-10-13-clarification-internal-terms-replay.md
  - docs/reviews/2026-10-13-clarification-internal-terms-plan-codex-round1.md
  - docs/reviews/2026-10-13-clarification-internal-terms-plan-codex-round2.md
  - docs/reviews/2026-10-13-clarification-internal-terms-code-codex-round1.md
  - docs/solutions/architecture/2026-10-13-clarification-validator-rejects-stated-prices-not-vocabulary.md
---

# Reject the internal terms as pricing compounds, not as words

## Prior Phase Risk

> "that the two compound forms cover how the model would actually leak the terms. 0 of 816 drafts used them at all,
> so the forms are a reasoned list, not an observed one." (plan Feed-Forward, least confident)

Accepted, not closed. The forms are two literal sequences (anchor/floor + a pricing noun; a pricing noun +
anchor/floor, with plurals), a bare "anchor" or "floor" passes by decision (V16), and the replay found no pricing
compound in 816 stored drafts. A fresh model measurement of the no-draft rate is the unexecuted check.

## Problem

The first clarification validator kept `anchor`, `floor` and `investment` as rejected words, "unchanged", because they
are Alex's internal pricing vocabulary. The review of that plan named "`floor`/`anchor` as ordinary words" as a risk
and left it. Measured over 172 later runs, the rule ended a run with no draft 4 times: `anchor` as a verb three
times ("to anchor the room"), `floor` once ("a dance floor"). A no-draft run is an unusable run. Across 816 stored
drafts the terms appear 6 times, all ordinary prose, **0 as a pricing term**.

## Solution (what ships)

| Piece | What it does |
|---|---|
| Alternative 1 | `anchor`/`floor` + `price|rate|number|figure|amount|quote|pricing` (the pricing noun may be plural): "anchor price", "floor rates" |
| Alternative 2 | `price|rate|quote|pricing` + `anchor`/`floor`, with an optional `s`: "price floor", "rate anchors" |
| `investment` | unchanged (no ordinary use observed; also in the voice kill list) |
| Possessive | NOT a form: "my floor", "our anchor" pass (Alex's decision) |
| V4a / V4b | amended by that decision: the bare sentences now return the drafts; the compound forms are rejected |
| Replay | `scripts/clarification-validator-replay.ts`: offline, exit 2 on a missing or empty input |

Evidence: 997 pass / 0 fail / 1 skip; 10 mutation rows each killed by exactly its own token test; replay on 816
stored drafts: the old alternative matches 4, the new 0, no pricing compound present; Codex code review R1 GO.

## How it got there (what each step taught)

1. **Weakening a guarantee a human set is a question, not a statement.** The first plan wrote "stated here for Alex"
   next to the amended V4a. Review: that is not approval. Alex was asked in chat with three options and chose
   "Pricing-noun compounds only"; the plan now has a Decision record citing the answer.
2. **Say which count a number is.** The plan used 172 (runs since the validator fix) and 816 (distinct drafts), but
   the scanned corpus was 154 runs: the earlier 18-run re-run is in an older file format. The review caught the
   mismatch; the plan now states both and why.
3. **A list of words searched is not a list of words found.** "`anchor`, `anchors`, `floor` and `investment` occur
   6 times" read as if `investment` had occurred. It occurred 0 times; the review's "contradiction" was my sentence.
4. **The possessive reproduced the false reject.** "My anchor is my family" and "Our floor is upstairs" matched the
   proposed `my|our` form. Dropping it was the only way to keep "ordinary prose passes" true.
5. **The old pattern had a gap the fix closed.** `\bfloor\b` never matched "price floors" or "rate anchors"; those
   tests failed on the old code too.
6. **One assertion per token makes a mutation map honest.** A looped test fails if any element passes, so a
   mutation looked "covered" by sentences that did not depend on it. Twelve one-sentence tests made each row fail
   exactly its own token; the dead `s?` in alternative 1 (found in review) was removed.
7. **My own mutation broke the regex.** One row removed a closing parenthesis, the pattern failed to compile and the
   row read as "killed 0/1". Read a survivor before trusting it: check that the mutant is valid.
8. **A free offline replay beats a paid run for a regex change.** Old against new over stored drafts is
   deterministic and costs nothing, and its limits (drafts from the old validator and mixed prompts) are stated.

## What this does NOT fix

- **The structural-scene failures** (10 of 43, then 11 of 44): the reference reply, which needs Alex's exact words.
- **A fresh measurement of the no-draft rate** with the narrowed pattern.
- **"Exactly one question":** 12 of 122 runs; not touched.
- **Accepted false rejects of the compounds:** "price anchors the whole conversation" (the verb after a pricing
  noun) and a building's "floor number".
- **A bare internal term passes:** "the floor is firm" states no price and is allowed.

## Prevention

- **Reject the use, not the word**, when a word has an ordinary sense; and say what the word-level rule used to buy.
- **Ask, then record, before weakening a human-set guarantee**; cite the answer in the plan.
- **Name the denominator of every number in a plan** (runs, drafts, files) and where each comes from.
- **One assertion per token** for any test that a mutation map relies on.
- **Validate the mutant** (it compiles and changes behaviour) before reading a survivor as a test gap.
- **Replay a regex change offline** over stored output before spending a model run.

## Feed-Forward

- **Hardest decision:** narrowing versus dropping the internal terms, and whether to keep the possessive. Alex chose
  compounds only after seeing 4 false rejects against 0 pricing uses.
- **Rejected:** removing the terms; the possessive; `(anchor|floor) is`; a prompt change; a model re-measurement.
- **Least confident:** that the two forms cover how the model would leak the terms; none has been observed.

## Three Questions

1. **Hardest pattern to extract from the fixes?** That two of this cycle's review findings were about my own wording
   (a search list read as a hit list; a looped test claimed as isolated), not about the regex.
2. **What did you consider documenting but left out, and why?** The per-file SHA-256 list (it is in the replay
   record) and the ten mutation rows (in the plan).
3. **What might future sessions miss that this solution doesn't cover?** The validator now passes a bare "the floor
   is firm". If the model ever starts leaking Alex's internal terms that way, the next clarification measurement
   will not catch it on its own: the validator passes it, and the replay (which does print every bare use as an
   "old matched ... new passes" line) is run by hand, not by any measurement or test.
