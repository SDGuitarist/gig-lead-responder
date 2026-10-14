---
title: "feat: a classifier field for what the lead actually wrote, for the drafter and the verifier"
date: 2026-10-14
status: plan, Revision 1 (plan review R1 NO-GO, 5 P1 / 2 P2, answered here; D5 decided by Alex 2026-10-14)
branch: feat/hub-phase0
---

# Lead words: give the drafter and the verifier the lead's own phrases

### Prior Phase Risk

No brainstorm: skip gate, the input is a measurement with a record
(`docs/reviews/2026-10-14-vague-gate-measurement.md`). The previous plan's "least confident" answer, quoted from
`docs/plans/2026-10-14-fix-vague-quote-gate-opening-plan.md` (Feed-Forward): "that fixing the opening moves enough drafts
to matter: 16 of the 33 also fail other checks, and the verifier's `can_see_it` and `sounds_like_alex` judgments sit next
to the opening on the same generic text." It did NOT move them (b = 6, c = 2, p = 0.145, noise 2 of 50; the opening check
moved on 1 draft in 50). The named risk (e) in that plan, "the verifier never sees the lead's own words", is the cause
this plan answers; the project rule it breaks is `project_drafter-never-sees-lead-text`: any lead detail a draft needs
must be a classifier field.

## Problem (measured, not assumed)

On the vague-quote route, 32 of 50 drafts still fail `lead_specific_opening` under the scoped rule (33 of 50 under the
strict one). The verifier's own reasons: "no anchor from this lead", "'private celebration' is the app's classification,
not a word the lead wrote". The drafts open with an invented scene or the app's label, because **neither stage sees what
the lead wrote**: `generateResponse` and `verifyGate` receive the classification only (`src/pipeline/verify.ts:73-77`,
`src/prompts/generate.ts:63`). The rule asks an opening to repeat the lead's words, and no stage holds them.

## What is true today (read 2026-10-14)

- `Classification` has `client_first_name`, `venue_name`, `format_requested` (the lead's raw format words), `organization_name`
  (the precedent: classifier-extracted, code-normalized, written into a draft by the app) and no field for the occasion,
  the time frame or the lead's own doubt.
- `classifyLead(rawText)` returns the classification and has `rawText` in scope (`src/pipeline/classify.ts`): a returned
  string can be checked against the lead text deterministically.
- `runEditPipeline` reuses a STORED classification and skips `validateClassification`: a new field must be optional and a
  missing field must behave exactly as today.
- The classifier prompt is pinned by SHA-256 (`CLASSIFY_PROMPT_SHA256` in `src/vague-quote-reference.test.ts`, V6b); a
  prompt edit moved ordinary leads once (L1 7/15 to 14/15, L7 0/15 to 4/15), so any edit needs the before/after
  regression (`scripts/classifier-regression.ts`).

## Decision

D1. **A new optional classification field `lead_words`**: `{ occasion: string | null, time_frame: string | null,
doubt: string | null }`. Each value is a short phrase COPIED from the lead (the classifier prompt says "as the lead wrote
it, not paraphrased; null when the lead did not say it"; examples: occasion "my mom's 60th birthday", time frame "next
month", doubt "not sure what kind of music"). **Two boundaries, one accessor** (answers R1 P1-1):

1. `coerceLeadWords(value): LeadWords` (no lead text needed; pure, never throws): a non-object, an array, `null` or a
   missing value becomes `{ occasion: null, time_frame: null, doubt: null }`; each member that is not a string, or is
   empty after trimming, or is longer than 80 characters becomes `null`; extra keys are dropped. It runs in
   `validateClassification` (the shape), and every consumer reads the field only through `leadWordsOf(classification)`,
   which applies `coerceLeadWords` again, so a stored malformed value and a missing value both reach a prompt as all-null
   (the stored path in `runEditPipeline` never sees raw text and never throws).
2. `groundLeadWords(words, rawText): LeadWords` runs in `classifyLead` after validation, where `rawText` is in scope: a
   phrase is kept only when its normal form is a substring of the lead's normal form. **Normal form** (one function,
   tested): Unicode NFKC, accents folded (NFD, marks removed), curly quotes and apostrophes mapped to straight, every run of
   whitespace including line breaks collapsed to one space, trimmed, lowercased. The kept value is the model's trimmed
   phrase, unchanged. A phrase the lead did not write lexically cannot survive.

**Guarantee, stated narrowly (answers R1 P1-2): the check is LEXICAL copying, not semantic truth.** One bounded negation
guard is added for `occasion` and `time_frame` only: when the word immediately before the matched span in the lead is
"not", "no", "never" or ends in "n't", the phrase becomes null ("this is not a wedding" does not yield "a wedding").
`doubt` is exempt (its phrases start with "not sure", "no idea"). Anything subtler ("we used to want a band") is an
unmeasured limitation, listed in the plan's risks.

D2. **The drafter sees them** (`src/prompts/generate.ts`): when `action === "one_question"`, `vagueness === "vague"` and at
least one `lead_words` value is non-null (read through `leadWordsOf`), a new section "WHAT THE LEAD WROTE" is inserted
**immediately after the `lead_classification` block (`src/prompts/generate.ts:63`) and before the voice examples, the T4 and
vague-quote reference blocks (line 85) and `## STEP 1`** (answers R1 P1-5). It lists the non-null phrases (wrapped with
`wrapUntrustedData`, truncated by `sanitizeClassification`) and tells the model, with an explicit precedence sentence ("this
sentence overrides the order of any reference below for the FIRST sentence"): the first sentence repeats or builds on
one of these phrases in the lead's own words; no other occasion, time frame or doubt may be stated. When every value is
null the section is withheld and today's prompt is byte-equal (G-pattern snapshots).

D3. **The verifier sees them and the opening rule uses them** (`src/prompts/verify.ts`): `lead_words` is part of the
classification JSON already sent. The two scoped 6b texts (clarification mode and vague-quote mode) gain one sentence:
"When `lead_words` holds a phrase, the first sentence passes only if it repeats or restates one of them (or a format the
lead named); the occasion label or event type the app assigned is NOT a phrase the lead wrote." When all three are null
the text is today's, unchanged, and is a **lower-confidence fallback**: it cannot identify the lead's words, so it
relies on the classification (answers R1 P2-6). That fallback is not just byte-pinned; LW9 asserts what it must still
reject. Four variants of 6b in total, each pinned.

D4. **Scope fence.** Not changed: pricing, router (every vague `one_question` lead is still held for Alex), payment and COI
sentences, the voice block, the vague-quote reference block text, `GUT_CHECK_*`, the gate rule, `assume_and_quote` and
non-solo/duo formats (D3 of the previous plan, still Alex's decision).

D5. **Decision record (Alex, chat answer 2026-10-14: "recommended")**: (a) D2 and D3 apply to clarification mode
(`unresolved`) AND the vague-quote mode (both rely on the same anchor); (b) the field is model-extracted and verified in
code against the lead text (not a code-only extractor over a fixed vocabulary).

## The classifier regression and the grounding check (pre-registered)

The classifier prompt gains the field in its output schema and one instruction paragraph. Because that edit has moved
ordinary leads before:

1. **Regression (executable; answers R1 P1-3):** `scripts/classifier-regression.ts --tag before|after --runs 5` on the 7
   recorded leads. Unit of comparison: for each of the 7 leads and each of the 8 fields the script already compares
   (`action`, `vagueness`, `competition_level`, `format_recommended`, `duration_hours`, `rate_card_tier`,
   `stealth_premium`, `quote_price`), the MODAL value over the 5 runs and the number of runs that differ from that modal
   value. **Stop rule, computed by `--compare` and enforced by its exit status (exit 1):** the modal value of any
   (lead, field) changes, OR the number of runs differing from the modal value rises by 2 or more. The comparator is a
   new `before` run on the pre-change tree at step 1 (not the old record: the model varies by day), compared with the
   `after` run. The new `lead_words` key is excluded. Any exit 1 STOPS the cycle (revert the prompt; the code-only
   extractor, D5(b), would need Alex's re-approval).
2. **Grounding:** the 10 made-up vague leads (v1-v6, h1-h4) x 5 runs: counts of non-null `occasion`, `time_frame`, `doubt`,
   and of values that failed the substring check (the model invented or paraphrased). Descriptive; a high
   fabrication-rate (more than 1 in 5 non-null values failing the substring check) means the instruction is not followed
   and the cycle returns to Alex.

## Plan Quality Gate

1. **What exactly is changing?** `src/types.ts` (one optional field), `src/prompts/classify.ts` (schema line, one
   paragraph), `src/pipeline/classify.ts` (`normalizeLeadWords`, called in `classifyLead` and `validateClassification`),
   `src/utils/sanitize.ts` (truncate), `src/prompts/generate.ts` (one gated section), `src/prompts/verify.ts` (one
   sentence in two texts), snapshots and the hash fixtures, tests, two scripts.
2. **What must not change?** Every existing classifier field's behaviour (the regression); every prompt for a lead with no
   `lead_words` (byte-equal, pinned); pricing, router, payment, COI, the voice block; `runEditPipeline` on a stored
   classification without the field.
3. **How will we know it worked?** EARS below; the regression with its exit status; the grounding counts; then the arm
   (plain counts) and the four-cell controls on the new prompts, judged by the decision table with the openings read.
   Observational: 50 runs, one model, made-up leads.
4. **Most likely way this plan is wrong?** (a) The classifier prompt edit shifts an ordinary field (the regression is
   there for that; it did once). (b) The model copies a phrase but the drafter still opens with an invented scene because
   the reference block's scene-first order wins: the new section must outrank it, and the arm shows whether it does.
   (c) A vague lead has little to quote (v4 "Need live music for a party. Not sure what's best." offers "a party" and the
   doubt): the rule may still fail for leads with a single short phrase. (d) A copied phrase carries an injection: it is
   wrapped as untrusted data, truncated to 80 characters and never placed outside a quoted list.
5. **How will a human RUN this, and when?** Claude Code (or Alex) on the MacBook, after the code and its Codex code
   review, with the commands in the Execution Path; Alex reads `docs/reviews/2026-10-14-lead-words-measurement.md`.

## Acceptance Tests (EARS)

File `src/lead-words.test.ts`; names start `Lead Words LW<n>`.

- **LW1** WHEN `normalizeLeadWords` is given a phrase that is a substring of the lead (any case, any whitespace), THE
  SYSTEM SHALL keep it; WHEN it is not a substring, is empty, longer than 80 characters or not a string, THE SYSTEM
  SHALL return null for that key; WHEN the whole value is not an object, THE SYSTEM SHALL return all three keys null.
- **LW2** WHEN `classifyLead` completes, THE SYSTEM SHALL return `lead_words` with the normalized values (a recorded
  model response with a paraphrased phrase yields null for it; a verbatim phrase survives).
- **LW3** WHEN a stored classification without `lead_words` goes through `runEditPipeline`'s prompt builders, THE
  SYSTEM SHALL build prompts byte-equal to today's (positive control: with the field they differ).
- **LW4** WHEN the lead is `one_question` + `vague` and at least one value is non-null, THE SYSTEM SHALL include the
  "WHAT THE LEAD WROTE" section, wrapped, with each non-null phrase and no null one; otherwise THE SYSTEM SHALL
  withhold it (each withheld case on its own: all null, `quote`, `clear`, `assume_and_quote`).
- **LW5** WHEN the verify prompt is built for a scoped mode with a non-null `lead_words`, THE SYSTEM SHALL contain the
  added sentence in section 6b; with all null THE SYSTEM SHALL equal today's text for that mode.
- **LW6** WHEN the classifier prompt is built, THE SYSTEM SHALL contain the `lead_words` schema line and the paragraph;
  its SHA-256 is re-pinned in a `snapshot refresh:` commit with the prompt diff.
- **LW7** WHEN any non-affected case (the 13 verify snapshots S0-S18 with no `lead_words`, the generate cases C0-C17) is
  built, THE SYSTEM SHALL equal its stored snapshot or hash outside the spans.
- **LW8** WHEN `sanitizeClassification` is applied, THE SYSTEM SHALL truncate each phrase to its cap and leave null.
- **LW9** WHEN the verify prompt is built for a scoped mode with all `lead_words` null, THE SYSTEM SHALL carry today's 6b
  text AND the planted cells A and B (generic and app-label openings, all-null) SHALL fail in the controls (the
  fallback is tested by behaviour, not only by byte equality).
- **LW10** (normalization boundary) WHEN `coerceLeadWords` receives `undefined`, `null`, a string, an array, an object with
  a numeric member, an empty or 81-character member or extra keys, THE SYSTEM SHALL return the three-key object with the
  offending members null and SHALL NOT throw; WHEN `leadWordsOf` reads a stored classification with a malformed value,
  THE SYSTEM SHALL return all-null.
- **LW11** (grounding cases) WHEN `groundLeadWords` runs, THE SYSTEM SHALL keep a phrase differing from the lead only by
  case, repeated spaces, a line break, an accent ("quinceañera" vs "quinceanera") or curly vs straight apostrophes; SHALL
  null a paraphrase and a phrase absent from the lead; SHALL null (occasion, time_frame only) "a wedding" in "this is not
  a wedding" and in "no wedding yet"; and SHALL keep a `doubt` of "not sure what kind of music".
- **LW12** (order) WHEN the generate prompt is built with a non-null phrase, THE SYSTEM SHALL place "WHAT THE LEAD WROTE"
  after the `lead_classification` block and before `## VOICE EXAMPLES`, `## REFERENCE LEAD` and `## STEP 1`, SHALL contain
  the precedence sentence, and SHALL withhold it for all-null, `quote`, `clear` and `assume_and_quote` (each on its own).
- **LW13** (regression gate) WHEN `scripts/classifier-regression.ts --compare` is given a before and an after file in
  which the modal value of one (lead, field) differs, or one lead's differing-run count rises by 2, THE SYSTEM SHALL
  exit 1; with identical files it SHALL exit 0.

Mutation map (each run): the substring check removed; the 80-character cap removed; the section applied to `quote`; the
section gate drops `vagueness`; the verify sentence applied when all null; the generate section unwrapped; the
normalizer not called in `validateClassification`; `leadWordsOf` dropped from a consumer; the negation guard
removed; accent folding removed; the `--compare` exit status ignored.

## Decision table for the measurement (pre-registered; descriptive)

Arm: 5 processes x 10 leads (v1-v6, h1-h4), the real pipeline on the NEW prompts, **plain counts, no `--paired`** (answers
R1 P1-4: the previous arm's drafts do not hold the new section, so a paired comparison with them is not valid; the
arm records the pipeline's own gate verdict, the opening of each final draft and the classification with `lead_words`).
Controls, a four-cell matrix, each text verified twice under the REAL classification shape:

| Cell | `lead_words` | Opening | Must | Texts |
|---|---|---|---|---|
| A | all null | generic ("What a wonderful way to celebrate!") | fail | 2 |
| B | all null | app label ("A private celebration with live music ...") | fail | 2 |
| C | a valid phrase | quotes it | pass | 3 |
| D | a valid phrase | generic or app label | fail | 3 |

| Observation | Meaning | Action |
|---|---|---|
| the regression `--compare` exits 1 | the classifier edit has side effects | STOP; revert; D5(b) needs Alex's re-approval |
| more than 1 in 5 non-null phrases fail `groundLeadWords` (counted before the check) | the instruction is not followed | STOP; return to Alex |
| ANY text in cells A, B or D passes `lead_specific_opening` in EITHER verify | a false pass (the harm direction) | STOP; return to Alex |
| 2 or more cell C texts fail it in AT LEAST ONE verify | the rule is too tight with a phrase available | STOP; return to Alex |
| controls ok AND opening-false is 20 or more of 50 | the drafter does not use the phrases | STOP; the generate section is the next plan |
| controls ok AND opening-false below 20 of 50 | descriptive: record verified, opening-false, the openings read | record; compare with 9-11 of 50 verified and 32 of 50 opening-false |

The 1 in 5 and 20 of 50 are reading guides fixed before the run, not derived tests (20 of 50 is about two thirds of the
previous 32; 1 in 5 is one failure per five phrases). Cell sizes are small by construction (10 texts); the stop rules are
asymmetric by cost: a false pass is the harm, a false fail only loses gain.

**Sending boundary:** passing this measurement does not make any draft sendable. The router still holds every vague
`one_question` lead for Alex, and the post-check, COI and payment checks and his own read remain.

## Verification Commands

| What | Command (repo root) | Expected |
|---|---|---|
| Normalizer, field, gating, texts | `npm run test:match -- "Lead Words"` | all pass, exit 0 |
| Classifier prompt hash | `npm run test:match -- "Vague Reference V6b"` | updated pin passes after the refresh commit |
| Verify snapshots, plan 1 and 2 suites | `npm run test:match -- "Clarification Gate"` ; `"Vague Gate"` | pass, exit 0 |
| Generate hashes | `npm run test:match -- "Clarification Shape"` ; `"Vague Reference V7"` | pass, exit 0 |
| Mutation map | each row applied by hand, then `npm run test:match -- "Lead Words"` | each fails a test |
| Full suite, types, leak | `npm test` ; `npx tsc --noEmit` ; `npx tsx scripts/check-venue-history.ts; echo $?` | all pass; exit 0 (a reviewer sandbox may block sockets: UNEXECUTED, not a pass) |
| Regression | `npx tsx scripts/classifier-regression.ts --tag before` (on the pre-change tree) then `--tag after`, then `--compare` | printed per-lead distributions |
| Grounding | `npx tsx scripts/lead-words-grounding.ts --runs 5` | counts per field and per lead |
| The arm and controls | the Execution Path | five result files, controls exit 0 |

## Work steps (one concern per commit; failing test first)

0. **HARD STOP:** a Codex plan review (D5 is decided). No production code before.
1. `before` regression and snapshots of the unaffected cases from the CURRENT code.
2. LW1, LW8 failing; `normalizeLeadWords`, the field, `sanitize`; pass.
3. LW2, LW6; the classifier prompt edit; `snapshot refresh:` of the pinned hash; the `after` regression and the record.
4. LW4, LW5, LW3, LW7; the generate section and the two verify sentences; snapshot refreshes with prompt diffs.
5. Mutation map; full suite, `tsc`, leak check.
6. Codex code review (one run per round).
7. The grounding and arm measurement and the record with the table filled in.

## Execution Path

- **Target:** Alex's MacBook, `scripts/classifier-regression.ts`, a new `scripts/lead-words-grounding.ts`,
  `scripts/clarification-measure.ts --arm B --probe C8`, `scripts/vague-gate-controls.ts` (extended to the four-cell matrix
  with a `lead_words` variant per cell), real model, scratch databases, nothing sent.
- **Mechanism:** the committed scripts call the real pipeline functions with the real model; the regression and the grounding
  script call `classifyLead` only; the arm runs `runPipeline` for the 10 made-up leads and records the classification
  (with `lead_words`), the draft and the verdicts; the controls verify planted openings.
- **Command (exact), from the repo root:**
  `OUT=$(mktemp -d /tmp/lead-words.XXXXXX); npx tsx scripts/classifier-regression.ts --tag after --runs 5 --out "$OUT"; npx tsx scripts/classifier-regression.ts --compare <before.json> "$OUT"/<after.json>; echo compare-exit=$?; npx tsx scripts/lead-words-grounding.ts --runs 5 --out "$OUT"; pids=""; for t in 1 2 3 4 5; do npx tsx scripts/clarification-measure.ts --arm B --probe C8 --runs 1 --tag B$t --out "$OUT" --today 2026-10-12 > "$OUT/log-B$t.txt" 2>&1 & pids="$pids $!"; done; for p in $pids; do wait $p || echo "JOB $p FAILED"; done; grep -c "usage limits" "$OUT"/log-B*.txt; ls "$OUT"/clarification-B*.json | wc -l; npx tsx scripts/vague-gate-controls.ts --out "$OUT"; echo controls-exit=$?`
  (the `before` regression runs once on the pre-change tree at step 1). **Before recording any result:** a
  `JOB ... FAILED` line, a non-zero `usage limits` count, a result-file count other than 5, `compare-exit` other than 0 or
  `controls-exit` other than 0 voids the run (it is rerun or stopped by the table, not interpreted).
- **Prerequisites:** ALREADY HAVE: Node, `npm`, `tsx`, `ANTHROPIC_API_KEY` in `.env`, network, a raised API spend limit.
  MUST OBTAIN: none.
- **Output:** result files and a regression comparison, recorded in `docs/reviews/2026-10-14-lead-words-measurement.md`.
- **Who:** Claude Code or Alex. **Trigger:** after step 6, on Alex's "go". **Spend:** two regressions of 35
  classifications each, 50 grounding classifications, the arm (50 pipelines: 1 classification and up to 3 generate and 3
  verify calls each, so at most about 350 calls) and the controls (14 texts x 2 verifies = 28 calls); no `--paired`
  replays.
- **Expected (a hypothesis until run):** the opening check stops being the main failure; `sounds_like_alex` (12) and
  `can_see_it` (9) remain. What this does NOT show: that quoted vague drafts are good enough to send.

## Feed-Forward

- **Hardest decision:** model-extracted phrases with a code substring check versus a code-only extractor; the first
  covers phrasings the second cannot but edits a prompt that has moved ordinary leads once.
- **Rejected:** showing the raw lead text to the drafter and the verifier (a new untrusted-text surface in every mode,
  against the project rule); dropping the "the lead wrote it" anchor (loosens the rule without giving the stages the
  words); widening to `assume_and_quote` or other formats.
- **Least confident:** that the drafter will open on a quoted phrase when the reference block's scene-first order and
  Alex's own reply both start with a scene; the new section must outrank them and only the arm shows whether it does.

## Three Questions

1. **Hardest decision in this session?** Whether to extract with the model and verify in code, or extract in code only.
2. **What did you reject, and why?** Giving both stages the raw lead text, and loosening the verifier rule.
3. **Least confident about going into the next phase?** The drafter's use of the phrases against the reference block's
   scene-first order.
