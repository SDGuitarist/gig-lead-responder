---
date: 2026-10-13
phase: plan review, round 1
subject: docs/plans/2026-10-13-feat-vague-lead-quote-with-question-plan.md (Revision 0, HEAD c9fbb62)
prior_verdicts: none
verdict: NO-GO (5 P1, 1 P2; the route diagnosis confirmed)
---

# Round 1 (plan): NO-GO, 5 P1, 1 P2

One run. Pasted by Alex 2026-10-13; findings verbatim, the appended fix prompt summarized (its five numbered items map
onto findings 1-5 and 6). Claude Code's check is in the last table.

## Findings (verbatim)

P1

1. Reference instructions contradict the app's required Quote Terms.

The plan requires the example's payment and COI sentences to come from Quote Terms, but V4 says "no sentence of the
example may appear in the draft" (plan lines 161-165). The example itself contains those exact mandatory sentences,
and the generator requires them in every normal quote (source lines 296-301). The copy check only removes them after
generation, so the prompt still contains an impossible instruction.

The gate also does not exclude platform payment terms, `coi_required`, nonprofit price-marker mode, or other
quote-term variants. Those can make the example's fixed no-date payment/default-COI wording contradict the actual
generated terms.

2. D1 does not define the `Latin band` boundary.

The current SPECIAL CASE explicitly names "Latin band" (classify prompt lines 70-74), but the existing routing rules
only define generic "Latin music" / "Spanish guitar" as solo or duo (lines 127-138). Meanwhile, the hard gate
declines several explicit band requests but not generic "Latin band" (hard gate lines 79-97).

The plan must distinguish "category-only, unsure what format" from "the client explicitly wants a band." Otherwise
the proposed wording can turn the current `Latin band` example into a solo quote without explaining why that is safe.

3. The salutation is still pending, but the work steps build the reference before Alex answers.

The plan says the wording is final except the salutation (lines 103-132), yet step 2 builds the reference module and
block before step 4 (lines 178-183). The generator currently requires omitting a salutation when there is no client
name (generate prompt line 98). The plan needs an explicit stop condition: no reference module or production
implementation until Alex resolves this, or a clearly authorized decision to use the nameless rule.

4. The measurement is exploratory, but its metrics are not pre-registered precisely enough.

The plan compares arm B against arm A even though the classifier and route differ between arms (lines 141-149). That
can describe outcomes, but it cannot attribute differences solely to the reference block or classifier wording. The
plan also does not define exact numerators/denominators for "quote at the app's price," "verified rate," question
count, or mechanical checks. Add formulas, decision rules, and a statement that the comparison is descriptive rather
than causal.

5. The reference-block gate is not fully specified against existing prompt modes.

The T4 gate withholds its block for clarification, large-gap, graceful-decline, and past-date modes (generate lines
205-223). The new plan names similar exclusions (plan lines 79-84), but it does not say what happens for platform
payment, `coi_required`, nonprofit price insertion, or sourced/cultural drafting instructions. The plan must either
exclude those cases or explain why the reference does not conflict with them.

P2

6. V7 and V8 are weakly defined.

V7 says to hash C0-C12 "minus the cases the block applies to" (plan lines 168-169), so it may omit the most
important changed case. Explicitly identify the changed case(s), the unchanged cases, and the expected hash behavior
for each. V8 is a reported copy check with no pass bar (lines 170-172). That is useful observation, but it is not an
acceptance test. Label it as measurement instrumentation, not a system acceptance criterion, and verify that the
report actually fails or reports meaningfully when the copy-check implementation is mutated.

7. The route diagnosis is otherwise correct. For `one_question` + resolved format: `isClarificationLead` is false
because it requires `unresolved`; the pipeline calls `lookupPrice` and `budgetGapFor`; the three generate-prompt
clarification checks are false; the pipeline's no-price validator is false; `quoteTermsOff` is false unless another
exclusion applies; the verify prompt uses the normal quote path; the router still holds vague `one_question` leads
for Alex. Nothing in that path is specific to `assume_and_quote`. The normalizer, enrichment, and classification
heuristics do not turn a resolved format back into `unresolved`.

NO-GO. No production code was written.

## Claude Code's check (2026-10-13)

| Finding | Check | Result |
|---|---|---|
| 1 contradiction with Quote Terms | The plan's V4 says "no sentence of the example may appear in the draft" and the example carries the two sentences the Quote Terms block requires (`src/prompts/generate.ts:296-301`). `paymentTermsFor` returns `platform` for GigSalad/The Bash, `unknown_platform` for a hand-run "P" lead, and a date-based sentence otherwise (`src/pipeline/payment-terms.ts:60-65`); `coi_required` selects the timeline sentence (`src/pipeline/coi.ts:26`). | **Valid.** |
| 2 "Latin band" | `NON_ALEX_FORMATS` declines only "rock band", "country band", "cover band" among bands (`src/pipeline/hard-gate.ts:20-28`); a generic "Latin band" passes the hard gate and today becomes `unresolved` through the SPECIAL CASE. | **Valid.** |
| 3 salutation vs work order | Work step 2 builds the module before Alex answers; `src/prompts/generate.ts:98` omits the salutation with no client name. | **Valid.** |
| 4 metrics | No numerator or denominator was written for price, verified, question count. | **Valid.** |
| 5 gate against other modes | The plan's predicate did not name platform payment, nonprofit, cultural or sourced modes. | **Valid.** |
| 6 V7/V8 | V7 as written omitted the case that matters most. (My first reading here, that C8 is an unknown-platform lead and would be withheld, was WRONG: the block's payment condition reads the `paymentTerms` argument, and the hash inventory passes the fixed `noDate` sentence for every non-GigSalad case, so C8 IS changed. Corrected in the plan's V7 table; found on re-reading `src/generate-prompt-cases.ts:20-30`.) | **Valid.** |

All six accepted; item 7 is a confirmation, not a defect.
