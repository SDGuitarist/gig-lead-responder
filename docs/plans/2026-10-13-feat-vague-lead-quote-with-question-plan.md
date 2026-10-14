---
title: "feat: a vague lead gets the default format quoted with one question, not a no-price clarification"
date: 2026-10-13
status: plan, Revision 0 (not yet reviewed; the reference wording is final except the salutation, which is PENDING ALEX, see "Pending Alex")
branch: feat/hub-phase0
---

# Vague lead: quote the default format and ask one binary question

### Prior Phase Risk

Predecessor: `docs/plans/2026-10-13-fix-clarification-draft-shape-plan.md`. Its "least confident" answer, quoted from
`docs/solutions/architecture/2026-10-13-a-shorter-instruction-shortens-the-reply-not-the-scene-two-arm-measurement.md`:
"that two verified drafts of 11 generalise, and that the reference reply will move the scene." The reference reply
arrived from Alex himself and answers a different question than the one that plan asked: it is not a better
clarification reply, it is the shape his own system sends. This plan changes the route so the app produces it. The
risk carried forward: the same model and made-up leads, so every measurement here is exploratory.

## Decision record (answers given by Alex in chat, 2026-10-13)

- **The route.** He pasted the output of his Claude.ai Project (the older responder) for the made-up lead "my parents'
  30th anniversary in the spring ... not sure what kind of music or how many players". Its classification: "Vague
  -> ONE binary question"; its summary: "The system says to ask one binary question, default to solo guitar, and
  quote that default." He then answered **yes** to: "a vague, low-competition lead gets an assumed default format, its
  price and terms from the app, and one binary question (your shape)".
- **The footer.** "Drop the footer from the reference": the reference ends with `Alex Guillen`.
- **"Send it over".** His Project, asked, said "it" is the date and offered two rewrites (see Pending Alex).
- **The reference text** is his reply (the Project output he called "the appropriate response") without the footer.
- **COI: yes.** The reference includes the app's default sentence "COI available upon request.".
- **The date sentence, his exact words:** "Send me the date once you have it and I'll check my calendar. A 50% deposit
  holds the date." (The second sentence is the app's payment sentence exactly.)
- **Volume: no rule added.** Asked whether "no volume commitments" should be an app rule, he answered "no that's not a
  guarantee". Read as: no new rule is added; the reference describes how the guitar sits, it does not promise a
  level. If he meant something else, this line is the one to correct.

## Problem (measured, not assumed)

For a vague, low-competition lead the app sends no price: in clarification mode (`action: one_question` AND
`format_recommended: unresolved`) the generate prompt, the validator and the verify gate all forbid a price
(`src/prompts/generate.ts`, `src/pipeline/generate.ts:147`, `src/prompts/verify.ts`). Over 100 real runs of the
clarification set, 38% and 34% of runs were unusable (no draft, structural scene, or competitor test), 7 of 43 and 11
of 44 drafts verified, and the model was asked for a shape (no price, 70-100 words) that is not the one Alex sends.

Alex's own reply to the made-up lead states $700, the setup needs, the payment sentence and one binary question.
Through the real verify gate as a quote (assume_and_quote, solo, $700 anchor / $650 floor), 3 runs: **with the
contact footer, fail x3** (`sounds_like_alex`: the footer); **without it, pass x3** (scene cinematic, competitor
false, no false check; `docs/reviews/2026-10-13-clarification-alex-reference-reply-vs-app.md`). The price is the
app's own: `lookupPrice` returns T2D $700 / $650 for a direct lead and T2P $595 / $550 for a platform lead.

## What is true today (read 2026-10-13)

- **The classifier has two rules that combine into the clarification mode** (`src/prompts/classify.ts:64-74`):
  the decision gate "Vague + Low -> one_question; Vague + Medium/High/Extreme -> assume_and_quote", and a SPECIAL CASE:
  "a vague category with no defensible format recommendation yet ... set action = one_question and
  format_recommended = unresolved. Do NOT force a quote yet." It is the SPECIAL CASE that removes the price.
- **A `one_question` lead with a resolved format already quotes.** `isClarificationLead`
  (`src/run-pipeline.ts:32`) is true only for `unresolved`; otherwise `lookupPrice` and the budget gap run and the
  generate prompt builds the normal quote path with the Sparse-lead Type 4 instruction ("ask exactly ONE binary
  question", `src/prompts/generate.ts:177-181`). The automation router holds every vague `one_question` lead for
  Alex (`src/automation/router.ts:87`): nothing auto-sends.
- **Clarification mode** is `action === "one_question" && format_recommended === "unresolved"` in seven places
  (`prompts/generate.ts` x3, `pipeline/generate.ts:147`, `payment-terms.ts:55`, `run-pipeline.ts:33`,
  `prompts/verify.ts:60`). `quoteTermsOff` makes it carry no payment, COI or setup-needs lines.
- **Format routing** (`src/prompts/classify.ts:130-137`): generic "Spanish guitar" or "Latin music" -> solo
  (background) or duo (cocktail/dinner); duration defaults to 2.
- **Reference-lead pattern** exists: the T4 reference (`src/data/t4-reference.ts`, plan 2026-10-11): one approved
  reply, anonymised, a price placeholder, "take the ORDER, not the sentences", withheld in modes with their own
  shape, a copy check by 30-character windows, tests T1-T7.

## Decision

D1. **The route.** In `src/prompts/classify.ts` the SPECIAL CASE no longer sets `unresolved` for a vague request.
It sets `action = "one_question"` and `format_recommended` to the default: **solo**, or **duo** when the lead
names a dinner, cocktail or dancing setting (exact words go through plan review). `unresolved` stays a valid value
(hard-gate declines use it) but the classifier is told not to use it for a vague request. Everything downstream
already treats `one_question` + a resolved format as a priced lead; no pipeline code changes for the route itself.

D2. **The reference block.** A new module `src/data/vague-quote-reference.ts` mirrors the T4 reference: one reply,
[QUOTED_PRICE] as the price, the app's payment and COI sentences as constants, a block that says "take the ORDER,
not the sentences", withheld unless `action === "one_question"` AND `vagueness === "vague"` AND the format is
resolved AND the response mode has no shape of its own (not graceful decline, not `no_viable_scope`, not a large
budget gap, not residency, not a past date), wired only into `buildGeneratePrompt`, with the T4-style rules (no
invented facts, payment and COI sentences from Quote Terms only, no reuse of the example's own moves).

D3. **The question is the lead's, not the example's.** The block tells the model the one binary question must
narrow the musical direction for THIS lead and must not be the example's own question; a 30-character copy check
(after cutting the app-mandated sentences) runs as in T4.

D4. **Not done, and why:** removing clarification mode's code (dormant, covered by the V and G suites,
reachable if the classifier ever returns `unresolved`); changing the validator or the verify prompt (the quote path already passes
Alex's footer-less reply); a code check forcing exactly one `?` in this mode (a failed check with no retry ends in
no draft: clarification mode lost 10% of its runs to that rule); the contact footer (Alex dropped it); the router
(it already holds these leads for Alex).

## The invariant, stated exactly

For a vague lead the classifier names a default format, the app quotes it from the price table with the app's
payment and COI sentences, and the model writes ONE binary question. Nothing in code enforces "exactly one
question" or the shape; the verifier and the measurement are the checks, and both are model-dependent. The example
is a shape, not a source of facts.

## The reference reply (final wording, except the salutation)

Alex's reply, footer dropped, with the three answers applied. The price is the placeholder; the payment and COI
sentences are the app's constants and appear once each; the date sentence is his.

```
[SALUTATION: PENDING ALEX, see below]

Picture your parents' 30th: toasts done, the guitar soft enough that one of them reaches for the other's hand without deciding to. You're the one making sure thirty years gets celebrated out loud.

The usual mistake is booking by headcount, then nobody can hear the toasts. For parties like this, most families go with solo Spanish guitar: warm covers and standards that sit under the conversation. Bigger crowd or dancing, I add a second musician. Background while people talk, or a dance floor?

Two hours solo is [QUOTED_PRICE]. I bring my own sound and need one outlet and an armless chair, so home, backyard, or restaurant all work. COI available upon request. Send me the date once you have it and I'll check my calendar. A 50% deposit holds the date.

Alex Guillen
```

Facts: exactly one `?`; no dollar figure; no phone, business name or footer; the payment sentence "A 50% deposit
holds the date." once (the app's `noDate` sentence); "COI available upon request." once (the app's default). The
scene ("toasts done ... reaches for the other's hand") is Alex's, written for that lead; the block says not to reuse
its images.

## Pending Alex

1. **The salutation.** His reply opens "Hi there,". The generate prompt's SALUTATION rule
   (`src/prompts/generate.ts:98`) says that with no client name the draft must "omit salutation and start directly
   with the cinematic opening". A reference that shows "Hi there," teaches the opposite of the rule. Options:
   (a) the reference opens with a name ("Hi Dana,", as T4 does) and the nameless rule stays; (b) the rule changes to
   allow "Hi there," for a lead with no name (his practice); (c) the reference has no salutation. Default proposed:
   (a), the smallest change; (b) is a change to every nameless lead and would need its own check. His call.

## Plan Quality Gate

1. **What exactly is changing?** The classifier prompt's SPECIAL CASE wording; a new reference module and its block
   in the generate prompt; tests; one measurement.
2. **What must not change?** The price table and `lookupPrice`; the payment and COI sentences and their checks;
   clarification mode's code (dormant); the verify prompt and the validators; the router; the generate prompt for
   every lead the block does not apply to (SHA-256 pins as in plan 2); the T4 reference and its withholding.
3. **How will we know it worked?** EARS below with a mutation each; plus an arm B measurement against arm A on the
   same ten leads: the classifier's `format_recommended` distribution, the share of returned drafts that are quotes at
   the app's price, the verified rate, and the mechanical checks. Exploratory: 50 runs, one model, made-up leads.
4. **Most likely way this plan is wrong?** The classifier still says `unresolved` for some vague leads (it is a model
   reading a prompt), so some replies stay no-price; the measurement counts it. Second: the model copies the
   example's sentences or its question; the copy check and the "not the example's question" rule address it, and
   the measurement reads the questions.
5. **How will a human RUN this, and when?** Claude Code (or Alex) on the MacBook after the code steps and before the
   Codex code review: the arm B command from plan 2 (`--arm B`, five processes), plus the new report fields.

## Acceptance Tests (EARS)

Names start `Vague Reference V<n>`; file `src/vague-quote-reference.test.ts`.

- **V1** WHEN the classification is `one_question`, vague, with a resolved format, THE SYSTEM SHALL include the
  reference block exactly once in the generate prompt, after the voice examples and before the reasoning step.
- **V2** WHEN the classification is clarification (`unresolved`), a quote, `assume_and_quote`, a graceful decline,
  `no_viable_scope`, a residency, or a past date, THE SYSTEM SHALL NOT include the block (each its own case).
- **V3** WHEN the block is built, THE SYSTEM SHALL contain the example reply with [QUOTED_PRICE], no dollar figure,
  no phone number, no business name, and sign off with `Alex Guillen` only.
- **V4** WHEN the block is built, THE SYSTEM SHALL state that the payment and COI sentences come from Quote Terms
  only, that the question must be this lead's own and not the example's, and that no sentence of the example may
  appear in the draft.
- **V5** WHEN the example reply is scanned, THE SYSTEM SHALL carry the app's payment sentence and the default COI
  sentence (from the code constants) exactly once each, Alex's date sentence once, and exactly one question mark.
- **V6** WHEN the classifier prompt is built, THE SYSTEM SHALL contain the new SPECIAL CASE wording naming a default
  format and SHALL NOT contain "format_recommended = \"unresolved\"" in the SPECIAL CASE.
- **V7** WHEN any prompt of the inventory (C0-C12 of plan 2's hash file, minus the cases the block applies to) is
  built, THE SYSTEM SHALL hash to its pre-change value.
- **V8 (copy check)** WHEN the example reply is compared with the real replies recorded in the arm B result files, THE
  SYSTEM SHALL report the 30-character windows shared after cutting the app-mandated sentences (a script, reported,
  not a pass bar).

Mutation map (each must fail the named test): the block applied to every mode (V2, V7); the format check dropped
(V2 near-miss); a dollar figure left in the example (V3); the payment sentence edited (V5); the "not the example's
question" line removed (V4); the SPECIAL CASE restored (V6).

## Work steps (one concern per commit; failing test first)

1. The hash inventory extended to the cases this plan touches; V2, V7 pass on today's code.
2. V1, V3-V6 (failing), then the reference module and the block, then the classifier wording.
3. The mutation map; full suite, `tsc`, leak check.
4. Arm B run, the report, the record `docs/reviews/2026-10-13-vague-quote-measurement.md`.

## Execution Path

- **Target:** Alex's MacBook, the real pipeline through `scripts/clarification-measure.ts` (`--arm B`), real model,
  scratch databases (nothing sent; `data/leads.db` untouched).
- **Mechanism:** the committed runner and `scripts/clarification-arm-report.ts` (counts only), with fields added for
  the classifier's `format_recommended`, the stated price against the table, the question count and the footer.
- **Command (exact), from the repo root:**
  `OUT=$(mktemp -d /tmp/vague-quote.XXXXXX); echo "$OUT"; for t in 1 2 3 4 5; do npx tsx scripts/clarification-measure.ts --arm B --runs 1 --tag B$t --out "$OUT" --today 2026-10-12 & done; wait`
- **Prerequisites:** ALREADY HAVE: Node, `npm`, `tsx`, `ANTHROPIC_API_KEY` in `.env`, network (used for the earlier
  measurement runs). MUST OBTAIN: none. NONE other.
- **Who:** Claude Code or Alex. **Trigger:** after step 3. About 25 minutes; the same spend as arm B of plan 2.
- **Expected (a hypothesis until run):** the classifier returns `unresolved` for 0 to a few of 50 runs; most drafts
  are quotes at the app's price with one question; verified at or above the clarification set's 16% to 25%. What
  this does NOT show: real leads, other models, or that the example is not being copied.

## Feed-Forward

- **Hardest decision:** treating Alex's pasted reply as a reference for a ROUTE change rather than as a better
  clarification reply, and finding that the app already produces the shape when the classifier gives a format.
- **Rejected:** removing clarification mode; a code check for one question; keeping the footer; editing the verify
  prompt for a reply it already passes.
- **Least confident:** that the classifier will stop saying `unresolved` on a prompt-wording change alone.

## Three Questions

1. **Hardest decision in this session?** Reading the reply as a route change after four cycles tuned the other mode.
2. **What did you reject, and why?** A forced one-question check (it ends in no draft) and deleting the dormant mode.
3. **Least confident about going into the next phase?** The classifier following the new wording; the route is a
   model's reading of one paragraph.
