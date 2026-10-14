---
title: "feat: a vague lead gets the default format quoted with one question, not a no-price clarification"
date: 2026-10-13
status: plan, Revision 1b (plan review R1 NO-GO, 5 P1 / 1 P2, answered in Revision 1; R2 NO-GO, one P1 and one P2 in the measurement text, answered in Revision 1b at the cap; the salutation was answered (a) by Alex 2026-10-13; Alex chose to fix and build, no round 3)
branch: feat/hub-phase0
---

# Vague lead: quote the default format and ask one binary question

### Prior Phase Risk

Predecessor: `docs/plans/2026-10-13-fix-clarification-draft-shape-plan.md`. Its "least confident" answer, quoted from
`docs/solutions/architecture/2026-10-13-a-shorter-instruction-shortens-the-reply-not-the-scene-two-arm-measurement.md`:
"that two verified drafts of 11 generalise, and that the reference reply will move the scene." The reference reply
arrived from Alex himself and answers a different question than that plan asked: it is not a better clarification
reply, it is the shape his own system sends. This plan changes the route so the app produces it. The risk carried
forward: one model and made-up leads, so every measurement here is exploratory and descriptive.

## Decision record (answers given by Alex in chat, 2026-10-13)

- **The route.** He pasted the output of his Claude.ai Project (the older responder) for the made-up lead "my parents'
  30th anniversary in the spring ... not sure what kind of music or how many players". Its classification: "Vague
  -> ONE binary question"; its summary: "The system says to ask one binary question, default to solo guitar, and
  quote that default." He then answered **yes** to: "a vague, low-competition lead gets an assumed default format, its
  price and terms from the app, and one binary question (your shape)".
- **The footer.** "Drop the footer from the reference": the reference ends with `Alex Guillen`.
- **"Send it over".** His Project said "it" is the date; he chose his own wording (below).
- **COI: yes.** The reference includes the app's default sentence "COI available upon request.".
- **The date sentence, his exact words:** "Send me the date once you have it and I'll check my calendar. A 50% deposit
  holds the date." (The second sentence is the app's payment sentence exactly.)
- **The salutation: option (a).** The reference opens with a name ("Hi Dana,", as the T4 reference does) and the
  generate prompt's nameless-lead rule ("omit salutation") stays unchanged. He answered "a" to (a) a name in the
  reference, nameless rule stays; (b) change the rule to "Hi there,"; (c) no salutation in the reference.
- **Volume: no rule added.** Asked whether "no volume commitments" should be an app rule, he answered "no that's not a
  guarantee". Read as: no new rule is added; the reference describes how the guitar sits, it does not promise a
  level. If he meant something else, this line is the one to correct.

## Problem (measured, not assumed)

For a vague, low-competition lead the app sends no price: in clarification mode (`action: one_question` AND
`format_recommended: unresolved`) the generate prompt, the validator and the verify gate all forbid a price. Over 100
real runs of the clarification set, 38% and 34% of runs were unusable (no draft, structural scene, or competitor
test), 7 of 43 and 11 of 44 drafts verified, and the model was asked for a shape (no price, 70-100 words) that is
not the one Alex sends.

Alex's own reply to the made-up lead states $700, the setup needs, the payment sentence and one binary question.
Through the real verify gate as a quote (assume_and_quote, solo, $700 anchor / $650 floor), 3 runs: **with the contact
footer, fail x3** (`sounds_like_alex`: the footer); **without it, pass x3** (scene cinematic, competitor false, no
false check; `docs/reviews/2026-10-13-clarification-alex-reference-reply-vs-app.md`). The price is the app's own:
`lookupPrice` returns T2D $700 / $650 for a direct lead and T2P $595 / $550 for a platform lead.

## What is true today (read 2026-10-13; the route diagnosis was confirmed by plan review R1, item 7)

- **The classifier has two rules that combine into the clarification mode** (`src/prompts/classify.ts:64-74`): the
  decision gate "Vague + Low -> one_question; Vague + Medium/High/Extreme -> assume_and_quote", and a SPECIAL CASE:
  "a vague category with no defensible format recommendation yet (examples: "Latin band", "music", "entertainment" ...)
  ... set action = one_question and format_recommended = unresolved. Do NOT force a quote yet." It is the SPECIAL CASE
  that removes the price.
- **A `one_question` lead with a resolved format already quotes.** `isClarificationLead` is true only for
  `unresolved`; otherwise `lookupPrice` and the budget gap run, `quoteTermsOff` is false (unless residency or
  `no_viable_scope`), the validator at `src/pipeline/generate.ts:147` and the verify prompt's clarification lines do
  not fire, and the generate prompt builds the normal quote path with the Sparse-lead Type 4 instruction ("ask
  exactly ONE binary question", `src/prompts/generate.ts:177-181`). Nothing in that path is specific to
  `assume_and_quote`. The automation router holds every vague `one_question` lead for Alex
  (`src/automation/router.ts:87`): nothing auto-sends.
- **Clarification mode** is `action === "one_question" && format_recommended === "unresolved"` in seven places
  (`prompts/generate.ts` x3, `pipeline/generate.ts:147`, `payment-terms.ts:55`, `run-pipeline.ts:33`,
  `prompts/verify.ts:60`).
- **Format routing** (`src/prompts/classify.ts:127-138`): generic "Spanish guitar" or "Latin music" -> solo
  (background) or duo (cocktail/dinner); duration defaults to 2.
- **The hard gate** (`src/pipeline/hard-gate.ts:20-28, 94`) declines only the band formats it lists: "rock band",
  "country band", "cover band". A generic "Latin band" is NOT declined; today the classifier's SPECIAL CASE makes it
  `unresolved`.
- **Quote Terms variants** (`src/pipeline/payment-terms.ts:60-65`, `src/pipeline/coi.ts:26`): payment is
  `platform` for GigSalad and The Bash, `unknown_platform` for a hand-run "P" lead with no platform, otherwise a
  date-based sentence (`noDate` with no date); COI is the default sentence or, when `coi_required`, the timeline one.
- **Reference-lead pattern** exists: the T4 reference (`src/data/t4-reference.ts`, `buildT4ReferenceSection` at
  `src/prompts/generate.ts:205-223`) withholds its block for `quoteTermsOff`, a large budget gap, a graceful decline
  and a past date, and tells the model the payment and COI sentences come from Quote Terms, not from the example.

## Decision

D1. **The route and the "Latin band" boundary** (answers R1 item 2). In `src/prompts/classify.ts` the SPECIAL CASE
is split on what the client asked for:

| The lead asks for | `format_requested` | `format_recommended` | Hard gate | Router | Price |
|---|---|---|---|---|---|
| a CATEGORY with no format named ("music", "entertainment", "live music", "Latin music", "Spanish guitar", "not sure what kind of music") | the words used | **solo**, or **duo** when the lead names a dinner, cocktail or dancing setting (the existing format routing) | passes | holds (vague + `one_question`) | the table's price for that format |
| an ENSEMBLE or band format it cannot default ("Latin band", "a band", "a trio", "a quartet", "an orchestra") | the ensemble words | **unresolved** (as today) | the listed band formats still decline; "Latin band" passes | holds | none (clarification mode, as today) |

So clarification mode stays live for the explicit-ensemble case and is no longer used for a category-only request.
The default is Alex's own ("default to solo guitar"). Exact wording goes through plan review; the boundary words are
fixed here.

D2. **The reference block and its gate** (answers R1 items 1 and 5). A new module `src/data/vague-quote-reference.ts`
mirrors the T4 reference: one reply, `[QUOTED_PRICE]` as the price, wired only into `buildGeneratePrompt`. The block
is included only when ALL hold; otherwise it is withheld (each a test, V2):

| Condition (block applies when) | Why |
|---|---|
| `action === "one_question"`, `vagueness === "vague"`, `format_recommended` is `solo` or `duo` | the route this plan creates |
| not `quoteTermsOff` (clarification, `no_viable_scope`, residency) | no quote terms, so no reference quote |
| `pricing.budget.tier !== "large"` | the large gap has its own two-price shape (as T4) |
| `graceful_decline !== true` | an exit line, no pitch (as T4) |
| `past_date_detected !== true` | the year is confirmed first (as T4) |
| `paymentTermsFor(...).kind === "sentence"` | the example shows a payment sentence; `platform` and `unknown_platform` leads state none, so the example would contradict them |
| `nonprofit_buyer !== true` | NP2 has its own price block and in-kind line |
| `cultural_context_active !== true` and `delivery_mode` not `alex_sources`/`hybrid` | the example is Alex's own solo Spanish guitar; a sourced or cultural format has its own voice and claims |

**Not a withholding condition:** `coi_required` and the date-based payment sentence variants. As in T4, the block
says the example's payment and COI sentences are the DEFAULT ones for a lead with no date and no COI requirement,
and that the real sentences come from the Quote Terms section, copied exactly.

D3. **V4 is rewritten** (R1 item 1): the block says "no sentence of the example may appear in your draft, EXCEPT the
sentences the Quote Terms section requires (the payment sentence and the COI sentence), which you copy from Quote
Terms exactly". The example's own images, its question and its moves are not to be reused; the question for THIS lead
is its own.

D4. **Not done, and why:** removing clarification mode (it still serves the explicit-ensemble case); changing the
validator or the verify prompt (the quote path already passes Alex's footer-less reply); a code check forcing
exactly one `?` in this mode (a failed check with no retry ends in no draft: clarification mode lost 10% of its runs
to that rule); the contact footer (Alex dropped it); the router (it already holds these leads).

## The invariant, stated exactly

For a category-only vague lead the classifier names a default format, the app quotes it from the price table with
the app's payment and COI sentences, and the model writes ONE binary question. For an explicit ensemble request the
mode is unchanged. Nothing in code enforces "exactly one question" or the shape; the verifier and the measurement are
the checks, and both are model-dependent. The example is a shape, not a source of facts.

## The reference reply (final wording)

Alex's reply, footer dropped, with his answers applied (COI, the date sentence, the salutation). The price is the
placeholder; the payment and COI sentences are the app's constants and appear once each; the date sentence is his.
"Dana" is a placeholder first name, as in T4; the salutation exists only because the example's lead has a name.

```
Hi Dana,

Picture your parents' 30th: toasts done, the guitar soft enough that one of them reaches for the other's hand without deciding to. You're the one making sure thirty years gets celebrated out loud.

The usual mistake is booking by headcount, then nobody can hear the toasts. For parties like this, most families go with solo Spanish guitar: warm covers and standards that sit under the conversation. Bigger crowd or dancing, I add a second musician. Background while people talk, or a dance floor?

Two hours solo is [QUOTED_PRICE]. I bring my own sound and need one outlet and an armless chair, so home, backyard, or restaurant all work. COI available upon request. Send me the date once you have it and I'll check my calendar. A 50% deposit holds the date.

Alex Guillen
```

## Resolved: the salutation

**Alex chose (a)** (2026-10-13). His reply had opened "Hi there,", which the generate prompt's SALUTATION rule
(`src/prompts/generate.ts:98`: no client name, "omit salutation and start directly with the cinematic opening")
contradicts. The reference now opens "Hi Dana,", the SALUTATION rule is unchanged, and a nameless lead still gets no
salutation. (b), changing the rule for every nameless lead, was not chosen and would need its own plan.

**Stop condition kept (R1 item 3), narrowed:** no production code until plan review passes (the salutation no
longer blocks it). Plan documents and tests-as-specifications may be revised in the meantime.

## Plan Quality Gate

1. **What exactly is changing?** The classifier prompt's SPECIAL CASE (split by D1); a new reference module and its
   block in the generate prompt (gated by D2); tests; runner and report fields; one measurement.
2. **What must not change?** The price table and `lookupPrice`; the payment and COI sentences and their checks;
   clarification mode's code and its explicit-ensemble use; the verify prompt and the validators; the router; the
   generate prompt for every lead the block does not apply to (SHA-256 pins, V7); the T4 reference and its
   withholding; the SALUTATION rule (until Alex says otherwise).
3. **How will we know it worked?** EARS below with a mutation each; plus a descriptive arm B (below). It is
   **descriptive, not causal**: arm A (the clarification prompt of plan 2) and arm B differ in the classifier's route
   AND in the prompt shape, so no difference is attributed to either change alone.
4. **Most likely way this plan is wrong?** The classifier still says `unresolved` for some category-only leads (it is
   a model reading a prompt), so some replies stay no-price; the measurement counts it. Second: the model copies the
   example's sentences or its question; V8's instrumentation reports shared windows and the questions are read.
5. **How will a human RUN this, and when?** Claude Code (or Alex) on the MacBook after the code steps and before the
   Codex code review: the Execution Path command.

## Acceptance Tests (EARS)

Names start `Vague Reference V<n>`; file `src/vague-quote-reference.test.ts`. Hash inventory below.

- **V1** WHEN the classification meets every D2 condition, THE SYSTEM SHALL include the reference block exactly once
  in the generate prompt, after the voice examples and before the reasoning step.
- **V2** WHEN exactly ONE D2 condition fails (each its own test): clarification (`unresolved`); `quote`;
  `assume_and_quote`; a graceful decline; `no_viable_scope`; a residency; a past date; a large budget gap; GigSalad;
  The Bash; an unknown-platform "P" lead; a nonprofit buyer; cultural context active; `alex_sources`; `hybrid`; a
  format other than solo/duo, THE SYSTEM SHALL NOT include the block. **Positive controls:** `coi_required: true` and
  a small budget gap still get the block.
- **V3** WHEN the block is built, THE SYSTEM SHALL contain the example reply with `[QUOTED_PRICE]`, no dollar figure,
  no phone number, no business name, and sign off with `Alex Guillen` only.
- **V4** WHEN the block is built, THE SYSTEM SHALL state that the payment and COI sentences come from Quote Terms
  only and are copied exactly, that the question must be this lead's own and not the example's, and that no other
  sentence of the example may appear (the exemption of D3).
- **V5** WHEN the example reply is scanned, THE SYSTEM SHALL carry the app's `noDate` payment sentence and the default
  COI sentence (from the code constants) exactly once each, Alex's date sentence once, and exactly one question mark.
- **V6** WHEN the classifier prompt is built, THE SYSTEM SHALL contain the D1 split: the category-only case names the
  default (`solo`, or `duo` for a dinner/cocktail/dance setting) and the ensemble case keeps `unresolved`.
- **V7 (hash inventory)** WHEN the generate prompt is built for the cases below, THE SYSTEM SHALL equal the stored
  pre-change SHA-256 for the UNCHANGED cases and DIFFER from it for the CHANGED cases:

| Case | Built as | Expected |
|---|---|---|
| C0-C7, C9-C12 (plan 2's inventory) | as in `src/generate-prompt-cases.ts` (terms: `GigSalad` -> `platform`, otherwise the fixed `noDate` sentence) | **unchanged** |
| C8 | `one_question`, vague, solo, no platform, terms `sentence` (as the inventory builds it) | **changed**: every D2 condition holds, so the block is added. (The gate reads the `paymentTerms` argument, not `lead_source_column`; round 1 of this plan wrongly called C8 unchanged.) |
| C13 | C8's classification with GigSalad and `platform` terms | **unchanged** (platform payment withholds the block) |
| C14 | C8's classification with `unknown_platform` terms | **unchanged** (withheld) |
| C15 | `one_question`, vague, duo, terms `sentence` | **changed** |
| C16 | as C8 with `coi_required: true` | **changed** (the block applies; Quote Terms carries the timeline sentence) |
| C17 | as C8 with `nonprofit_buyer: true` | **unchanged** (NP2 withholds the block) |

The CHANGED cases are C8, C15 and C16; every other case must hash to its pre-change value. The V2 withheld tests are
the per-condition version of the same facts.

- **V9** WHEN the report computes the COI-sentence denominator, THE SYSTEM SHALL include a returned draft of an
  ordinary quote (`coiTermsFor` kind `sentence`), and SHALL exclude a graceful decline, a clarification and a
  residency (kind `none`); and WHEN the arm has other than 5 files and 50 runs, `assessArms` SHALL return VOID (the
  50-run shape is the invariant of this measurement).
- **V8 (measurement instrumentation, NOT an acceptance gate)** The copy-check function `sharedWindows(draft,
  example, mandatedSentences)` reports the 30-character windows a draft shares with the example after cutting the
  app-mandated sentences. Deterministic tests of the function: **V8a** a planted 40-character clause shared with the
  example is found; **V8b** unrelated text returns 0; **V8c** the mandated sentences alone return 0 (positive
  control: the cut works). The report's use of it is observational (no pass bar).

Mutation map (each must fail the named tests): the block applied to every mode (V2, V7); the format check dropped
(V2 non-solo/duo); the platform check dropped (V2 GigSalad/Bash/unknown); a dollar figure left in the example (V3);
the payment sentence edited (V5); the "own question" line removed (V4); the SPECIAL CASE restored (V6); `coi_required`
made a withholding condition (V2 positive control); `sharedWindows` ignoring the cut (V8c).

## The measurement (pre-registered; descriptive, exploratory)

Arm B only: `--arm B --runs 1`, five processes, the ten leads of plan 2 (v1-v6, h1-h4): **50 runs** (ten leads x
five processes), the arm shape the report already requires (`ARM_SHAPE`: 5 files, 50 runs). The made-up lead r1,
the one the reference was written for, is deliberately NOT in the measurement: the example's own lead must not sit
in the data it is meant to steer. Arm A is the recorded plan 2 arm A (50 runs, the clarification prompt). **No causal
claim**: the classifier route and the prompt shape both differ.

Formulas (the runner and report gain the fields; denominators fixed in advance):

| Metric | Numerator | Denominator |
|---|---|---|
| Classifier distribution | runs with `format_recommended` = `solo`, `duo`, `unresolved`, other | all 50 runs that reached classification (a classification error is its own count) |
| Returned draft | runs with `ok: true` | all 50 |
| Quote at the app's price | returned drafts whose `full_draft` contains the dollar figure `$` + `pricing.quote_price` | returned drafts with a resolved format |
| Verified | returned drafts with `verified: true` | returned drafts |
| One question | returned drafts with exactly one `?` in `full_draft` | returned drafts |
| Payment sentence once | returned drafts containing the app's sentence for that lead exactly once | returned drafts with `paymentTermsFor` kind `sentence` |
| COI sentence once | returned drafts containing the COI sentence for that lead exactly once | returned drafts whose computed `coiTermsFor(...).kind` is `sentence` (the runner records the kind; a graceful decline is `quoteTermsOff` false but `none`, so it is excluded) |
| No footer | returned drafts with no `(619)` and no `Pacific Flow` | returned drafts |
| Shared windows with the example | per returned draft, the count from `sharedWindows`; report the maximum and the number of drafts above 0 | returned drafts |

Interpretation, decided before the run: a count is a description of what the model wrote on these runs. A shared
window above 0 is read draft by draft; "unresolved" runs are reported as the no-price route and not as failures of
the plan; no number is a pass bar, and any difference from arm A is reported as a difference, not as an effect.

## Work steps (one concern per commit; failing test first)

0. **HARD STOP.** Plan review R2 (or its closing decision by Alex). No production code before. (The salutation is
   resolved: option (a).)
1. The hash inventory extended with C13-C17 from the CURRENT code; V2 (withheld cases) and V7's unchanged rows pass.
2. V1, V3-V6 (failing), then the reference module, the block, and the classifier wording.
3. The runner fields (including the `coiTermsFor` kind), the report formulas and `sharedWindows` with V8a-c and V9;
   the mutation map; full suite, `tsc`, leak check.
4. Arm B run, the report, and `docs/reviews/2026-10-13-vague-quote-measurement.md`.

## Execution Path

- **Target:** Alex's MacBook, the real pipeline through `scripts/clarification-measure.ts` (`--arm B`), real model,
  scratch databases (nothing sent; `data/leads.db` untouched).
- **Mechanism:** the committed runner and `scripts/clarification-arm-report.ts` (counts only), with the new fields
  above; the report prints the formula table's counts and, for the shared-window metric, the maximum and the count.
- **Command (exact), from the repo root:**
  `OUT=$(mktemp -d /tmp/vague-quote.XXXXXX); echo "$OUT"; for t in 1 2 3 4 5; do npx tsx scripts/clarification-measure.ts --arm B --runs 1 --tag B$t --out "$OUT" --today 2026-10-12 & done; wait`
  (the ten leads run in each process; 50 runs in total).
- **Prerequisites:** ALREADY HAVE: Node, `npm`, `tsx`, `ANTHROPIC_API_KEY` in `.env`, network (used for the earlier
  measurement runs). MUST OBTAIN: none. NONE other.
- **Who:** Claude Code or Alex. **Trigger:** after step 3. About 25 minutes; the spend of one arm of plan 2.
- **Expected (a hypothesis until run):** the classifier returns `unresolved` for few runs (the lead texts are all
  category-only); most drafts are quotes at the app's price with one question. What this does NOT show: real leads,
  other models, or that the example is not being copied.

## Feed-Forward

- **Hardest decision:** treating Alex's reply as a reference for a ROUTE change, and keeping clarification mode for
  the explicit-ensemble case instead of removing it.
- **Rejected:** removing clarification mode; a code check for one question; keeping the footer; editing the verify
  prompt for a reply it already passes; a causal comparison with arm A.
- **Least confident:** that the classifier will name a default format for a category-only request on a
  prompt-wording change alone, and that the gate predicate covers every mode whose terms contradict the example.

## Three Questions

1. **Hardest decision in this session?** Reading the reply as a route change after four cycles tuned the other mode,
   then finding the gate had to exclude every quote-terms variant the example's fixed sentences would contradict.
2. **What did you reject, and why?** A forced one-question check (it ends in no draft), deleting the mode (it still
   serves the explicit-ensemble case), and a causal claim (the two arms differ in route and prompt).
3. **Least confident about going into the next phase?** The classifier following the new wording; the route is a
   model's reading of one paragraph.
