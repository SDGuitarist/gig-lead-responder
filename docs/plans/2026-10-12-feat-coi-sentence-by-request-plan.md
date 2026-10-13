---
title: "COI: the app writes the sentence; 'available upon request' first, a timeline only when the client requires one"
date: 2026-10-12
status: plan, Revision 1 (Alex answered both questions 2026-10-12; before plan review round 1)
branch: feat/hub-phase0
---

# COI sentence owned by the app

### Prior Phase Risk

> "Whether any instruction wording can stop a model copying an example when the lead sits in the example's own
> setting." (HANDOFF "START HERE — T4 reference-lead cycle", Three Questions, least confident)

Not this plan's risk, but its origin: the T4 smoke test (4 sets, `docs/reviews/2026-10-12-t4-reference-local-runs.md`)
showed the model improvising a COI timeline that drifts ("within a few days", "within a day", "within 24 hours").
Wording in a prompt did not hold it still. The payment-terms cycle (2026-10-11) solved the same class by having the
app own the sentence and a check confirm the exact text; this plan reuses that pattern. No brainstorm (skip gate: the
input is Alex's stated rule and measured drift).

## Alex's rule (2026-10-12, in chat)

> "When I first reply to a gig lead, we always state that COI is available upon request. And then if they respond
> and only if they respond that they require a COI on a subsequent reply, then yes, it's okay to say something
> similar to within a few days."

Two sentences, so:

| Case | Sentence (exact) | Source |
|---|---|---|
| **default** (first reply; client has not said they require a COI) | `COI available upon request.` | Alex's own words, 2026-10-12 |
| **client requires a COI** (a later reply, or text that states the requirement) | `I carry liability insurance ($1M/$2M) and can provide COI within a few days of booking.` | `docs/RESPONSE_CRAFT.md:101`, Alex's existing line; he said "similar to within a few days" |

## What is true today (read 2026-10-12)

- No code writes a COI sentence. The model improvises it from injected docs: `docs/RESPONSE_CRAFT.md:101` (the
  "within a few days" line), `docs/LEAD_RESPONSE_VOICE.md:57` ("front-load ... COI"), `docs/QUICK_REFERENCE.md:164`,
  `docs/PRINCIPLES.md:148`, `docs/DRAFT_METHOD.md:240`. It also appears in the T4 block (`src/data/t4-reference.ts`:
  step 6 "the COI in one short paragraph"; the approved example reply says "I can send the Del a COI.").
- PF-Intel already carries a per-venue `coi_required` flag (`src/pipeline/format-venue-context.ts:37`): a venue that
  requires a COI is a different fact from a client who asks for one.
- **The pipeline has no first-reply / later-reply signal.** `runPipeline(rawText, onStage, platform, gigsaladPage,
  today)` sees one text. The only signal for "they require a COI" is the text itself.

## Alex's answers (2026-10-12, in chat; Revision 1)

1. **How the app knows "requires a COI": the text route (the plan's default).** The classifier reads the incoming
   text and sets `coi_required`. A first message that already says the client requires a COI gets the timeline
   sentence, not "available upon request". No reply-stage input is built (no CLI flag, no dashboard control).
2. **The exact words, approved ("Yes, all three"):** default `COI available upon request.`; required
   `I carry liability insurance ($1M/$2M) and can provide COI within a few days of booking.` (his line,
   `docs/RESPONSE_CRAFT.md:101`); and the approved T4 example's "I can send the Del a COI." becomes
   `COI available upon request.` (D6).

## Decision

- **D1 Where the sentence is chosen:** `src/pipeline/coi.ts` exports `COI_SENTENCES = { default, required }` and
  `coiSentence(classification)`: `required` when `classification.coi_required === true`, otherwise `default`. Pure,
  no date, no clock (unlike payment, nothing about it changes between draft and send, so there is NO send-time swap).
- **D2 Classifier:** new field `coi_required: boolean` in `Classification` (`src/types.ts`) and in the classify
  prompt and validator, beside `price_asked`. Definition in the prompt: true only when the lead text itself says the
  client or the venue needs a certificate of insurance or proof of insurance; a venue's name alone is not a signal.
- **D3 Generate prompt:** the Quote Terms block (`src/prompts/generate.ts`, beside `paymentLine`) gains one line, the
  exact sentence from `coiSentence`, and the existing "COI in one short paragraph" / voice-doc wording is overridden
  by one rule: "COI: use the sentence in Quote Terms exactly, once. Write no other COI or insurance sentence."
  The off-switch is the same `quoteTermsOff` the payment line uses (clarification, no_viable_scope, residency: no
  quote, no COI line).
- **D4 Post-check:** `post-check.ts` confirms the chosen COI sentence appears exactly once in the full draft and once
  in the compressed draft (same as the payment check; flags `coi_sentence_missing` / `coi_sentence_repeated`), and
  flags `coi_other_wording` when the draft contains `COI` or `certificate of insurance` or `liability insurance`
  outside the exact sentence. **A flag, not a rewrite**: this app does not silently edit Alex's drafts.
- **D5 Docs the model reads:** the five doc lines above are reconciled to say the app owns the sentence (one edit
  each, anchored on the line), so the injected context stops teaching "front-load COI" and a different timeline.
- **D6 T4 block and example:** step 6 loses "and the COI" (it reads "then the genre default and the setup needs");
  the example reply's "I can send the Del a COI." becomes `COI available upon request.` **only with Alex's yes**: the
  example is his approved text. A T4 test asserts the example contains the default sentence exactly once.
- **D7 Rejected:** a detector that rewrites any COI promise it finds (a prose detector: the repo's own rule, see the
  NP2 price block, is substitute a fixed line and check it exactly); asking the model to "keep it short"; making
  `coi_required` come from PF-Intel's venue flag (that is the venue, not the client's reply).

## Known risk added in Revision 1 (for the plan reviewer)

- **PF-Intel's venue facts reach the generate prompt with a COI line** (`src/pipeline/format-venue-context.ts:36-38`:
  "COI required: Yes" and `coi_details`). That is a venue policy, not the client's reply, and D7 keeps it from
  choosing the sentence. But the model sees it next to the rule "write no other COI or insurance sentence"; D4's
  `coi_other_wording` flag is what catches a draft that follows the venue line instead. Real-run lead 5 (T4, venue
  with a COI policy) is meant to show which wins; if the model follows the venue line, the plan returns to Alex.

## Plan Quality Gate

1. **What exactly is changing?** `src/pipeline/coi.ts` (new), `Classification.coi_required`, the classify prompt and
   validator, one Quote Terms line and one rule in `generate.ts`, `post-check.ts` (3 flags), five doc lines, the T4
   block's step 6 and (with Alex's yes) the example sentence, tests, one manifest/status note.
2. **What must not change?** Payment sentences and their send-time refresh; prices; the verify prompt's gate checks
   (the 14 gut checks, kill lists); every non-COI line of the Quote Terms block; PF-Intel's `coi_required` display;
   `post-check`'s existing flags. No venue sentence or private claim enters the repo.
3. **How will we know it worked?** EARS below; plus 6 real-model runs (Execution Path) with recorded results before
   the Codex code review.
4. **Most likely way this plan is wrong?** The classifier reads "we'll need a COI for the venue" as `required` too
   eagerly or misses "do you carry insurance?" (a prose judgement, and the repo's `price_asked` has misfired before).
   Second: the model still writes a second COI sentence in the compressed draft; D4 flags it, it does not fix it.
5. **How will a human RUN this, and when?** Claude Code, on Alex's MacBook, the same scratch runner pattern as the T4
   runs (real model, scratch `DATABASE_PATH`, today pinned), after the code steps and before the code review. Alex
   reads the six drafts in `docs/reviews/<date>-coi-local-runs.md`. Prerequisites: model access (ALREADY HAVE).

## Acceptance Tests (EARS)

- **C1** WHEN `coi_required` is false or absent, THE SYSTEM SHALL put exactly `COI available upon request.` in the
  Quote Terms block of the generate prompt, and not the required sentence.
- **C2** WHEN `coi_required` is true, THE SYSTEM SHALL put exactly the required sentence there, and not the default.
- **C3** WHEN `quoteTermsOff` is true, THE SYSTEM SHALL put no COI line in the prompt.
- **C4** WHEN a draft contains the chosen sentence once in each draft and no other COI wording, THE SYSTEM SHALL add
  no COI flag; WHEN a draft lacks it, repeats it, or adds other COI or insurance wording, THE SYSTEM SHALL add
  `coi_sentence_missing`, `coi_sentence_repeated` or `coi_other_wording` respectively (one named test each).
- **C5** THE SYSTEM SHALL leave every payment-terms test, the three prompt-baseline fixtures' non-COI lines, and the
  verify prompt unchanged (the P8 baseline test is updated for exactly the COI line, as it was for payment).
- **C6** WHEN the classify prompt receives a lead that says "we will need a certificate of insurance", THE SYSTEM
  SHALL return `coi_required` true; a lead that never mentions insurance SHALL return false (real-model runs: 3 each).
- **C7** THE SYSTEM SHALL carry the default sentence exactly once in `T4_REFERENCE_REPLY` (D6, with Alex's yes).

Each test gets a named mutation (default and required swapped; line dropped; off-switch removed; each flag's
condition inverted), run with `npm run test:match -- "<name>"`, expected exit 1.

## Work steps (one concern per commit; failing test first)

1. `src/pipeline/coi.ts` + tests (C1, C2).
2. `coi_required` in the type, classify prompt and validator + a classify-prompt test (C6 wiring).
3. Quote Terms line, the override rule, the `quoteTermsOff` gate (C3, C5).
4. Post-check flags (C4).
5. Docs reconciliation (D5) and the T4 block/example (D6, C7).
6. Real-model runs (Execution Path), recorded.

## Execution Path

- **Target:** Alex's MacBook, CLI path `runPipeline` through a scratch script, real model, scratch `DATABASE_PATH`
  (nothing sent; `data/leads.db` untouched; the clipboard is not touched).
- **Mechanism:** a scratch runner (outside the repo, the pattern of
  `docs/reviews/2026-10-12-t4-reference-local-runs.md`) calls
  `runPipeline(text, undefined, undefined, undefined, "2026-10-12")` once per lead and records the classification
  (`coi_required`), the chosen sentence, both drafts and the post-check flags.
- **Prerequisites:** model access (ALREADY HAVE: `ANTHROPIC_API_KEY` in `.env`); the private venue file (ALREADY
  HAVE); `jq` (ALREADY HAVE). Alex's yes on the two sentences (Questions for Alex 2) BEFORE step 3.
- **Who:** Claude Code. **Trigger:** after step 5, before the Codex code review.
- **Leads (copy as is; expectations are hypotheses until run):**
  1. first inquiry, no COI mention (a backyard birthday, 35 guests): `coi_required` false; default sentence.
  2. corporate dinner that says "we will need a certificate of insurance naming the venue": `coi_required` true;
     required sentence, once.
  3. a later reply: "Thanks! One thing, the venue needs proof of insurance before the date.": true; required.
  4. "Do you carry liability insurance?": true (the boundary case; record what the classifier says).
  5. a T4 corporate lead with no COI mention, at a venue whose PF-Intel policy says "COI required: Yes" (Claude Code
     finds one with `lookupVenueContext` first and records which): default sentence; T4 reference block still applies;
     the draft must follow the app's sentence, not the venue line (the Revision 1 risk).
  6. a no-quote clarification lead: no COI line at all.
- **Checks per draft:** the exact sentence once in each draft; no other `COI`/`insurance` wording; the payment
  sentence unchanged.

## Questions for Alex

None open: both answered 2026-10-12 (above). Anything that changes the two sentences or the trigger returns to Alex.

## Feed-Forward

- **Hardest decision:** whether "required" is read from the client's text (a model judgement) or supplied by the
  operator (a flag). The text route is built; the flag route is the fallback if the classifier is unreliable.
- **Rejected alternatives:** a prose detector that rewrites COI promises; PF-Intel's venue flag as the trigger;
  keeping the sentence in the voice docs only.
- **Least confident:** the `coi_required` classification on indirect phrasings ("do you carry insurance?", "the
  venue is strict about vendors"). The six runs sample it; they do not settle it.

## Three Questions

1. **Hardest decision in this session?** Reading "subsequent reply" into a pipeline that has no reply stage.
2. **What did you reject, and why?** A COI rewriter (prose detector) and PF-Intel's venue flag as the trigger.
3. **Least confident about going into the next phase?** The classifier's boundary cases (above).
