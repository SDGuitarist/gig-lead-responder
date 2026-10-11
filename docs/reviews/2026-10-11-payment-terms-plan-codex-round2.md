# Codex PLAN review, round 2: payment terms by lead time

**Plan:** `docs/plans/2026-10-11-fix-payment-terms-by-lead-time-plan.md` at `f162446` (Revision 1). Prior Codex
verdicts: round 1 NO-GO both runs (`docs/reviews/2026-10-11-payment-terms-plan-codex-round1.md`).
**Reader and trigger:** Revision 2; Alex's round-3 decision.

**Verdict: NO-GO on BOTH runs: the 2nd NO-GO, automatic iteration stopped.** Both runs: every round-1 finding closed
(frozen terms flow, precedence, civil dates, payment-word controls, dates of the execution leads). Each run found
different gaps, all in how the plan proves itself:

| # | Runs | Finding | Disposition (Revision 2) |
|---|---|---|---|
| 1 | B P1 | P10 captures prompts only; a post-check using different terms would still pass | FIXED: P10 also asserts the final gate: stub drafts carrying the run's sentence → no `payment_terms_`; carrying the old deposit sentence → flagged; mutation: post-check given other terms |
| 2 | B P2 | An edit after the event date gets the no-date sentence but not the past-date flag (edits skip enrichment) | FIXED: `runEditPipeline` re-applies the deterministic past-date check with its `today`; P12 |
| 3 | A P2 | Execution script never proves each lead was a quote (a clarification draft passes "no payment words") | FIXED: the script prints `classification.action` and the run's `PaymentTerms.kind`; a lead counts only if kind is `sentence` or `platform` as expected |
| 4 | A P2 | Fixture provenance passes if captured from edited-then-reverted source | FIXED: a committed capture script builds the fixtures from a clean `git worktree` of `38acd73`; verification regenerates them and `diff`s (reproducible, not trusted) |

Also in Revision 2 (Alex, 2026-10-11, outside the runs, after a heads-up that hand-run GigSalad leads would get
deposit terms): a lead with no intake platform that the model marks `lead_source_column` "P" gets no payment
sentence AND a `payment_terms_platform_unknown` flag; the CLI gains `--platform`.

## Run A (Claude Code, `codex exec -s read-only`, 2026-10-11; HEAD `f162446`)

```
NO-GO — Round 2. Static, read-only review; no runtime or model execution performed.

Findings:

- P2 — `docs/plans/2026-10-11-fix-payment-terms-by-lead-time-plan.md:205-209`  
  The execution script does not print or assert `classification.action`, so the fail-closed rule cannot mechanically prove that each lead produced a quote rather than clarification drafts.

  Concrete input: platform lead **b** classified as `action: "one_question"` but producing drafts with no payment wording. The listed assertions pass because platform drafts are only checked for payment words. Add `classification.action` to the JSON output and require `action === "quote"` before counting the 10 drafts.

- P2 — `docs/plans/2026-10-11-fix-payment-terms-by-lead-time-plan.md:149-156`  
  The provenance check can pass for a fixture captured after a source change if that source change is reverted before committing the fixture.

  Concrete sequence: modify `src/prompts/generate.ts`, capture fixtures, restore the source to `38acd73`, commit only the fixtures. Both provenance commands pass even though the fixture was not generated from the parent code. Capture from a clean checkout/worktree of `38acd73`, or record and verify the generation commit/source hash.

Checks that passed review:

- One `PaymentTerms` value is specified through initial generation, retries, edits, and post-checks.
- Civil-day arithmetic, strict round-trip validation, month clamping, and P1–P5 dates are correct.
- All listed payment-word positive and negative controls behave consistently with the stated regexes.
- Execution dates are correct for 2026-10-12: lead `a` is 6 days/full payment; `e` is 29 days/two-weeks sentence; platform `b` has no payment wording.
- “After the price” is correctly treated as non-enforced guidance.

This is the second NO-GO, so automatic iteration stops. Round 3 requires Alejandro’s explicit authorization.

[fix handoff omitted]
```

## Run B (Alex, inside Codex, 2026-10-11; HEAD `f162446`)

```
## NO-GO — Round 2

The branch gate passed: correct repo, branch, expected HEAD `f1624466ce8ef7e064069d6c65da12892d195fc3`, and clean worktree. The process check remains restricted (`ps` not permitted), with no repository evidence of an active writer or auto-continue.

### P1 — P10 does not actually prove post-check receives the same terms

Plan: P10, D2/D4, lines 161–163; `src/run-pipeline.ts` post-check call.

P10 says the test captures the same terms passed to `postCheckDrafts` via `setClaudeRequesterForTests`, but that test hook only observes Claude requests. It cannot observe post-check arguments.

Concrete failing input:

- direct lead
- `event_date_iso: "2026-10-25"`
- injected `today: "2026-10-11"`
- model drafts contain the exact full-payment sentence
- mutate the post-check call to use the old deposit sentence

All three system prompts still contain the correct full-payment sentence, so the stated P10 prompt-capture test passes, while the post-check uses a different `PaymentTerms`.

Add a deterministic post-check assertion: make the draft contain the run’s expected sentence and assert the final gate stays clear; mutate the post-check term and require the test to fail.

### P2 — Edit after the event gets the no-date sentence but loses the past-date warning

Plan: D1, D2, P11, lines 57–74 and 164–165; `src/run-pipeline.ts:313-338`.

`runEditPipeline` recomputes `PaymentTerms` using the current date, but it does not re-run `enrichClassification`. Therefore `past_date_detected` remains whatever was stored on the original classification.

Concrete input:

1. Original classification on `2026-10-01`, event date `2026-10-25`.
2. Edit on `2026-10-26`.

The payment sentence correctly becomes the no-date deposit sentence, but the generated prompt lacks `FLAGGED: EVENT DATE APPEARS TO BE IN THE PAST`, so the draft is not instructed to confirm the year as D1 claims.

Add an edit-after-event acceptance test, or explicitly remove the claim that the edit path asks for past-date confirmation.

### Round-1 items verified closed

- Frozen `PaymentTerms` flow and platform precedence are specified.
- Civil-day arithmetic and strict date round-trip validation are specified.
- Payment-word controls cover the listed positive and negative examples.
- P8 now has a concrete baseline and provenance command.
- Execution fixtures use the correct dates for `2026-10-12`; the all-five quote requirement prevents a vacuous pass.
- “Near the price” is explicitly guidance, not an unchecked contract.

Because this is the second NO-GO, automatic iteration stops. Round 3 requires Alejandro’s explicit authorization.
```
