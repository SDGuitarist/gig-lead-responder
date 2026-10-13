---
title: "COI: the app writes the sentence; 'available upon request' first, a timeline only when the client requires one"
date: 2026-10-12
status: plan, Revision 2 (Codex plan review round 1 NO-GO, 6 P1 / 3 P2, answered below; before round 2)
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

> **Revision 2 (below, "Revision 2: Codex plan review round 1") supersedes D1, D3, D4 and the Execution Path where it
> says so.** D2, D5, D6, D7 stand.

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

## Revision 2: Codex plan review round 1 (NO-GO; record `docs/reviews/2026-10-12-coi-plan-codex-round1.md`)

Each finding was checked against the repo before this revision (results in the record). One P1 rests on a premise that
is not true in this repo (P1-5); it is answered with the facts, and the part of it that IS real is kept.

### R2-1 The COI terms object and the mode matrix (answers P1-1; supersedes D1 and D3)

Mirror `PaymentTerms` exactly: `src/pipeline/coi.ts` exports

- `type CoiTerms = { kind: "none" } | { kind: "sentence"; sentence: string }`
- `COI_SENTENCES = { default: "COI available upon request.", required: "I carry liability insurance ($1M/$2M) and can provide COI within a few days of booking." }`
- `coiTermsFor(classification, pricing): CoiTerms`: `none` when `quoteTermsOff(...)` OR
  `classification.graceful_decline === true`; otherwise `sentence`, `required` iff `classification.coi_required === true`.
- `coiLine(terms)` (the Quote Terms line, `""` for none), `coiViolations(text, label, terms)` (R2-2).

The same object is computed once per run and passed to BOTH `generateResponse` and `postCheckDrafts`, in
`runPipeline` (`src/run-pipeline.ts`, beside `paymentTerms`, ~line 262-270) and `runEditPipeline` (~line 339-347).
No send-time swap (nothing in it depends on a date).

| Response mode | `coiTermsFor` | Why |
|---|---|---|
| clarification, `no_viable_scope`, residency (`quoteTermsOff`) | none | no quote, no Quote Terms block |
| graceful decline | none | the mode forbids a pitch after the exit line (`src/prompts/generate.ts` graceful-decline block) |
| past date | sentence | still a quoted reply; the payment line also stays (no-date sentence) |
| large budget gap (two prices) | sentence | still a quote; Quote Terms present |
| small budget gap / met budget / normal quote | sentence | normal |
| platform lead (GigSalad, The Bash) | sentence | the COI sentence is not a payment term; a platform reply may state it. **Open for the reviewer: say if a platform reply should omit it.** |

Known and left alone: today the Quote Terms block (so the payment line) is also emitted in graceful decline, which
the graceful-decline block's "no pitch" contradicts. That is the payment cycle's behaviour, not this plan's; it is
recorded, not changed here. The COI line is the only new line, and it has the stricter gate above.

### R2-2 The post-check contract (answers P1-2 and P2-1; supersedes D4)

`coiViolations(text, label, terms)`, for `label` in `full`, `compressed`, each run on its own draft:

1. `kind: "none"` returns `[]` (no COI flags when COI is disabled).
2. Whitespace-collapse the draft (`\s+` to one space, as `paymentViolations` does), then split on the exact chosen
   sentence. Zero occurrences: `coi_sentence_missing_<label>: must contain exactly once: "<sentence>"`. Two or more:
   `coi_sentence_repeated_<label>: ...`. (One flag per draft; a pass in one draft and a fail in the other gives one flag.)
3. Join the remainder with a space and scan it for COI wording: `/\bCOI\b/i`, `/certificate of insurance/i`,
   `/proof of insurance/i`, `/liability insurance/i`, `/\binsured\b/i`. Any hit:
   `coi_other_wording_<label>: other COI or insurance wording besides "<sentence>"`.
   The chosen sentence is REMOVED before this scan, so the valid required sentence ("COI", "liability insurance")
   never flags itself. Checked 2026-10-12 (probe): the required sentence with its `$1M/$2M` raises no existing
   post-check price flag when the quoted price is used.
4. A draft that restates the venue's own COI policy ("the venue requires a COI") also trips `coi_other_wording`.
   Intended: the app's sentence is the only COI wording, and Alex decides when a flag fires.
5. Flags, not rewrites. Wired in both pipelines (R2-1), each with its own test.

### R2-3 `coi_required` compatibility (answers P1-3; supersedes the type line in D2)

`coi_required?: boolean` (OPTIONAL, like `price_asked`). The classify validator sets `obj.coi_required === true`
(only a real `true` counts; absent, `"yes"`, `1`, `null` all become false). `coiTermsFor` reads `=== true`, so a
stored classification without the field is false. `sanitizeClassification` spreads `...c`, so the field survives
(asserted by a test, not assumed). Existing fixtures and mocks need no change (optional field); tests below cover
absent, and a stored-classification edit run.

### R2-4 The boundary lead is observation-only (answers P1-4)

Definition in the classify prompt (D2, tightened): `coi_required` is true only when the lead text says the client or
the venue requires or needs a certificate of insurance or proof of insurance, or asks for one. A question about
whether Alex carries insurance is NOT enough: false. Real-run lead 4 ("Do you carry liability insurance?") expects
**false** and is recorded, never asserted and never used to widen the rule. Anything the runs show that disagrees
with Alex's trigger returns to Alex.

### R2-5 What the baseline fixtures actually pin (answers P1-5; part of it was a wrong premise)

- **Not true here:** the five docs do NOT sit in the three baseline fixtures. The fixture inputs carry a 28-character
  stub context (`src/fixtures/prompt-baseline-inputs.json`; no "COI" in it or in any baseline file), and the real docs
  are read at run time by `selectContext`. Editing the five doc lines therefore changes no baseline.
- **True and kept:** the new Quote Terms COI line DOES change a baseline-equality assertion, in two tests:
  `src/payment-terms-prompt.test.ts:18-23` (P8) and `src/t4-reference.test.ts:227-232`. Procedure: both compute the
  expected prompt from the same functions (`before.replace(OLD_LINE, paymentLine(t))` then the COI line where
  `coiTermsFor` is not none) and assert the ONLY differences from the `38acd73` baseline files are the payment line and
  the COI line (a line diff, count 2 for a quoted fixture). The fixture files are provenance and are not regenerated.
- **Doc-text tests checked:** `src/always-loaded-no-prices.test.ts` allows the `$1M`/`$2M` tokens and does not assert
  they are present, so removing the RESPONSE_CRAFT line does not break it. The port-manifest doc tests are run after
  the D5 edits as part of the full suite. `src/example-lines-pass-post-check.test.ts` passes no `coiTerms`, and an
  absent `coiTerms` runs no COI check (as with `paymentTerms`).

### R2-6 Execution Path prerequisites and privacy (answers P1-6; extends the Execution Path)

- Prerequisites, each CHECKED 2026-10-12: Node, `npm`, `tsx` (the T4 runs used them); `ANTHROPIC_API_KEY` set;
  `PF_INTEL_API_URL` and `PF_INTEL_SERVER_API_KEY` set in `.env` (lengths checked, values never printed). If PF-Intel is
  unreachable on the day, lead 5 is recorded as NOT RUN, not substituted.
- Finding the lead-5 venue: Claude Code calls `lookupVenueContext(<name>)` (`src/venue-lookup.ts`) for the venues in
  `src/data/venues.ts` until one returns a policy with `coi_required: true`.
- **Privacy:** the committed runs record names the venue only as "venue A" plus the boolean. It never copies
  `coi_details`, a venue claim, or a private sentence (the leak check sees only 30-character windows).

### R2-7 Tests (answers P2-1, P2-2, P2-3)

Added to the EARS list below (C8-C12). Verification commands for every step: `npm run test:match -- "<name>"`,
`npx tsc --noEmit`, `npm test`, `npx tsx scripts/check-venue-history.ts` (exit 0). Real-model classification runs stay
OBSERVATIONAL; the deterministic tests are the acceptance tests for the classify prompt text and the validator.

### R2-8 Manifest and status (answers P2-3)

No port-manifest row and no `docs/END-TO-END-STATUS.md` row changes. The manifest has no COI requirement row
(`R339` is a generic non-negotiables row; `END-TO-END-STATUS.md` line 42 is about COI dates on the calendar, a
different thing). The earlier "one manifest/status note" in the Plan Quality Gate is withdrawn.

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
- **C8** (mode matrix) WHEN the mode is clarification, `no_viable_scope`, residency or graceful decline, THE SYSTEM
  SHALL return `{kind:"none"}`, put no COI line in the prompt and raise no COI flag; WHEN it is a normal quote, a
  past date, a small or large budget gap, or a platform lead, THE SYSTEM SHALL return a sentence (one test per mode).
- **C9** (post-check contract) THE SYSTEM SHALL return exactly these strings: `coi_sentence_missing_full`,
  `coi_sentence_missing_compressed`, `coi_sentence_repeated_full`, `coi_sentence_repeated_compressed`,
  `coi_other_wording_full`, `coi_other_wording_compressed` (prefix match on the flag, one independent test each, plus a
  case where one draft passes and the other fails), and NO flag for a draft holding the valid required sentence once.
- **C10** (both pipelines) WHEN `runPipeline` and `runEditPipeline` each produce a draft with a missing COI sentence,
  THE SYSTEM SHALL add the same flag in both (one test each, with a stubbed generator).
- **C11** (compatibility) WHEN a classification has no `coi_required`, or a non-boolean one, THE SYSTEM SHALL treat it
  as false in the validator, in `coiTermsFor` and after `sanitizeClassification`.
- **C12** (classify text) THE SYSTEM SHALL carry, in the classify prompt, the definition that a requirement or a
  request for proof of insurance is true and a question whether Alex carries insurance is not, pinned as literal lines
  (deterministic; the model runs are observation).

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
  4. "Do you carry liability insurance?": expected **false** under Alex's trigger (the boundary case; recorded, never
     asserted; see R2-4).
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
