---
title: "fix: clarification-mode drafts are rejected for the words 'quote' and 'rate', not for prices"
date: 2026-10-13
status: plan, Revision 0 (before plan review round 1)
branch: feat/hub-phase0
---

# Clarification validator: reject prices, not the words "quote" and "rate"

### Prior Phase Risk

No brainstorm: skip gate, the input is a measured defect with a record and a stated direction from Alex (2026-10-13:
"1 yes", narrow the validator, leave the prompt alone). The measurement's own limit, quoted from
`docs/reviews/2026-10-13-clarification-failure-measurement.md`: "made-up leads, one model, 18 runs; whether the real
inbox sees mostly vague leads is not known". This plan accepts it: the fix is small and a re-run of the same 18 runs
shows the before and after.

## Problem (measured, not assumed)

A lead too vague to quote goes to clarification mode: one binary question, no price. The generate step then throws
`GenerationError: Clarification mode <draft> must not include pricing language` when the draft matches
`PRICE_SIGNAL_PATTERN` (`src/pipeline/generate.ts:31`):
`/\$\s?\d|\brate\b|\bquote\b|\banchor\b|\bfloor\b|\binvestment\b/i`. No draft is produced.

Measured 2026-10-13 (real model, 18 runs, 6 made-up vague leads x 3; the rejected drafts were captured):

| | |
|---|---|
| runs with no draft | 17 of 18 |
| generate calls holding a banned token | 17 of 21 |
| token `quote` | 16 calls ("Before I quote, one question: ...") |
| token `rate` | 1 call ("...a specific recommendation and a rate") |
| `$` figure, `anchor`, `floor`, `investment` | 0 |

The prompt's own rule (`src/prompts/generate.ts`, Clarification Mode HARD CONSTRAINT) is "Do NOT state a price, rate,
anchor, floor, or package" and the same prompt says "No quote yet". The model echoes the word as a bridge to a quote
that will follow. The validator rejects the word; it should reject a stated price.

## What is true today (read 2026-10-13)

- The pattern is used in exactly one place: `enforceClarificationDraft` (`src/pipeline/generate.ts:140-149`),
  called only when `action === "one_question"` and `format_recommended === "unresolved"` (`:127-130`), on both drafts.
- The throw is a `GenerationError`; there is no retry of the generate call for it.
- One test pins it: `src/enrich-generate.test.ts` (~line 300-311), a draft with "My rate starts at $1200", expecting
  `/must not include pricing language/`.
- The "exactly one question" check is separate and was not the cause in any of the 18 runs (every logged draft had
  one question mark).

## Decision

- **D1 The validator:** replace `PRICE_SIGNAL_PATTERN` with `PRICE_STATEMENT_PATTERN`:
  - a dollar figure: `\$\s?\d` (unchanged);
  - the internal pricing terms, unchanged: `\banchor\b`, `\bfloor\b`, `\binvestment\b`;
  - a number next to a currency word: `\b\d[\d,]*(?:\.\d+)?\s?(?:dollars?|bucks|usd)\b` and `\busd\s?\d`;
  - the bare words `quote` and `rate` are NO LONGER rejected on their own.
- **D2 The error names what matched:** `Clarification mode <field> must not include pricing language: "<matched text>"`.
  The prefix the existing test matches is unchanged; the matched text lands in the error, because the error is the
  only record of a rejected draft (the measurement needed a wrapper to see it).
- **D3 The prompt is not changed** (Alex 2026-10-13). "No quote yet" stays.
- **D4 Rejected:** removing the check (the figure is the real invariant); a prompt-only fix (cannot guarantee the
  word never appears, and "Before I quote" is good copy); a retry loop that feeds the rejection back (adds a model
  call per failure at an 81% failure rate and fixes nothing the validator should not already allow); proximity rules
  such as "quote near a 3-digit number" (a guest count, "100 people", would be a false reject).

## Plan Quality Gate

1. **What exactly is changing?** One regex constant and the throw message in `src/pipeline/generate.ts`; tests in
   `src/enrich-generate.test.ts` (or a new `src/clarification-validator.test.ts`).
2. **What must not change?** The "exactly one question" rule; the clarification prompt; every non-clarification
   mode; the post-check; the verify prompt; `quoteTermsOff`; the COI and payment lines.
3. **How will we know it worked?** EARS below; plus the same 18-run measurement re-run, with the failure count and the
   drafts scanned for any dollar figure or currency-word number (Execution Path).
4. **Most likely way this plan is wrong?** With the word ban gone, the model states a price with no figure and no
   currency word ("my rate for that is on the higher end", "around fifteen hundred"), and nothing stops it. The prompt's
   hard constraint remains, the 18-run re-run scans for spelled-out amounts, and the post-check for quoted modes is
   not involved. If the re-run finds one, the plan returns to Alex before building.
5. **How will a human RUN this, and when?** Claude Code, on Alex's MacBook, the scratch runner that produced the
   measurement (it wraps the real model call to log every generate response; no repo code), after the code step,
   before the Codex code review. Prerequisites, CHECKED 2026-10-12: `ANTHROPIC_API_KEY` in `.env`, Node, `tsx`.
   Alex reads the result in `docs/reviews/2026-10-13-clarification-failure-rerun.md`.

## Acceptance Tests (EARS)

Names start `Clarification V<n>` so `npm run test:match -- "Clarification V3"` runs one.

- **V1** WHEN a clarification-mode draft contains "Before I quote, one question" (and exactly one question mark),
  THE SYSTEM SHALL return the drafts and not throw.
- **V2** WHEN a clarification-mode draft contains the bare word "rate" or "quote" in any of these shapes: "Before I
  quote", "the quote", "I'll send a rate", "quote it", THE SYSTEM SHALL not throw (one test, listed shapes).
- **V3** WHEN a clarification-mode draft contains `$1200`, `$ 850`, or `$1,200`, THE SYSTEM SHALL throw
  `must not include pricing language` (the existing test stays and passes unchanged).
- **V4** WHEN a draft contains `anchor`, `floor`, or `investment`, THE SYSTEM SHALL throw (one case each).
- **V5** WHEN a draft contains "800 dollars", "1,500 bucks", "950 USD" or "USD 900", THE SYSTEM SHALL throw.
- **V6** WHEN a draft names a guest count or a duration ("100 guests", "2 hours"), THE SYSTEM SHALL not throw
  (the false-reject guard).
- **V7** WHEN the validator throws for pricing language, THE SYSTEM SHALL include the matched text in the error
  message, after the existing prefix.
- **V8** THE SYSTEM SHALL keep every non-clarification mode unchanged: the validator runs only for
  `action === "one_question"` with `format_recommended === "unresolved"` (a quoted draft containing "quote" and a
  `$` figure still returns).
- **V9** THE SYSTEM SHALL keep the "exactly one question" rule: a draft with two question marks still throws
  `must contain exactly one question`.

**Mutation map.** Each mutation is applied by a scratch script and the named test run with
`npm run test:match -- "<name>"`, expected exit 1 (3 would mean the name matched nothing):

| Test | Mutation that must fail it |
|---|---|
| V1, V2 | the pattern gets `\bquote\b` and `\brate\b` back |
| V3 | the `\$\s?\d` alternative removed |
| V4 | `\banchor\b`, `\bfloor\b`, `\binvestment\b` each removed in turn |
| V5 | the currency-word alternative removed |
| V6 | the currency-word alternative loosened to any 3-digit number |
| V7 | the matched text left out of the message |
| V8 | `enforceClarificationDraft` called for every mode |
| V9 | the question-mark check removed |

## Work steps (one concern per commit; failing test first)

1. Tests V1-V9 first; confirm V1, V2, V5, V6, V7 fail on the current code and V3, V4, V8, V9 pass.
2. The pattern and the message in `src/pipeline/generate.ts`.
3. The mutation map, run and recorded; full suite, `tsc`, leak check.
4. The 18-run re-run (Execution Path) and its record.

## Execution Path

- **Target:** Alex's MacBook, `runPipeline` through the scratch runner, real model, scratch `DATABASE_PATH` per
  process (nothing sent; `data/leads.db` untouched; the clipboard is not touched).
- **Mechanism:** the same runner as the measurement (3 processes x 6 vague leads, today pinned 2026-10-12): it wraps
  the real model call to log every generate response, then records, per run, whether a draft came back and scans every
  draft for a `$` figure, a currency-word number, the internal terms, and the words "price", "cost", "per hour".
- **Prerequisites (each CHECKED 2026-10-12/13):** Node, `npm`, `tsx` (the measurement used them);
  `ANTHROPIC_API_KEY` in `.env`; the scratch runner (a file in the session scratchpad; rewritten from this plan if
  the scratchpad is gone, it is about 60 lines: wrap `setClaudeRequesterForTests` around an Anthropic client and log
  each generate response). No PF-Intel, no private venue file, no `jq`.
- **Who:** Claude Code. **Trigger:** after step 3, before the Codex code review.
- **Expected (hypothesis until run):** 0 to 2 of 18 runs end in `GenerationError`; no draft holds a figure.

## Feed-Forward

- **Hardest decision:** loosening a safety check. The check's invariant is "no price is stated", not "no price
  vocabulary", and the measurement shows the vocabulary rule cost 17 of 18 drafts.
- **Rejected:** removing the check; a prompt-only fix; a retry loop; a proximity rule.
- **Least confident:** that no soft price statement without a figure ("on the higher end", "around fifteen hundred")
  slips through now that the words are allowed. The re-run scans for it; 18 runs cannot rule it out.

## Three Questions

1. **Hardest decision in this session?** Whether to relax a validator at all, versus fixing the prompt.
2. **What did you reject, and why?** A retry loop and a proximity rule (see D4).
3. **Least confident about going into the next phase?** The soft price statement with no figure.
