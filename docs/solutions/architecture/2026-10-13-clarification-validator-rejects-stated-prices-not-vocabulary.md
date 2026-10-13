---
title: "Clarification mode: the validator rejects a stated price, not the words 'quote' and 'rate'"
category: architecture
tags: [clarification, validator, generate, regex, redos, measurement, plan-review, codex-review, observational-evidence]
module: src/pipeline/generate.ts, src/clarification-validator.test.ts, scripts/clarification-measure.ts
symptom: "A vague lead ended with no draft: 'Clarification mode full_draft must not include pricing language' in 17 of 18 real-model runs, though no draft stated a price."
root_cause: "enforceClarificationDraft rejected the bare words quote and rate; the model opens with 'Before I quote, one question', which is a bridge to a later quote, not a price."
date: 2026-10-13
model: claude-sonnet-5-5
predecessor: architecture/2026-10-13-coi-sentence-owned-by-the-app-and-every-send-surface.md
related:
  - docs/plans/2026-10-13-fix-clarification-pricing-validator-plan.md
  - docs/reviews/2026-10-13-clarification-failure-measurement.md
  - docs/reviews/2026-10-13-clarification-failure-rerun.md
  - docs/reviews/2026-10-13-clarification-plan-codex-round1.md
  - docs/reviews/2026-10-13-clarification-plan-codex-round2.md
  - docs/reviews/2026-10-13-clarification-code-codex-round1.md
---

# Clarification mode: reject what the draft STATES, not the vocabulary around it

## Prior Phase Risk

> "an unmarked amount ('around fifteen hundred') or a soft statement ('on the higher end') now passes. The re-run
> counts the vocabulary so it is visible, but 18 runs cannot rule it out and nothing deterministic stops it."
> (plan Feed-Forward, least confident)

Accepted, not closed. It is pinned as a documented boundary (test V10: those sentences return drafts), and the
validator's comment claims no more than the grammar. The 18-run re-run saw no such text; it cannot prove absence.

## Problem

Clarification mode asks one binary question and states no price. The validator threw on any draft matching
`/\$\s?\d|\brate\b|\bquote\b|.../`. The model's natural bridge, "Before I quote, one question", matched `quote`.
Measured on 18 real runs: 17 ended with no draft; 17 of 21 generate calls held a banned token, 16 of them the word
`quote`; no draft stated a price. A defect that looked like a price leak was a vocabulary rule stricter than the
prompt's own invariant.

## Solution (what ships)

| Piece | What it does |
|---|---|
| `PRICE_STATEMENT_PATTERN` | six alternatives: a `$` figure; digits next to dollars/bucks/usd, or `usd` + digits; a run of at most 6 number words next to dollars/bucks; a `k` amount (`1.5k`); the internal terms anchor, floor, investment |
| Bare words | `quote`, `rate`, `price` are allowed; a booked quote is not a stated amount |
| Error message | `Clarification mode <field> must not include pricing language: "<match>"` — the match only, never the draft |
| Scope | unchanged: only `action === "one_question"` with `format_recommended === "unresolved"`, both drafts |
| Prompt | unchanged by decision (Alex: "narrow the validator, leave the prompt") |
| Tests | V1–V11 in `src/clarification-validator.test.ts` |
| Runner | `scripts/clarification-measure.ts`, committed (`--runs`, `--leads`, `--out`, `--tag`, `--today`), observational |

Evidence: 919 pass / 0 fail / 1 skip; tsc clean; leak check exit 0; 18 mutations each fail a named test; 18 real
runs went from 17 no-draft to 3 no-draft with 0 pricing-language errors.

## How it got there (what each step taught)

1. **Measure before fixing, and read the contexts.** The first reading was "the model leaks prices". Logging every
   generate response and testing each alternative of the old pattern one at a time showed 0 price tokens and 16 hits
   on the word `quote`. The response (narrow the validator) was a different fix from the one the symptom suggested.
2. **A loosened check must say exactly what it no longer guarantees.** Plan review round 1 (NO-GO, 3 P1) found the
   first grammar missed spelled-out and `k` amounts and that the re-run was described as proof. The invariant became
   "no text matching the supported grammar and no internal term"; unmarked amounts are outside it by decision.
3. **An invariant stated in two places drifts.** Round 2 (NO-GO, one P1) found the plan still said "no AMOUNT" in one
   line and allowed unmarked amounts in two others. Revision 1b changed the wording in place, not by appending.
4. **A regex over model output needs a length check.** My own check on a 50,000-character draft showed the
   unbounded number-word run was quadratic (about 2 s). It is bounded to at most 5 further words; test V11 pins it.
5. **A new test that must fail first, did.** 8 of the 16 tests written against the old code failed before the fix
   (V1, V2, V5, V5b, V5c, V7 twice, V10), 8 passed; V11 arrived with the bound.
6. **A fix that removes a defect can reveal the next one.** With drafts getting past the validator, generate calls
   doubled (21 to 46: drafts now reach the verify gate and rewrites) and 3 of 18 runs ended on the existing
   "exactly one question" rule (the model split the binary question over two sentences). It appeared 0 of 21 times
   before. Recorded as its own item, not folded in.

## What this does NOT fix

- **An unmarked amount** ("around fifteen hundred") and soft price language ("on the higher end") pass. Pinned by V10.
- **The "exactly one question" failure:** 3 of 18 runs end with no draft; the runner does not capture `verified` or
  the gate's reasons, so how many of the 15 drafts passed verification is unknown.
- **Model behaviour:** 18 runs, one model, made-up leads, one run per lead per process.
- **A real send** through the approve route remains unexecuted.

## Prevention

- **Before tightening or loosening a validator, log what the model wrote and test each alternative alone.** The
  measurement decided the fix in one reading.
- **State a check's guarantee as the grammar it implements**, and pin the documented boundary with a test that
  expects the pass.
- **Run any regex that touches model output on a 50,000-character input** before it ships.
- **Label a re-run "observational" in the plan and the record**: the count says what happened, not what can.
- **When a fix removes a rejection, expect the rule behind it to surface.** Read the next failure before saying the
  path works.
- **Never write a heredoc with backticks unquoted.** Use `<<'EOF'` or the editor tool (hit again this cycle).

## Feed-Forward

- **Hardest decision:** loosening a safety check and saying what it then does not guarantee.
- **Rejected:** removing the check; a prompt-only fix; a retry loop; a proximity rule; rejecting number words alone.
- **Least confident:** the unmarked amount that passes, and the "exactly one question" rule now carrying 3 of 18 runs.

## Three Questions

1. **Hardest pattern to extract from the fixes?** That the validator was stricter than the prompt's own invariant:
   the check and the instruction had drifted apart, and the check was the one that failed users.
2. **What did you consider documenting but left out, and why?** The Codex round texts (they are in
   `docs/reviews/`) and the 18 mutation names (in the plan's mutation map).
3. **What might future sessions miss that this solution doesn't cover?** The next rule behind this one: "exactly one
   question" fails the draft with no retry, and `verified` is not captured by the runner, so the real pass rate of the
   clarification path is still unmeasured.
