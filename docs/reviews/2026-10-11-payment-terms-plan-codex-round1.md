# Codex PLAN review, round 1: payment terms by lead time

**Plan:** `docs/plans/2026-10-11-fix-payment-terms-by-lead-time-plan.md` at `38acd73` (Revision 0). Prior Codex
verdicts: none. **Pre-registered stops:** a 2nd NO-GO stops automatic iteration (round 3 only with Alex's YES); a 3rd
NO-GO is the hard cap. **Reader and trigger:** Revision 1 of the plan; the round-2 prompt.

**Verdict: NO-GO on BOTH runs.** Run A: 5 P1, 3 P2. Run B: 2 P1, 3 P2. All accepted; fixed in Revision 1.

| # | Runs | Finding | Disposition (Revision 1) |
|---|---|---|---|
| 1 | A P1, B P1 | `today` is not frozen per run: retries (`runWithVerification`), edits and post-check can each compute their own | FIXED: one `PaymentTerms` value computed once per run (runPipeline's existing `today`; runEditPipeline gains `today`), passed to every `generateResponse` call and to `postCheckDrafts` |
| 2 | B P1 | Excluded replies (clarification, no viable scope, residency) would be flagged for a missing sentence | FIXED: one predicate decides "payment line active"; the same value drives the prompt and the check (`kind: "none"` = no line, no check) |
| 3 | A P1 | Day counting with `Date` milliseconds breaks across DST (2026-03-08 → 03-23) | FIXED: civil-date arithmetic in UTC day numbers; test added |
| 4 | A P1, B P2 | `parseLocalDate("2027-02-30")` normalizes instead of failing | FIXED: strict `YYYY-MM-DD` + round-trip; 2027-02-30 and 2026-02-31 → no-date sentence |
| 5 | A P1, B P2 | Payment-word check misses "due in full", "remaining amount", "50% upfront", "payable upon signing" | FIXED: a bounded vocabulary list with positive and negative controls; misses beyond it stated as a limit |
| 6 | A P1 | Platform precedence vs the exclusions undefined | FIXED: exclusions first, then platform, then dated |
| 7 | A P2, B P2 | P8 baseline not executable / provenance not checked | FIXED: fixture commit with no `src/` change vs `38acd73`, a verification command, fixed `today`, exact one-line replacement, a mutation |
| 8 | A P2 | Execution path not runnable (no exact leads, platform, fields) | FIXED: exact lead texts and dates, a scratch script for the platform run, exact JSON fields |
| 9 | A P2 | "Near the price" instructed, never checked | FIXED: placement is guidance only, stated as not enforced |

Also in Revision 1 (Alex, 2026-10-11, outside the Codex runs, after a heads-up that Yelp could lose its payment line):
the no-payment rule keys on the intake-set `platform` being `gigsalad` or `thebash`, NOT the model's
`lead_source_column` "P" (which also covers Thumbtack, The Knot, WeddingWire; Alex: Yelp and those clients pay him
directly).

## Run A (Claude Code, `codex exec -s read-only`, 2026-10-11; HEAD `38acd73`)

```
NO-GO — Round 1.

Round 0: NO — no runtime or model execution performed; this was a read-only static plan review under the stated constraints.

P1

1. Shared `today` is not wired through the generation/edit/retry path  
   Plan §D2–D4, lines 53–68; `src/pipeline/generate.ts:69-76`; `src/pipeline/verify.ts:83-106`; `src/run-pipeline.ts:332-338`.

   `buildGeneratePrompt` gets an optional `today`, but `generateResponse`, `runWithVerification`, and `runEditPipeline` do not accept or forward one. The post-check caller also has no specified shared sentence value.

   Failing input: a direct lead with `event_date_iso = "2026-10-25"`:
   - initial run on `2026-10-11`: 14 days → `Full payment holds the date.`
   - edit on `2026-10-12`: 13 days → still full
   - edit on `2026-10-26`: past date → no-date sentence

   P10 cannot pass as written because there is no injected `today` path through `runEditPipeline`. Specify one computed sentence/today value passed through generation, verification retries, edits, and post-check.

2. “Calendar days” does not define DST-safe arithmetic  
   Plan §D1, lines 46–52; `src/utils/dates.ts:15-18`.

   Subtracting parsed `Date` milliseconds can misclassify Pacific dates across daylight-saving changes.

   Failing input: `today = "2026-03-08"`, event `"2026-03-23"`. This is 15 calendar days and must use the two-weeks sentence; a millisecond difference floored to 24-hour days can produce 14 and incorrectly select full payment.

   Require civil-date arithmetic or an explicit DST regression test.

3. Invalid ISO dates are not actually specified or safely handled  
   Plan §D1/P5, lines 46–48 and 103; `src/utils/dates.ts:15-18`.

   `new Date("2027-02-30T12:00:00")` normalizes rather than throwing, so the plan’s “unparsable → no-date sentence” rule is incomplete.

   Failing input: `event_date_iso = "2027-02-30"`. The implementation may treat it as March 2 and select a lead-time band instead of the no-date sentence. Define strict `YYYY-MM-DD` validation and add this case.

4. Payment-word detection has clear misses  
   Plan §D4/P9, lines 62–68 and 113–117.

   The proposed patterns do not detect several payment statements prohibited by the prompt.

   Failing inputs:
   - Platform lead draft: `Payment is due in full before the event.` — no `deposit`, `full payment`, or `balance`; it can pass.
   - Direct draft with the required sentence plus: `The remaining amount is due before the event.` — not matched.
   - Direct draft with: `Please pay 50% upfront.` — not matched.

   Define the complete payment-sense pattern contract, including platform-only payment mentions, and add positive/negative tests. Keep the musician-prose control such as `I balance the sound for the room`.

5. Platform leads conflict with the existing exclusions  
   Plan §D3, lines 58–61; P5b/P7, lines 104–109.

   P5b says every platform lead gets the platform payment line, while P7 says clarification, no-viable-scope, and residency prompts contain no payment sentence.

   Failing input: `lead_source_column = "P"`, `action = "one_question"`, `format_recommended = "unresolved"`. It is unclear whether the prompt should say `the platform handles payment` or contain no payment instruction at all. Define precedence and the corresponding `paymentSentence` value/check behavior.

P2

6. P8’s golden-fixture procedure is not executable enough to prove byte identity  
   Plan §P8 and work step 0, lines 110–112 and 126.

   The plan names three fixtures but does not specify how they are captured at the parent commit, what fixed `today` is used, or how the test proves that only the old payment block changed.

   Failing mutation: changing the setup-needs line could still pass a test that only checks the new payment sentence exists. Require a deterministic parent-commit fixture and an exact “old prompt with exactly one payment block replacement” comparison.

7. The human execution path lacks exact fixtures and commands  
   Plan §Execution Path, lines 138–149.

   “Direct corporate,” “GigSalad birthday,” and similar descriptions are not runnable inputs, and “price line unchanged in shape” is not a deterministic assertion.

   Failing scenario: the no-date description produces clarification rather than a quote; the fail-closed rule records “insufficient,” so the run proves nothing about the no-date sentence. Add exact lead text, exact command, exact JSON fields to inspect, and a separate deterministic offline harness. Keep any real-model run clearly labeled as network-dependent.

8. “Near the price” is instructed but never checked  
   Plan §D3/D4, lines 58–68.

   A draft can place the exact payment sentence at the beginning and the price at the end, pass the proposed post-check, and still violate the prompt’s placement requirement.

   Failing input: a draft containing the exact sentence once, followed by several paragraphs, with the price only in the final line. Either define and test a bounded proximity rule or remove “near the price” as a contractual requirement.

No P3 findings.

Relevant prior lessons surfaced by compound-start: the hybrid deterministic-computation solution supports injected `today` and code-owned date arithmetic; the fixed-lines solution warns against inferring structured facts from model prose; the stored-classification solution confirms that edit paths must receive the same deterministic guard as fresh runs.

[fix handoff omitted]
```

## Run B (Alex, inside Codex, 2026-10-11; HEAD `38acd73`)

```
## NO-GO — Round 1

Round 0: NO — no execution yet. This review is static; no runtime claims are treated as verified.

### P1 — Excluded drafts would be incorrectly held

Plan: D3–D4, P7; implementation target `src/run-pipeline.ts:260-266`.

The plan says `undefined` means “not a quote,” but does not specify that callers must pass `undefined` for clarification, no-viable-scope, or residency drafts.

Concrete input:

- `action: "quote"`
- `pricing.budget.tier: "no_viable_scope"`
- `event_date_iso: "2026-10-17"`
- `today: "2026-10-11"`
- direct lead (`lead_source_column: "D"`)

The prompt correctly contains no payment sentence, but if the caller passes the computed full-payment sentence to `postCheckDrafts`, the draft is held for missing payment text. Add an explicit “payment terms active” predicate and test all three exclusions.

### P1 — “Injected today” is not wired through the actual call graph

Plan: D2, P10, work steps 2–3; `src/pipeline/generate.ts:69-76`, `src/pipeline/verify.ts:83-106`, `src/run-pipeline.ts:313-338`.

`buildGeneratePrompt` may receive `today`, but `generateResponse`, `runWithVerification`, and `runEditPipeline` currently have no `today` parameter. Retries can rebuild the prompt using a different system date, and the post-check may use a separately recomputed sentence.

Concrete failure:

- First generation at `2026-10-11 23:59` for an event on `2026-11-02`
- Retry after midnight on `2026-10-12`

The prompt can change from the two-weeks sentence to the full-payment sentence during one pipeline run. P10 also cannot test two injected dates through `runEditPipeline` as written.

The plan must specify one frozen `todayIso` per pipeline/edit run and how the exact same sentence reaches both prompt construction and post-check.

### P2 — Invalid dates are not defined strictly enough

Plan: D1, P5; `src/utils/dates.ts:11-16`.

`parseLocalDate("2026-02-31")` normalizes to a later date instead of rejecting it. That input is “unparsable” under the plan but could be assigned a payment band.

Concrete input:

    event_date_iso = "2026-02-31"
    todayIso = "2026-02-01"

Add canonical `YYYY-MM-DD` validation and a regression test proving it returns the no-date sentence without throwing.

### P2 — Payment-word detection misses prohibited paraphrases

Plan: D4, P9, lines 62–68 and 113–117.

The exact sentence check catches a missing required sentence, but the “no other payment wording” patterns miss common contradictions.

Concrete draft:

    A 50% deposit holds the date, and the balance is due two weeks before the event.
    The remaining amount is payable upon signing.

This passes the listed patterns, although it contains an additional payment instruction. Similar misses include “pay in full,” “the entire amount upfront,” and “the rest is due.”

Bound the intended payment-sense vocabulary and add positive/negative controls, including a genuine musician sentence such as `I balance the sound for the room`.

### P2 — P8 does not require a mechanically verified baseline

Plan: P8 and work step 0, lines 110–112 and 124–129.

The plan says the fixture is written at the parent commit, but gives no verification command or metadata requirement. A fixture regenerated after implementation could still make the test pass.

Concrete failure: change an unrelated prompt line, regenerate the fixture from the changed prompt, and the byte comparison passes.

Require the fixture’s provenance to be checked from git history, as the prior price-block plan did, and state the exact parent commit (`38acd73...`) in the test or verification step.

Because these P1/P2 issues affect executable payment logic and plan acceptance claims, the plan is not ready for implementation.
```
