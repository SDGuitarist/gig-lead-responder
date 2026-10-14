---
title: "fix: the clarification validator rejects the ordinary words 'anchor' and 'floor'"
date: 2026-10-13
status: plan, Revision 1 (plan review R1 NO-GO, 4 P1 / 2 P2, all accepted and answered below; rewritten in place; the weakening of the bare-word guarantee APPROVED by Alex 2026-10-13)
branch: feat/hub-phase0
---

# Clarification validator: reject the internal terms as pricing compounds, not as words

### Prior Phase Risk

Predecessor: `docs/plans/2026-10-13-fix-clarification-pricing-validator-plan.md` (Revision 1b). Its "least confident"
answer, quoted from `docs/solutions/architecture/2026-10-13-clarification-validator-rejects-stated-prices-not-vocabulary.md`:
"the unmarked amount that passes, and the 'exactly one question' rule now carrying 3 of 18 runs." This plan is about a
smaller risk the first plan's review named and left open: "`floor`/`anchor` as ordinary words" was a review focus
there, and alternative 6 of the grammar kept the internal terms "unchanged". Measured since, it rejects ordinary
prose.

## Decision record (a human decision, answered before this revision)

On 2026-10-13, in chat, Alex was asked which rule the validator should apply to `anchor` and `floor` and chose
**"Pricing-noun compounds only (Recommended)"**: reject `anchor price`, `floor rate`, `price floor`, `rate anchors`
(singular and plural); a bare `anchor` or `floor` passes, including "our floor is upstairs"; "The anchor for this is a
conversation." and "Our floor is a firm number." stop throwing and V4a/V4b become the compound forms. The two
alternatives offered and not chosen: compounds plus the `my`/`our` possessive (would still reject "Our floor is
upstairs"), and no change.

## Problem (measured, not assumed)

The internal-terms alternative of `PRICE_STATEMENT_PATTERN` (`src/pipeline/generate.ts:44`) is
`\banchor\b|\bfloor\b|\binvestment\b`. Over the 172 clarification runs since the validator fix (the 18-run re-run,
three further 18-run sets, and two 50-run arms; their records are under `docs/reviews/`), it ended a run with no draft
4 times, each time on ordinary prose, read in context:

| Run | Matched | Context |
|---|---|---|
| 18-run set q1, `c v3` | `anchor` | "which part of the day they want live music to anchor" (the verb) |
| arm A | `anchor` | the verb ("gently anchor the evening") |
| arm B, h1 | `anchor` | "the wrong call either disappears when it should anchor the room" (the verb) |
| arm B, h1 | `floor` | "a solo guitar disappear under the noise of a dance floor" (a noun) |

The record for arm B (`docs/reviews/2026-10-13-clarification-shape-measurement.md`) holds the last two contexts; the
others are in the session's stored result files, listed below.

**The stored-draft corpus (provenance and limits).** A regex scan of the generate calls logged in 19 result files
(`q1`, `q2`, `q3`, `armA`, `armB` in the session scratchpad: 18 + 18 + 18 + 50 + 50 = 154 runs) found 816 distinct
draft texts. The words searched were `anchor*`, `floor*` and `investment*`. Matches: `anchor` 3, `anchors` 2, `floor`
1, `investment` **0**; all 6 are ordinary prose, **0 are a pricing term**. The old pattern matches the 4 exact words
(the plural `anchors` does not match `\banchor\b`), which are the 4 rejections above. The earlier 18-run re-run (the
validator fix's own record) is not in this corpus (an older file format); its record shows no internal-term hit.
The files are session-local and are NOT reproducible by a reviewer; the replay below records each file's SHA-256 and
the committed evidence is the contexts above, not the corpus.

Each rejection costs a usable run (a no-draft run is unusable under plan 2's estimand). The terms are in the generate
prompt as things not to state ("Do NOT state a price, rate, anchor, floor, or package").

## What is true today (read 2026-10-13)

- The internal terms were kept on purpose: they are Alex's pricing vocabulary, and a draft that says "my anchor
  price" leaks how he prices. V4a, V4b, V4c pin each as rejected with the sentences "The anchor for this is a
  conversation.", "Our floor is a firm number.", "It is a modest investment for the night."
- A price stated with a number is already caught by the dollar, currency-word, spelled-out and k alternatives; the
  internal terms add only the no-number case.
- **Inventory of internal-term detection (bounded):** `PRICE_STATEMENT_PATTERN` alternative 6 is the only place the
  words `anchor` and `floor` are rejected in a draft. `investment` is also in the voice kill list
  (`src/pipeline/post-check.ts:35`, "should say rate instead"), which runs on every mode, so `investment` is rejected
  twice and this plan does not touch it. No other consumer uses the pattern. **Shape assessment: local** (one regex
  alternative and its tests), not structural.

## Decision

D1. Replace `\banchor\b|\bfloor\b` with two pricing-compound alternatives (case-insensitive), singular and plural, and
keep `\binvestment\b` unchanged:

| Alternative | Rejects | Passes (examples) |
|---|---|---|
| `\b(?:anchor|floor)s?\s+(?:prices?|rates?|numbers?|figures?|amounts?|quotes?|pricing)\b` | "anchor price", "floor rates", "anchor quote" | "the floor plan", "a dance floor", "to anchor the room" |
| `\b(?:prices?|rates?|quotes?|pricing)\s+(?:anchor|floor)s?\b` | "price floor", "rate anchors", "quote floors" | "to anchor the room", "the ground floor" |

There is no possessive alternative (the decision record). Each alternative is a fixed literal sequence with one
optional `s`: bounded, no nested quantifier.

D2. Tests V4a and V4b are amended with the approved decision: V4a rejects "My anchor price is a conversation."; V4b
rejects "Our floor price is a firm number."; and "The anchor for this is a conversation." and "Our floor is a firm
number." now return the drafts (they state no price and no pricing noun). V4c is unchanged.

D3. Not done, and why: dropping the internal terms entirely; a possessive alternative (rejects "Our floor is
upstairs"); `(anchor|floor) is|at` (rejects "the dance floor is crowded"); changing the prompt's instruction (a
model-facing change with its own measurement); any change to the number grammar or to `investment`.

## The invariant, stated exactly

After this change a clarification draft is rejected for an internal pricing term only when `anchor` or `floor` forms
a compound with a pricing noun in one of the two forms above, or when it contains `investment`. A bare "anchor" or
"floor" with no pricing noun and no number passes ("the floor is firm", "our anchor sits at the center"); that is
a documented boundary, in the same family as plan 1's unmarked amounts (V10). Accepted false rejects of the compounds:
"price anchors the whole conversation" (the verb after a pricing noun) and a building's "floor number" are rejected.
The boundary is evidenced by 0 of 816 stored drafts using the terms as pricing nouns; it is not a guarantee about
unseen drafts, and the stored drafts were written under the OLD validator and a mix of generate prompts (arm A before
plan 2's change, arm B after).

## Plan Quality Gate

1. **What exactly is changing?** One regex alternative in `src/pipeline/generate.ts` (and its comment); tests V4a and
   V4b amended and V12, V13a, V13a-pl, V13b, V13b-pl, V14, V16 added in `src/clarification-validator.test.ts`; a
   replay script `scripts/clarification-validator-replay.ts`.
2. **What must not change?** The number grammar (V3, V5-V7, V11); the "exactly one question" rule; the bare words
   quote and rate (V1, V2, V10); the error message shape (V7); `investment` (V4c); the generate prompt; the verify
   gate; the voice kill list.
3. **How will we know it worked?** EARS below, each with a per-alternative mutation; plus an offline replay of the old
   and new pattern over the stored corpus (deterministic, free, no model call). The replay is observational, over
   drafts the model wrote under the old validator.
4. **Most likely way this plan is wrong?** The model starts stating the terms in a form the two compounds miss
   ("the anchor is firm"), which states no price; the boundary is documented and the replay counts each term's uses so
   the next measurement shows it. Second: an ordinary compound is rejected ("price anchors the conversation"); named
   in the invariant, 0 observed.
5. **How will a human RUN this, and when?** Claude Code (or Alex) on the MacBook after the code step and before the
   Codex code review: the command in the Execution Path, offline.

## Acceptance Tests (EARS)

Names start `Clarification V<n>`; file `src/clarification-validator.test.ts` (each test calls `generateResponse` with
a stubbed model, as V1-V11 do).

- **V4a (amended)** WHEN a draft contains "My anchor price is a conversation.", THE SYSTEM SHALL throw `must not
  include pricing language`; WHEN it contains "The anchor for this is a conversation.", THE SYSTEM SHALL return the
  drafts.
- **V4b (amended)** WHEN a draft contains "Our floor price is a firm number.", THE SYSTEM SHALL throw; WHEN it
  contains "Our floor is a firm number.", THE SYSTEM SHALL return the drafts.
- **V12** WHEN a draft uses `anchor` as a verb or `floor` as an ordinary noun ("to anchor the room", "the art anchors
  the evening", "a dance floor", "the ground floor", "on the floor", "my floor plan", "My anchor is my family.",
  "Our floor is upstairs.", "Our floor is crowded tonight."), THE SYSTEM SHALL return the drafts.
- **V13a** WHEN a draft contains `anchor`/`floor` followed by a pricing noun, singular ("The anchor price is firm.",
  "A floor rate applies.", "An anchor quote helps."), THE SYSTEM SHALL throw and name the matched text.
  **V13a-pl** the same for the plural ("Anchor prices vary.", "Floor rates apply.").
- **V13b** WHEN a draft contains a pricing noun followed by `anchor`/`floor` ("The price floor is firm.", "A rate
  anchor helps.", "Pricing anchor first."), THE SYSTEM SHALL throw. **V13b-pl** the plural ("Price floors differ.",
  "Rate anchors help.", "Quote floors vary.").
- **V14** WHEN a draft contains `investment`, THE SYSTEM SHALL throw (V4c, unchanged); WHEN it contains "a floor of
  four hundred dollars", THE SYSTEM SHALL throw through the number alternative (a positive control that the narrowing
  did not open that case).
- **V16 (the documented boundary)** WHEN a draft contains "The floor is firm." or "Our anchor sits at the center.",
  THE SYSTEM SHALL return the drafts.

Mutation map (each must fail the named tests; the per-alternative tests make the isolation real): alternative 1
removed (V13a, V13a-pl, V4a, V4b); alternative 2 removed (V13b, V13b-pl); the plural `s?` removed from alternative 1
(V13a-pl); from alternative 2 (V13b-pl); the bare `\banchor\b|\bfloor\b` restored (V12, V16, V4a, V4b); `investment`
removed (V14); `quote` removed from the noun list of alternative 2 (V13b-pl).

## Work steps (one concern per commit; failing test first)

1. V4a and V4b (amended) and V12, V13a/V13a-pl/V13b/V13b-pl, V14, V16 first; confirm V12, V16 and the amended V4a/V4b
   pass-cases fail on today's code, V13a/V13b and V14 behave as listed (the compounds are caught by the bare word).
2. The alternatives and their comment.
3. The mutation map; full suite, `tsc`, leak check.
4. The offline replay script and its record.

## Execution Path

- **Target:** Alex's MacBook, offline (no model call, no network, no API key).
- **Mechanism:** `scripts/clarification-validator-replay.ts` loads every `clarification-*.json` under the directories
  named on the command line, takes each distinct `full_draft` and `compressed_draft` from every generate call, and
  counts matches of the OLD alternative (copied into the script as a labelled constant) and of the NEW pattern,
  printing counts and the context of every draft the old pattern matched and the new one does not, and the SHA-256 of
  each input file. It exits **2** with a one-line message if a directory does not exist, contains no
  `clarification-*.json`, or yields zero drafts: an empty input cannot read as "no matches".
- **Command (exact), from the repo root:**
  `S=/private/tmp/claude-501/-Users-alejandroguillen-Projects-gig-lead-responder/d92dc97e-5fe9-4d8a-a27e-41a8b53a7a33/scratchpad; npx tsx scripts/clarification-validator-replay.ts $S/q1 $S/q2 $S/q3 $S/armA $S/armB`
  (the five directories above, session-local).
- **Prerequisites:** ALREADY HAVE: Node, `npm`, `tsx`, and the five directories (CHECKED 2026-10-13: 19 files, 154
  runs, 816 distinct drafts). MUST OBTAIN: none. NONE other.
- **Output:** counts, contexts and file hashes, recorded in
  `docs/reviews/2026-10-13-clarification-internal-terms-replay.md`.
- **Who:** Claude Code or Alex. **Trigger:** after step 3.
- **Expected (a hypothesis until run):** the old pattern matches 4 drafts (anchor 3, floor 1); the new matches 0; no
  draft in the corpus holds a pricing compound. What this does NOT show: that unseen drafts never use the terms as
  pricing nouns, or that the stored drafts (written under the old validator and prompts) represent them.

## Feed-Forward

- **Hardest decision:** whether to narrow the terms or drop them, and whether to keep the possessive. Alex chose
  compounds only after seeing the evidence: 4 observed false rejects, 0 observed pricing uses.
- **Rejected:** removing the terms; the possessive form (rejects "Our floor is upstairs"); `(anchor|floor) is`;
  changing the prompt; a model-facing re-measurement (the replay is deterministic and free).
- **Least confident:** that the two compound forms cover how the model would actually leak the terms. 0 of 816 drafts
  used them at all, so the forms are a reasoned list, not an observed one.

## Three Questions

1. **Hardest decision in this session?** Treating the weakening of a guarantee Alex set as a decision to ask, not to
   state, and recording the answer in the plan.
2. **What did you reject, and why?** The possessive (it reproduces the false reject), "(anchor|floor) is" (rejects
   "the dance floor is crowded"), and a prompt change (needs its own measurement).
3. **Least confident about going into the next phase?** That the compound forms are a complete list of how the
   terms would leak; they are inferred.
