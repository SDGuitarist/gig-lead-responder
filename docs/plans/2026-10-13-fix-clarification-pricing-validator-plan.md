---
title: "fix: clarification-mode drafts are rejected for the words 'quote' and 'rate', not for prices"
date: 2026-10-13
status: plan, Revision 1 (Codex plan review round 1 NO-GO, 3 P1 / 3 P2, answered in place below; before round 2)
branch: feat/hub-phase0
---

# Clarification validator: reject a stated amount, not the words "quote" and "rate"

### Prior Phase Risk

No brainstorm: skip gate, the input is a measured defect with a record and a stated direction from Alex (2026-10-13:
"1 yes", narrow the validator, leave the prompt alone). The measurement's own limit, quoted from
`docs/reviews/2026-10-13-clarification-failure-measurement.md`: "made-up leads, one model, 18 runs; whether the real
inbox sees mostly vague leads is not known". This plan accepts it: the fix is small, and the same 18-run measurement
(now a committed script) is re-run for a before and after. That re-run is **observational evidence**, never proof
that the validator catches every price.

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
that will follow. The validator rejects the word; it should reject a stated amount.

## What is true today (read 2026-10-13)

- The pattern is used in exactly one place: `enforceClarificationDraft` (`src/pipeline/generate.ts:140-149`),
  called only when `action === "one_question"` and `format_recommended === "unresolved"` (`:127-130`), on both drafts
  (Codex round 1 confirmed both by grep).
- The throw is a `GenerationError`; there is no retry of the generate call for it. The API and dashboard replace the
  exception with a generic client error (`src/api.ts` ~315-338); the message reaches server logs only.
- One test pins it: `src/enrich-generate.test.ts` (~line 300-311), a draft with "My rate starts at $1200", expecting
  `/must not include pricing language/`.
- The "exactly one question" check is separate and was not the cause in any of the 18 runs.
- `postCheckDrafts` does not enforce "no price in a clarification draft": its price checks need a quoted `pricing`
  and catch only certain dollar-based phrases. So the validator is the only deterministic guard in this mode.

## The invariant, stated exactly (answers Codex P1-1 and P1-2)

**This validator guarantees one thing: a clarification draft states no AMOUNT and no internal pricing term.**

| Class | Rejected | Examples |
|---|---|---|
| Dollar figure | yes | `$1200`, `$ 850`, `$1,200`, `$1.2k` |
| Digits next to a currency word | yes | `1,500 bucks`, `950 USD`, `USD 900`, `800 dollars` |
| Spelled-out amount next to a currency word | yes | `a thousand dollars`, `one thousand dollars`, `fifteen hundred dollars` |
| A "k" amount | yes | `1.5k`, `2k` |
| Internal pricing terms (unchanged) | yes | `anchor`, `floor`, `investment` |
| Vocabulary: `quote`, `rate`, `price`, `cost`, `per hour`, `starts at`, `package` | **no, by decision** | "Before I quote", "a rate", "my rate is high", "a package for the evening" |
| An amount with no currency marker | **no, a documented limit** | "around fifteen hundred", "starts low" |

The last two rows are outside the invariant on purpose: rejecting vocabulary is exactly what failed 17 of 18 drafts,
and a rule that rejects "fifteen hundred" cannot tell a price from "a hundred guests". The prompt's HARD CONSTRAINT
still tells the model not to state a price, rate, anchor, floor or package, and **nothing deterministic enforces the
vocabulary rows**. The tests pin this boundary (V10) so a later change to it is deliberate, not accidental.

Known and left alone (pre-existing, not measured to occur): `floor` and `anchor` are ordinary words ("the dance
floor"); the validator has always rejected them. 0 of 21 logged generate calls held one. Not changed here.

## Decision

- **D1 The validator:** replace `PRICE_SIGNAL_PATTERN` with `PRICE_STATEMENT_PATTERN`, these alternatives, case-
  insensitive:
  1. `\$\s?\d`
  2. `\b\d[\d,]*(?:\.\d+)?\s?(?:dollars?|bucks|usd)\b`
  3. `\busd\s?\d`
  4. a run of number words followed by `dollars` or `bucks`:
     `\b<NUM>(?:[\s-]+<NUM>)*\s+(?:dollars?|bucks)\b`, where `<NUM>` is one of a, an, one ... twenty, thirty ...
     ninety, hundred, thousand, grand
  5. `\b\d+(?:\.\d+)?\s?k\b`
  6. `\banchor\b|\bfloor\b|\binvestment\b`
  The bare words `quote` and `rate` are no longer rejected on their own. (Checked 2026-10-13 against a reject list of
  17 forms and a pass list of 15: 0 missed, 0 false rejects.)
- **D2 The error names the match, and only the match:** `Clarification mode <field> must not include pricing
  language: "<the regex match>"`. The matched text only (for example `$1200`, `800 dollars`), never the draft or a
  sentence of it. The existing prefix is unchanged, so the existing test still matches. The message goes to server
  logs and to nothing a client sees (`src/api.ts` replaces it). A test pins the exact shape.
- **D3 The prompt is not changed** (Alex 2026-10-13). "No quote yet" stays.
- **D4 The rerun runner is committed:** `scripts/clarification-measure.ts` (this revision's commit). It replaces the
  scratchpad runner; its scan is broader than the validator and is observational.
- **D5 Rejected:** removing the check; a prompt-only fix; a retry loop that feeds the rejection back (adds a model
  call per failure at an 81% failure rate); a proximity rule such as "quote near a 3-digit number" (a guest count
  would be a false reject); rejecting number words alone (cannot tell "a hundred guests" from a price); narrowing
  `floor` and `anchor` to their pricing sense (a separate decision, not measured as a problem).

## Plan Quality Gate

1. **What exactly is changing?** One regex constant and the throw message in `src/pipeline/generate.ts`; tests in a
   new `src/clarification-validator.test.ts`; the committed runner `scripts/clarification-measure.ts`.
2. **What must not change?** The "exactly one question" rule; the clarification prompt; every non-clarification
   mode; the post-check; the verify prompt; `quoteTermsOff`; the COI and payment lines; the existing test at
   `src/enrich-generate.test.ts` (it must still pass unchanged).
3. **How will we know it worked?** EARS below, with a mutation per test; plus the 18-run re-run through the
   committed runner: the count of runs with no draft, and every draft scanned for the stated classes and, separately,
   for the allowed vocabulary. The re-run is **observational**: it shows what the model wrote on 18 runs; it does not
   prove recall.
4. **Most likely way this plan is wrong?** With the vocabulary allowed, the model states a price the grammar does not
   recognise: "around fifteen hundred", "my rate is on the higher end", "starts low". Those are outside the invariant
   by decision (table above). The re-run counts them (`rate_word`, `price_word`, `starts_word`, `package_word`) so
   Alex can see how often the model uses the allowed vocabulary; if it states an unmarked amount, the plan returns to
   Alex before building further.
5. **How will a human RUN this, and when?** Claude Code (or Alex) on the MacBook, after the code step and before the
   Codex code review, with the exact command in the Execution Path. Alex reads
   `docs/reviews/2026-10-13-clarification-failure-rerun.md`.

## Acceptance Tests (EARS)

Names start `Clarification V<n>` so `npm run test:match -- "Clarification V3"` runs one. File:
`src/clarification-validator.test.ts`; each test calls `generateResponse` with a stubbed model (as the existing test
does) and a clarification classification.

- **V1** WHEN a clarification-mode draft contains "Before I quote, one question" (and exactly one question mark),
  THE SYSTEM SHALL return the drafts and not throw.
- **V2** WHEN a draft contains the bare words in these shapes: "the quote", "I'll send a rate", "quote it", "my rate
  is high", "a package for the evening", THE SYSTEM SHALL not throw.
- **V3** WHEN a draft contains `$1200`, `$ 850`, or `$1,200`, THE SYSTEM SHALL throw `must not include pricing
  language`. The existing test stays and passes unchanged.
- **V4a / V4b / V4c** WHEN a draft contains `anchor` (V4a), `floor` (V4b), or `investment` (V4c), THE SYSTEM SHALL
  throw. Three separate tests, one term each.
- **V5** WHEN a draft contains "800 dollars", "1,500 bucks", "950 USD" or "USD 900", THE SYSTEM SHALL throw.
- **V5b** WHEN a draft contains "a thousand dollars", "one thousand dollars" or "fifteen hundred dollars", THE SYSTEM
  SHALL throw.
- **V5c** WHEN a draft contains "1.5k" or "2k", THE SYSTEM SHALL throw.
- **V6** WHEN a draft names a guest count, a duration or a year ("100 guests", "2 hours", "2026", "1 to 2 hours",
  "a hundred guests"), THE SYSTEM SHALL not throw (the false-reject guard).
- **V7** WHEN the validator throws for pricing language, THE SYSTEM SHALL produce exactly
  `Clarification mode full_draft must not include pricing language: "<match>"`, with `<match>` the matched text
  (asserted for `$1200` and for `800 dollars`, for both `full_draft` and `compressed_draft`), and the message SHALL
  NOT contain the rest of the draft (its length is bounded by the field name plus the match).
- **V8** THE SYSTEM SHALL keep every non-clarification mode unchanged: the validator runs only for
  `action === "one_question"` with `format_recommended === "unresolved"` (a quoted draft containing "quote" and a
  `$` figure still returns).
- **V9** THE SYSTEM SHALL keep the "exactly one question" rule: a draft with two question marks still throws
  `must contain exactly one question`.
- **V10** (the documented boundary) WHEN a draft contains "around fifteen hundred", "starts low", or "my rate is on
  the higher end", THE SYSTEM SHALL not throw. This pins the limit so changing it is a deliberate edit.

**Mutation map.** Each mutation is applied by a scratch script and the named test run with
`npm run test:match -- "<name>"`, expected exit 1 (3 would mean the name matched nothing, a test defect):

| Test | Mutation that must fail it |
|---|---|
| V1, V2 | the pattern gets `\bquote\b` and `\brate\b` back |
| V3 | alternative 1 (`\$\s?\d`) removed |
| V4a | `\banchor\b` removed from alternative 6 |
| V4b | `\bfloor\b` removed |
| V4c | `\binvestment\b` removed |
| V5 | alternative 2 removed (and, separately, alternative 3) |
| V5b | alternative 4 removed |
| V5c | alternative 5 removed |
| V6 | alternative 2 loosened to any run of 3 or more digits |
| V7 | the matched text left out of the message; and the whole draft appended to it |
| V8 | `enforceClarificationDraft` called for every mode |
| V9 | the question-mark check removed |
| V10 | `hundred` alone, or `starts`, added as a rejected word |

## Work steps (one concern per commit; failing test first)

1. Tests V1-V10 first; confirm V1, V2, V5b, V5c, V7 fail on the current code and V3, V4a-c, V5, V6, V8, V9, V10
   behave as listed (V10 and V6 pass on the current code except where the old words appear).
2. The pattern and the message in `src/pipeline/generate.ts`.
3. The mutation map, run and recorded; full suite, `tsc`, leak check.
4. The 18-run re-run (Execution Path) and `docs/reviews/2026-10-13-clarification-failure-rerun.md`.

## Execution Path

- **Target:** Alex's MacBook, the real pipeline through `scripts/clarification-measure.ts`, real model, a scratch
  `DATABASE_PATH` under `--out` (nothing sent; `data/leads.db` untouched; the clipboard is not touched).
- **Mechanism:** `scripts/clarification-measure.ts` wraps the real model call to log every generate response (the
  pipeline throws a rejected draft away), runs `runPipeline` for each made-up vague lead, and scans each draft for the
  stated classes and, separately, the allowed vocabulary. It edits no app code and sends nothing.
- **Command (exact):** from the repo root, three processes in parallel so 18 runs take about 6 minutes:
  `for i in 1 2 3; do npx tsx scripts/clarification-measure.ts --runs 1 --tag after-$i --out /tmp/clar-after & done; wait`
  Each process runs all 6 leads once. (Sequential single process: `npx tsx scripts/clarification-measure.ts --runs 3
  --tag after --out /tmp/clar-after`, about 15-20 minutes.) The baseline numbers are the 2026-10-13 record above; to
  re-measure the old code, run the same command from `72490b7` in a worktree.
- **Prerequisites (CHECKED 2026-10-13):** Node, `npm`, `tsx`; `ANTHROPIC_API_KEY` in `.env` (the script exits 2 if
  it is missing); network access. No PF-Intel, no private venue file, no other tool. The script was smoke-run once
  (1 lead, 1 run) on 2026-10-13.
- **Output:** `<out>/clarification-<tag>.json` and a summary table on stdout: `runs_with_no_draft`,
  `generate_calls`, `calls_with_a_stated_amount_or_internal_term`, and the counts by class for the stated classes
  and, separately, the allowed vocabulary classes.
- **Who:** Claude Code or Alex. **Trigger:** after step 3, before the Codex code review.
- **Expected (a hypothesis until run):** 0 to 2 of 18 runs end in `GenerationError`; no draft holds a stated amount.
  What this does NOT show: that no price-like text exists the grammar misses; it is 18 runs of one model on made-up
  leads.

## Feed-Forward

- **Hardest decision:** loosening a safety check, and saying plainly what it then does not guarantee. The invariant is
  "no stated amount", not "no price vocabulary"; the measurement shows the vocabulary rule cost 17 of 18 drafts.
- **Rejected:** removing the check; a prompt-only fix; a retry loop; a proximity rule; rejecting number words alone.
- **Least confident:** an unmarked amount ("around fifteen hundred") or a soft statement ("on the higher end") now
  passes. The re-run counts the vocabulary so it is visible, but 18 runs cannot rule it out and nothing
  deterministic stops it.

## Three Questions

1. **Hardest decision in this session?** What the validator may honestly claim to guarantee after loosening it.
2. **What did you reject, and why?** A retry loop, a proximity rule, and number words alone (see D5).
3. **Least confident about going into the next phase?** The unmarked amount that passes.
