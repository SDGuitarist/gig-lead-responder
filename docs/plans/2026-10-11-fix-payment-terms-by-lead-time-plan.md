---
title: "Payment terms by lead time: the right deposit or full-payment sentence in every quote"
date: 2026-10-11
status: plan, Revision 3 (after Codex plan review round 3 = NO-GO on both runs; HARD CAP, no round 4; all findings fixed). Round 3 authorized by Alejandro: YES (2026-10-11). Ready for work
branch: feat/hub-phase0
---

# Payment terms by lead time

### Prior Phase Risk

> "Copying: a T4 draft that reuses the example's sentences, or claims a venue space from it, at a venue Alex has not
> played." (`docs/plans/2026-10-11-feat-t4-reference-lead-plan.md`, Three Questions 3)

That plan is paused behind this one (Alex: "payment terms first"). Its example says "A 50% deposit holds the date."
for an event 6 days out, which this plan makes wrong; the T4 plan's revision changes that sentence to match before it
ships. No brainstorm (skip gate: Alex gave the rule and the exact words in chat).

## Revision 3 (after Codex PLAN round 3 = NO-GO on both runs; HARD CAP, no round 4)

Record: `docs/reviews/2026-10-11-payment-terms-plan-codex-round3.md`. Changes: `unknown_platform` gets a line that
claims nothing (D3) and "payment" joins the word list (D4); the execution sample also requires a quote `action`; P10's
mutation crosses a band; the CLI validates `--platform` before the API-key check (P14). Next independent check: the
Codex CODE review after the build.

## Revision 2 (after Codex PLAN round 2 = NO-GO on both runs; the 2nd NO-GO)

Record: `docs/reviews/2026-10-11-payment-terms-plan-codex-round2.md`. Changes: P10 asserts the final gate, not only the
prompts; `runEditPipeline` re-applies the past-date check (P12); the execution script proves each lead was a quote
(kind ≠ `none`); fixtures are generated from a clean worktree of `38acd73` and verified by regenerating them. Also
(Alex, outside the runs): `unknown_platform` for hand-run leads the model marks "P" (D2, D3, D4, P6, P13) and a
CLI `--platform` option (P14).

## Revision 1 (after Codex PLAN round 1 = NO-GO on both runs)

Record: `docs/reviews/2026-10-11-payment-terms-plan-codex-round1.md`. Changes: one `PaymentTerms` value per run
(D2); one predicate for "payment line active" shared by prompt and check (D2, D3); civil-date arithmetic and strict
dates (D1); a bounded payment-word vocabulary with controls (D4); precedence exclusions → platform → dated (D2); a
baseline with git provenance (P8); runnable execution fixtures. Also (Alex, outside the runs): the no-payment rule
keys on `platform` ∈ {gigsalad, thebash}, not `lead_source_column` "P".

## Problem

`src/prompts/generate.ts:270` tells every quote "A 50% deposit holds the date." Alex's terms
(`~/.claude/docs/contract-and-payment-process.md`, corrected 2026-10-11) depend on lead time: more than 2 months out,
balance due 2 months before; more than 2 weeks up to 2 months, balance due 2 weeks before; 2 weeks or less, full
amount upfront. So every lead 2 weeks or less out is quoted the wrong terms today, no reply states a due date, and
GigSalad / The Bash clients (who pay the platform) are told about a deposit they never pay Alex.

## Alex's decisions (2026-10-11, in chat; exact words)

| Case | Sentence (exact) |
|---|---|
| more than 2 months to the event | `A 50% deposit holds the date, and the balance is due two months before the event.` |
| more than 2 weeks, up to and including 2 months | `A 50% deposit holds the date, and the balance is due two weeks before the event.` |
| 2 weeks or less (14 days or fewer) | `Full payment holds the date.` |
| no event date | `A 50% deposit holds the date.` |
| GigSalad or The Bash lead | no payment sentence (the client pays the platform upfront; the platform pays Alex in installments) |

Edges fall in the shorter band: exactly 2 months out → the 2-weeks sentence; exactly 14 days → full payment. Yelp,
Thumbtack, The Knot, WeddingWire, website, referral and every other source: the dated sentences (Alex: those clients
pay him directly). Order: this plan first, then the T4 plan.

## Decision

- **D1 Dates (new `src/pipeline/payment-terms.ts`).**
  - `civilDay(iso: string): number | null`: accepts only `/^\d{4}-\d{2}-\d{2}$/` that round-trips through
    `Date.UTC(y, m-1, d)` (so `2027-02-30`, `2026-02-31` → `null`); returns `Date.UTC(...) / 86_400_000` (an integer day
    number; UTC has no DST, so 2026-03-08 → 2026-03-23 is exactly 15).
  - `addMonthsClamped(iso, 2)`: same day-of-month two months later, clamped to that month's last day
    (2026-12-31 → 2027-02-28; 2027-12-31 → 2028-02-29).
  - `paymentSentence(eventIso: string | null, todayIso: string): string`: event invalid/null → no-date sentence;
    `days = civilDay(event) - civilDay(today)`; `days < 0` → no-date sentence (a past date: `past_date_detected` already
    makes the draft ask to confirm the year); `days <= 14` → full payment; `civilDay(event) <=
    civilDay(addMonthsClamped(today, 2))` → two weeks; else two months.
- **D2 One value per run, computed once.**
  `type PaymentTerms = { kind: "none" } | { kind: "platform" } | { kind: "unknown_platform" } | { kind: "sentence";
  sentence: string }`.
  `paymentTermsFor(classification, pricing, todayIso): PaymentTerms`. Precedence:
  1. `quoteTermsOff(classification, pricing)` → `none` (clarification mode, `no_viable_scope`, or residency: the same
     three conditions as today's Quote Terms block, moved into one exported predicate that the Quote Terms block also
     uses, so the prompt and the check cannot drift);
  2. `classification.platform === "gigsalad" || classification.platform === "thebash"` → `platform` (`platform` is set
     by the intake caller, `src/run-pipeline.ts:109`, never by the model);
  3. `classification.platform` undefined AND `classification.lead_source_column === "P"` → `unknown_platform` (a
     hand-run lead, CLI or dashboard box, that looks like a platform lead: the app cannot tell GigSalad, whose client
     pays the platform, from Thumbtack, whose client pays Alex; Alex 2026-10-11: no terms, and flag it);
  4. else `sentence` with `paymentSentence(classification.event_date_iso, todayIso)`.
  **Flow:** `runPipeline` gains a last optional `today = getTodayISO()` (replacing its line-103 call; one value for the
  run), computes `paymentTerms` once after enrichment and pricing, and passes it to `runWithVerification` (new required
  parameter), which passes it to EVERY `generateResponse` call (first and retries), and to `postCheckDrafts`.
  `runEditPipeline` gains a last optional `today = getTodayISO()`, computes `paymentTerms` once from the stored
  classification and the CURRENT date, and passes it to `generateResponse` and `postCheckDrafts`. It also re-applies
  the deterministic past-date check with that `today` (the same comparison `enrichClassification` uses, extracted as
  `isPastDate(eventIso, todayIso)` and called by both), so an edit after the event both gets the no-date sentence AND
  the `FLAGGED: EVENT DATE APPEARS TO BE IN THE PAST` block (Codex R2 run B).
  `generateResponse` and `buildGeneratePrompt` gain a REQUIRED `paymentTerms` parameter (no default: a caller that
  forgets fails `tsc`, it cannot silently compute its own). Existing tests that call them pass a fixed value
  (`{ kind: "sentence", sentence: <no-date sentence> }` reproduces today's deposit wording most closely).
- **D3 Prompt (inside the Quote Terms block, which is absent when `kind` is `none`).** Line 270 becomes:
  - `sentence`: `- Payment: write this sentence exactly, once, in both drafts, after the price: "<sentence>". Write no
    other sentence about a deposit, a balance, a due date or paying in full.`
  - `platform` (GigSalad, The Bash): `- Payment: the platform handles payment. Say nothing about a deposit, a balance,
    a due date or payment.`
  - `unknown_platform`: `- Payment: say nothing about payment, a deposit, a balance or a due date.` (no claim about who
    collects it: for a Thumbtack lead the platform does NOT; Codex R3 run B).
  "After the price" is guidance only and is NOT checked (Codex R1 run A #8); the check is presence and absence.
- **D4 Check (`postCheckDrafts` option `paymentTerms?: PaymentTerms`; absent = no check, e.g. old callers in tests).**
  For each draft (whitespace collapsed):
  - `sentence`: the exact sentence occurs exactly once; with that one occurrence removed, no payment word (below).
  - `platform`: no payment word anywhere.
  - `unknown_platform`: no payment word anywhere, AND always `payment_terms_platform_unknown: add payment terms if
    this client pays Alex directly (Thumbtack, The Knot, WeddingWire); none for GigSalad or The Bash` (once per run).
  - `none`: nothing checked.
  Failure adds `payment_terms_<full|compressed>: ...` to `violations` (`src/run-pipeline.ts:276-285`: it joins
  `gate.fail_reasons` and sets `verified` false, so the draft reaches Alex flagged, never auto-sent).
  **Payment words (a bounded list; anything else is a stated limit, Alex reviews every draft):**
  `\bdeposit\b`, `\bretainer\b`, `\bpayments?\b`, `\bfull payment\b`, `\b(?:pay|paid|payment)\s+in\s+full\b`, `\bdue\s+in\s+full\b`,
  `\bpayable\b`, `\bremaining\s+(?:amount|balance)\b`, `\b(?:entire|full|whole|total)\s+amount\b`,
  `\b\d{1,3}\s?%\s*(?:up\s?front|down|now)\b`, and
  `\b(?:payment|amount|balance|rest|remainder)\s+(?:is\s+|will\s+be\s+)?due\b` (all case-insensitive).
  Must flag: "Payment is due in full before the event.", "payment through the app", "The remaining amount is payable upon signing.", "Please pay
  50% upfront.", "the entire amount upfront", "the rest is due", "pay in full", "a retainer". Must NOT flag: "I balance
  the sound for the room.", "Pay attention to the toasts.", "It pays off.", "a full program", "the rest of the night",
  "due to the wind".
- **D5 Rejected:** the model choosing the band from `timeline_band` (also set by urgency words; its edge is "< 2 weeks");
  the model's `lead_source_column` for platform (it also marks Thumbtack, The Knot, WeddingWire, whose clients pay
  Alex); the app inserting the sentence after the price line (finding the price line in prose is the detector the
  price-block work retired; the app knows the exact sentence, so presence is checkable); storing the band on the
  classification (stale on edits); a proximity check (no bounded definition of "near" that a draft could not
  game; dropped from the contract).

## Plan Quality Gate

### 1. What exactly is changing?
New `src/pipeline/payment-terms.ts` (+ tests), `scripts/capture-prompt-baseline.ts` and its fixtures; `src/index.ts`
(`--platform`); `buildGeneratePrompt` (required parameter, Quote Terms line, shared
predicate); `generateResponse`, `runWithVerification`, `runPipeline`, `runEditPipeline` (pass one value); `postCheckDrafts`
(one option, one check); existing tests that call the changed signatures (one fixed argument each).

### 2. What must not change?
Prices, rates, `lookupPrice`, the price line, the NP2 price block and its check; the Quote Terms exclusions (same three
conditions); every other prompt line (P8); `data/leads.db`; stored classifications.

### 3. How will we know it worked?
EARS below; real-model runs (Execution Path) before the code review.

### 4. What is the most likely way this plan is wrong?
The model paraphrases the sentence or adds a second payment mention, so drafts get flagged often. Flagged, not sent;
the runs measure the rate. Second: the payment-word list flags musician prose it should not (controls in P9).

### 5. How will a human RUN this, and when?
Claude Code, Alex's MacBook, after step 4 and before the code review (Execution Path).

## Acceptance Tests (EARS)

All date tests inject `todayIso`; none reads the clock.

- **P1** WHEN today is 2026-10-11 and the event is 2026-10-11, -12, -24 or -25 (0, 1, 13, 14 days), THE SYSTEM SHALL
  return the full-payment sentence.
- **P2** WHEN the event is 2026-10-26 (15 days) or 2026-12-11 (exactly 2 months), THE SYSTEM SHALL return the
  two-weeks sentence; WHEN 2026-12-12, the two-months sentence.
- **P3** WHEN today is 2026-03-08 and the event is 2026-03-23 (15 days across the DST change), THE SYSTEM SHALL return
  the two-weeks sentence; 2026-03-22 (14 days) → full payment.
- **P4** WHEN today is 2026-12-31: event 2027-02-28 → two weeks; 2027-03-01 → two months. WHEN today is 2027-12-31:
  2028-02-29 → two weeks.
- **P5** WHEN the event is null, "TBD", "2027-02-30", "2026-02-31", or 2026-10-10 (yesterday), THE SYSTEM SHALL return
  the no-date sentence without throwing.
- **P6** `paymentTermsFor`: WHEN clarification mode, `no_viable_scope` or residency → `none` (each, for both a direct
  and a GigSalad lead: exclusions win); ELSE WHEN `platform` is "gigsalad" or "thebash" → `platform`; ELSE WHEN
  `platform` is "yelp", "squarespace" or "direct" (with `lead_source_column` "P" or "D"), or undefined with "D" →
  `sentence`; WHEN `platform` is undefined and `lead_source_column` is "P" → `unknown_platform`.
- **P7** WHEN `buildGeneratePrompt` gets `sentence`, the prompt SHALL contain that sentence in exactly one payment line
  and SHALL NOT contain "A 50% deposit holds the date. Say it plainly"; WHEN `platform`, the platform line and no
  sentence; WHEN `none`, no "Payment:" line.
- **P8 Baseline.** Step 0 commits `src/fixtures/prompt-baseline/<lead>.txt` (inputs: `src/fixtures/prompt-baseline-inputs.json`) for three fixed classifications (direct T3
  wedding, GigSalad T2 party, NP2 nonprofit; no model call), built by the code at `38acd73` with
  `today = "2026-10-11"`. The test builds the new prompt (same inputs, `sentence` = the no-date sentence for the two
  non-platform leads, `platform` for GigSalad) and asserts: the fixture contains the old line exactly once; the new
  prompt equals the fixture with that one line replaced by the new payment line; nothing else differs. **Provenance:**
  the fixtures come from a committed script, `scripts/capture-prompt-baseline.ts --rev 38acd73 --out <dir>`, which
  creates a temporary `git worktree add --detach <tmp> 38acd73`, runs the builder from THAT tree (never the working
  copy) and removes the worktree. Verification regenerates them and compares:
  `npx tsx scripts/capture-prompt-baseline.ts --rev 38acd73 --out "$T" && diff -r "$T" src/fixtures/prompt-baseline`
  → no output. A fixture captured from edited-then-reverted source differs from the regenerated one and fails the
  `diff` (Codex R2 run A). Mutation: change the setup-needs line → the test fails.
- **P9** WHEN a draft holds the sentence once and nothing from the payment list, no violation; WHEN the sentence is
  missing, one word changed, doubled, or joined by any "Must flag" example, `payment_terms_<draft>`; every "Must NOT
  flag" example alone (plus the sentence) → no violation; WHEN `platform` and any "Must flag" example →
  `payment_terms_<draft>`; WHEN `none` → no payment check at all.
- **P10** WHEN `runPipeline` runs with `today` 2026-10-11 on a direct lead dated 2026-10-25 and the stubbed model fails
  the gate twice (3 generate calls), THE SYSTEM SHALL send the full-payment line in all 3 system prompts (captured via
  `setClaudeRequesterForTests`); AND WHEN the stubbed final drafts carry exactly that sentence, `.gate.fail_reasons`
  SHALL hold no `payment_terms_`; AND WHEN they carry the old deposit sentence instead, it SHALL hold
  `payment_terms_full` and `payment_terms_compressed`. Mutation: the post-check gets terms computed for another date
  → the first assertion on `fail_reasons` fails (Codex R2 run B). The mutation's date is 2026-10-10 (15 days: the
  two-weeks sentence), so it crosses a band; a same-band date such as 2026-10-12 would prove nothing (Codex R3 run B).
- **P11** WHEN `runEditPipeline` runs on one stored classification (event 2026-10-25) with `today` 2026-10-01 and then
  2026-10-12, THE SYSTEM SHALL send the two-weeks sentence, then the full-payment sentence.
- **P12** WHEN `runEditPipeline` runs on a stored classification (event 2026-10-25, `past_date_detected` false) with
  `today` 2026-10-26, THE SYSTEM SHALL send the no-date sentence AND the `FLAGGED: EVENT DATE APPEARS TO BE IN THE
  PAST` block.
- **P13** WHEN `runPipeline` runs with no platform and the model returns `lead_source_column` "P", THE SYSTEM SHALL
  send the platform line and add `payment_terms_platform_unknown` to `.gate.fail_reasons`, even when the drafts carry
  no payment word.
- **P14** `src/index.ts` parses and validates its arguments FIRST, before `dotenv`'s key check (moved below it):
  `--platform <value>` must be a `Platform` value. WHEN it gets `--platform gigsalad` (or any `Platform` value), THE
  SYSTEM SHALL pass it to `runPipeline`; WHEN `--platform thumbtack` or `--platform` with no value, THE SYSTEM SHALL
  print the usage and exit 2, whether or not an API key is set. Test (`src/cli-platform.test.ts`): spawn
  `npx tsx src/index.ts --platform thumbtack` with `ANTHROPIC_API_KEY=""` and empty stdin → exit 2, stderr contains
  "usage"; the parsing function `parseCliArgs(argv)` is also unit-tested for the valid values. Mutation: key check
  first → the spawn test gets exit 1 and fails (Codex R3 run B).

Mutations (each must turn a test red): `<=` → `<` at 14 days; millisecond day count; no round-trip check; clamp removed;
past date banded; exclusions after platform; `lead_source_column` used for platform; retry calls `generateResponse`
without the run's terms (computes its own); edit path ignores `today`; payment list missing "payable"; "balance" alone
added to the list.

## Work steps (one concern per commit; failing test first; mutation-check each test)

0. Commit `scripts/capture-prompt-baseline.ts` and the fixtures it writes from a clean worktree of `38acd73`.
1. `payment-terms.ts` + tests (P1-P6).
2. Signatures + prompt line + shared predicate (P7, P8); update existing callers in tests.
3. Post-check option + callers (P9); `runPipeline` / `runWithVerification` / `runEditPipeline` flow and the edit
   past-date check (P10-P13).
3b. CLI `--platform` (P14).
4. Real-model runs, recorded in `docs/reviews/2026-10-11-payment-terms-local-runs.md`.

## Verification Commands (expected results)

- `npm test` → all pass; `npx tsc --noEmit` → clean.
- `git grep -n "50% deposit holds the date. Say it plainly" src ':!src/fixtures'` → no match.
- P8 provenance: the two `git` commands above → one commit, empty diff.
- `npx tsx scripts/check-venue-history.ts` → PASS (the repo is public).

## Execution Path

Network-dependent (real model); the deterministic tests above run offline.

- **Target:** Alex's MacBook, real model, scratch `DATABASE_PATH` (nothing sent; `data/leads.db` untouched).
- **Mechanism:** a scratch script calls `runPipeline(text, undefined, platform, undefined, "2026-10-12")` and prints
  `.classification.action`, `.classification.lead_source_column`, `paymentTermsFor(output.classification,
  output.pricing, "2026-10-12").kind`, `.classification.platform`, `.classification.event_date_iso`, `.drafts.full_draft`, `.drafts.compressed_draft`,
  `.gate.fail_reasons`, `.verified` as JSON. Leads (exact text):
  - **a** (direct, no platform): "Hi, we're hosting a client appreciation dinner on October 18, 2026, 6-9pm at our
    office in Sorrento Valley, about 60 guests. Looking for solo guitar for background music. What would it cost?"
    → expect full payment (6 days).
  - **b** (`platform = "gigsalad"`): "Event: Birthday Party. Date: November 14, 2026. Location: Encinitas, CA. Guests: 40.
    Looking for a Spanish guitarist for 2 hours. Budget flexible." → expect no payment wording.
  - **c** (direct): "We're getting married on March 20, 2027 at a private estate in Rancho Santa Fe, 120 guests. We'd
    love solo guitar for the ceremony and cocktail hour. Can you send pricing?" → expect two months.
  - **d** (direct, no date): "Planning a company holiday party sometime in December, date not set yet, about 80
    people downtown San Diego. Solo guitar, 3 hours. Ballpark price?" → expect the no-date sentence.
  - **e** (`platform = "yelp"`): lead a's text with "November 10, 2026" → expect two weeks (Yelp gets dated terms).
- **Deterministic per-draft assertions (a script, not eyeballing):** the expected sentence occurs exactly once (or, for
  b, no payment word); `.gate.fail_reasons` contains no `payment_terms_`; the event date parsed as written.
- **Fail-closed sample rule:** a lead counts only when `classification.action` is "quote" or "assume_and_quote" AND
  its printed kind is the expected one (`sentence` for a, c, d, e; `platform` for b). The kind alone is not enough: a
  `one_question` reply with a resolved format still gets kind `platform` (Codex R3 run A). The counting predicate lives
  in the run script and is checked with a mutation before the runs: a fake output with `action` "one_question" must
  not count. All 5 must count = 10 drafts checked; a lead that does not is re-run once; still not → record
  "insufficient" and the step FAILS. **f** (extra, no platform): lead b's text run without `platform` → expect kind
  `unknown_platform` and the flag (if the model marks it "D" instead, record it: a hand-run GigSalad lead the model
  reads as direct gets dated terms, a stated limit).
- **Prerequisites:** model access (ALREADY HAVE), `jq` (ALREADY HAVE). **Who:** Claude Code. **Trigger:** after step 4,
  before Codex code review round 1.

## Codex review

Plan review round 2 next (narrow: the round-1 fixes). Pre-registered stops: a 2nd NO-GO stops automatic iteration;
round 3 only with Alex's yes; a 3rd NO-GO is the hard cap.

## Feed-Forward

- **Hardest decision:** model-written exact sentence plus an exact check, versus the app inserting it; kept, because
  inserting needs the price line's position in prose.
- **Rejected alternatives:** D5.
- **Least confident:** the payment-word list: too narrow misses a paraphrase (Alex still reviews), too wide flags
  musician prose. The controls bound both; real drafts may find a third phrasing. Second: a hand-run GigSalad lead
  that the model marks "D" gets dated terms with no flag (only `--platform` prevents it; run f measures it).

## Three Questions

1. **Hardest decision in this session?** Who writes the sentence (above), and keying platform on the intake field.
2. **What did you reject, and why?** D5.
3. **Least confident about going into the next phase?** The payment-word list's coverage, and the paraphrase rate.
