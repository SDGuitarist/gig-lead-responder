---
title: "fix: the clarification validator rejects the ordinary words 'anchor' and 'floor'"
date: 2026-10-13
status: plan, Revision 0 (not yet reviewed)
branch: feat/hub-phase0
---

# Clarification validator: reject the internal terms as pricing nouns, not as words

### Prior Phase Risk

Predecessor: `docs/plans/2026-10-13-fix-clarification-pricing-validator-plan.md` (Revision 1b). Its "least confident"
answer, quoted from `docs/solutions/architecture/2026-10-13-clarification-validator-rejects-stated-prices-not-vocabulary.md`:
"the unmarked amount that passes, and the 'exactly one question' rule now carrying 3 of 18 runs." This plan is about a
different, smaller risk that the first plan's review named and left open: "`floor`/`anchor` as ordinary words" was a
review focus there; alternative 6 of the grammar kept the internal terms "unchanged". Measured since, it rejects
ordinary prose.

## Problem (measured, not assumed)

The internal terms alternative of `PRICE_STATEMENT_PATTERN` (`src/pipeline/generate.ts:44`) is
`\banchor\b|\bfloor\b|\binvestment\b`. Over the 172 clarification runs since the validator fix (the re-run, three
18-run sets, and two 50-run arms), it ended a run with no draft 4 times, each time on ordinary prose:

| Run | Matched | Context |
|---|---|---|
| set q1, `c v3` | `anchor` | "which part of the day they want live music to anchor" (the verb) |
| arm A | `anchor` | the verb: the stored drafts hold exactly three `anchor` contexts (this run, `c v3` and h1), and all three are the verb ("gently anchor the evening" is the third) |
| arm B, h1 | `anchor` | "the wrong call either disappears when it should anchor the room" (the verb) |
| arm B, h1 | `floor` | "a solo guitar disappear under the noise of a dance floor" (a noun) |

Scanning all 816 distinct drafts stored from the measurements: `anchor`, `anchors`, `floor` and `investment` occur
**6 times, all ordinary prose** ("the art anchors the room", "a duo that anchors the room", "gently anchor the
evening", "a dance floor"), and **0 times as a pricing term**. 4 of the 6 are exact matches of today's pattern (the
plural `anchors` does not match `\banchor\b`).

Each rejection costs a usable run (a no-draft run is unusable under plan 2's estimand). The terms are in the
generate prompt as things not to state ("Do NOT state a price, rate, anchor, floor, or package").

## What is true today

- The internal terms were kept in the pattern on purpose: they are Alex's internal pricing vocabulary, and a draft
  that says "my floor" or "the anchor price" leaks how he prices. Tests V4a, V4b, V4c pin each as rejected, with the
  sentences "The anchor for this is a conversation.", "Our floor is a firm number.", "It is a modest investment for
  the night."
- A price stated with a number is already caught by the dollar, currency-word, spelled-out and k alternatives; the
  internal terms add only the case with no number.
- No other code uses the pattern; the error names the matched text only.

## Decision

D1. Replace the third-from-last alternative `\banchor\b|\bfloor\b` with pricing-noun forms; keep `\binvestment\b`
unchanged (no ordinary use was observed, and it is the sales vocabulary the voice rules ban):

| Alternative (case-insensitive) | Rejects | Passes (examples) |
|---|---|---|
| `\b(?:anchor|floor)\s+(?:price|prices|rate|rates|number|figure|amount|quote|pricing)\b` | "anchor price", "floor rate" | "the floor plan", "a dance floor" |
| `\b(?:price|rate|quote|pricing)\s+(?:anchor|floor)\b` | "price floor", "rate anchor" | "to anchor the room" |
| `\b(?:my|our)\s+(?:anchor\b|floor\b(?!\s+(?:plan|space|level)))` | "my floor", "our anchor" | "my floor plan" |

D2. Test V4a is amended BY DECISION (stated here for Alex): "The anchor for this is a conversation." no longer
throws; it states no price and no pricing noun. V4a is replaced by "My anchor price is a conversation." (rejected).
V4b "Our floor is a firm number." stays rejected (the `our floor` form). V4c is unchanged.

D3. Not done, and why: dropping the internal terms entirely (a regression of a documented guarantee); matching
`anchor`/`floor` followed by `is`/`at` (it would reject "the dance floor is crowded"); changing the prompt's
instruction (a model-facing change with its own measurement); any change to the number grammar.

## The invariant, stated exactly

After this change a clarification draft is rejected for an internal pricing term only when the term is used as a
pricing noun in one of the three forms above, or is `investment`. A bare "anchor" or "floor" with no number and no
pricing noun ("the floor is firm", "the anchor sits at the center") passes; that is a documented boundary, in the
same family as plan 1's unmarked amounts (V10). It is evidenced by 0 of 816 stored drafts using the terms as pricing
nouns; it is not a guarantee about unseen drafts.

## Plan Quality Gate

1. **What exactly is changing?** One regex alternative in `src/pipeline/generate.ts` (and its comment), tests
   V4a/V4b amended and V12-V15 added in `src/clarification-validator.test.ts`, and a replay script
   `scripts/clarification-validator-replay.ts`.
2. **What must not change?** The number grammar (V3, V5-V7, V11); the "exactly one question" rule; the bare words
   quote and rate (V1, V2, V10); the error message shape (V7); `investment` (V4c); the prompt; the verify gate.
3. **How will we know it worked?** EARS below, each with a mutation; plus an offline replay of the old and new
   pattern over every stored draft (deterministic, free, no model call): the new pattern rejects 0 of the 6 ordinary
   uses and still rejects every pricing-noun form the tests list.
4. **Most likely way this plan is wrong?** The model starts stating the terms as pricing nouns in a form the three
   alternatives miss ("the anchor sits at $" is caught by the dollar alternative; "the anchor is firm" is not, and
   states no price). The boundary is documented, and the replay counts each term's uses so the next measurement shows
   it.
5. **How will a human RUN this, and when?** Claude Code (or Alex) on the MacBook after the code step and before the
   Codex code review: `npx tsx scripts/clarification-validator-replay.ts <dir> [<dir> ...]` over the scratchpad
   result directories (no network, no API key). Alex reads the counts in the record.

## Acceptance Tests (EARS)

Names start `Clarification V<n>`; file `src/clarification-validator.test.ts` (each test calls `generateResponse` with a
stubbed model, as V1-V11 do).

- **V4a (amended)** WHEN a draft contains "My anchor price is a conversation.", THE SYSTEM SHALL throw
  `must not include pricing language`; WHEN it contains "The anchor for this is a conversation.", THE SYSTEM SHALL
  return the drafts.
- **V4b** WHEN a draft contains "Our floor is a firm number.", THE SYSTEM SHALL throw (unchanged).
- **V12** WHEN a draft uses `anchor` as a verb or `floor` as an ordinary noun ("to anchor the room", "the art
  anchors the evening", "a dance floor", "the ground floor", "on the floor", "my floor plan"), THE SYSTEM SHALL return
  the drafts.
- **V13** WHEN a draft contains a pricing-noun form ("anchor price", "floor rate", "price floor", "rate anchor",
  "my anchor", "our floor"), THE SYSTEM SHALL throw and name the matched text.
- **V14** WHEN a draft contains `investment`, THE SYSTEM SHALL throw (V4c, unchanged); WHEN it contains "floor of
  four hundred dollars", THE SYSTEM SHALL throw through the number alternative (a positive control that the
  narrowing did not open that case).
- **V15** WHEN the pattern is run over 100 drafts of ordinary clarification prose assembled in the test (the six
  recorded contexts plus 94 generated sentences using each ordinary form), THE SYSTEM SHALL reject none.

Mutation map (each must fail the named test): the third alternative removed (V13, V4a); the second removed (V13);
the first removed (V13); the `my|our` alternative removed (V13, V4b); the bare `\banchor\b|\bfloor\b` restored (V12,
V4a, V15); `investment` removed (V14); the `plan|space|level` lookahead removed (V12).

## Work steps (one concern per commit; failing test first)

1. V4a (amended), V12-V15 first; confirm V12 and V15 fail on today's code, V13 passes, V4a (amended) fails.
2. The alternative and its comment.
3. The mutation map; full suite, `tsc`, leak check.
4. The offline replay script and its record.

## Execution Path

- **Target:** Alex's MacBook, offline (no model call, no network).
- **Mechanism:** `scripts/clarification-validator-replay.ts` loads every `clarification-*.json` under the given
  directories, takes each distinct `full_draft` and `compressed_draft` from every generate call, and counts matches of
  the OLD alternative (copied into the script as a constant, labelled) and the NEW pattern, printing counts and the
  matched context lines for the old-only matches.
- **Command (exact), from the repo root:**
  `npx tsx scripts/clarification-validator-replay.ts <scratchpad>/q1 <scratchpad>/q2 <scratchpad>/q3 <scratchpad>/armA <scratchpad>/armB`
  (the directories that hold the measurement result files).
- **Prerequisites:** ALREADY HAVE: Node, `npm`, `tsx`, and the stored result files (CHECKED 2026-10-13: 30 files,
  816 distinct drafts). MUST OBTAIN: none. NONE other.
- **Output:** counts and contexts, recorded in `docs/reviews/2026-10-13-clarification-internal-terms-replay.md`.
- **Who:** Claude Code or Alex. **Trigger:** after step 3.
- **Expected (a hypothesis until run):** the old pattern matches 4 drafts; the new matches 0; no pricing-noun use
  exists in the stored drafts. What this does NOT show: that unseen drafts never use the terms as pricing nouns.

## Feed-Forward

- **Hardest decision:** whether to narrow the terms or drop them. Dropping loses a documented guarantee for no
  benefit; narrowing keeps the pricing-noun cases the tests list and removes the 4 observed false rejects.
- **Rejected:** removing the internal terms; matching "floor/anchor is"; changing the prompt; a model-facing
  re-measurement (the replay is deterministic and free).
- **Least confident:** that the three forms cover how the model would actually leak the terms; 0 of 816 drafts used
  them at all, so the forms are a reasoned list, not an observed one.

## Three Questions

1. **Hardest decision in this session?** Amending V4a (the sentence "The anchor for this is a conversation." no
   longer throws) instead of keeping a test whose sentence states no price.
2. **What did you reject, and why?** Dropping the terms (documented guarantee), "floor/anchor is" (rejects "the dance
   floor is crowded"), and a prompt change (needs its own measurement).
3. **Least confident about going into the next phase?** The three pricing-noun forms are inferred, not observed.
