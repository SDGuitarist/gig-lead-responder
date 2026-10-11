---
title: "Payment terms by lead time: the right deposit or full-payment sentence in every quote"
date: 2026-10-11
status: plan, Revision 0 (before Codex plan review)
branch: feat/hub-phase0
---

# Payment terms by lead time

### Prior Phase Risk

> "Copying: a T4 draft that reuses the example's sentences, or claims a venue space from it, at a venue Alex has not
> played." (`docs/plans/2026-10-11-feat-t4-reference-lead-plan.md`, Three Questions 3)

That plan is paused behind this one (Alex: "payment terms first"). Its example says "A 50% deposit holds the date."
for an event 6 days out, which this plan makes wrong; the T4 plan's revision changes that sentence to match before it
ships. No brainstorm (skip gate: Alex gave the rule and the exact words in chat).

## Problem

`src/prompts/generate.ts:270` tells every quote "A 50% deposit holds the date." Alex's terms
(`~/.claude/docs/contract-and-payment-process.md`, corrected 2026-10-11) depend on lead time: more than 2 months out,
balance due 2 months before; more than 2 weeks up to 2 months, balance due 2 weeks before; 2 weeks or less, full
amount upfront. So every lead 2 weeks or less out is quoted the wrong terms today, and no reply states a due date.

## Alex's decisions (2026-10-11, in chat; exact words)

| Lead time on the day the reply is drafted | Sentence (exact) |
|---|---|
| more than 2 months | `A 50% deposit holds the date, and the balance is due two months before the event.` |
| more than 2 weeks, up to and including 2 months | `A 50% deposit holds the date, and the balance is due two weeks before the event.` |
| 2 weeks or less (14 days or fewer) | `Full payment holds the date.` |
| no event date | `A 50% deposit holds the date.` |

Edges fall in the shorter band (his rule): exactly 2 months out → the 2-weeks sentence; exactly 14 days → full
payment. **Platform leads (GigSalad, The Bash, any `lead_source_column === "P"`) get NO payment sentence** (Alex,
correcting an earlier answer the same day: the client pays the platform everything upfront and the platform pays
Alex in installments, so any deposit or balance wording is wrong there; today's line is wrong for them too).
Order: this plan first, then the T4 plan.

## Decision

- **D1 The app picks the sentence, deterministically.** New `src/pipeline/payment-terms.ts`:
  `paymentSentence(eventDateIso: string | null, todayIso: string, platformLead: boolean): string | null`. Rules:
  - a platform lead (`lead_source_column === "P"`) → `null` (no sentence), whatever the date;
  - no date, an unparsable date, or a date before today → the no-date sentence (a past date is already flagged by
    `past_date_detected` and the draft asks to confirm the year; no band can be right);
  - days = calendar days from today to the event (both via `parseLocalDate`, Pacific; `getTodayISO`);
  - `days <= 14` → full payment;
  - else if the event is on or before today + 2 calendar months (same day-of-month; a month without that day clamps
    to its last day, e.g. Dec 31 + 2 months = Feb 28/29) → two weeks;
  - else → two months.
- **D2 Computed at prompt-build time, not stored.** `buildGeneratePrompt` gains an optional last parameter
  `today = getTodayISO()` and calls `paymentSentence(classification.event_date_iso, today, classification.lead_source_column === "P")`. It is the one builder both
  `runPipeline` and `runEditPipeline` reach (via `generateResponse`), so an SMS edit days later re-computes from the
  current date (a lead that was 3 weeks out on arrival and 10 days out at the edit gets "Full payment").
  `classification` is not changed (a stored band would go stale; the FC45 lesson about stored classifications).
- **D3 Prompt.** Line 270 becomes: `- Payment: write this sentence exactly, once, near the price, in both drafts:
  "<sentence>". Write no other sentence about a deposit, a balance or full payment.` For a platform lead (`null`)
  the line becomes: `- Payment: the platform handles payment. Say nothing about a deposit, a balance or payment.`
  Quote Terms keep their existing exclusions (clarification mode, no viable scope, residency: no payment line).
- **D4 Check (exact text the app knows; never inferred from prose).** `postCheckDrafts` gains option
  `paymentSentence?: string | null` (`undefined` = not a quote, no check). A string: for each draft the sentence
  occurs exactly once (after collapsing whitespace) and, outside it, no payment wording: `/\bdeposit\b/i`,
  `/\bfull payment\b/i`, or "balance" in a payment sense `/\bbalance\s+(?:is\s+)?due\b|\b(?:remaining|the)\s+balance\s+of\s+\$/i`
  (plain "balance" stays allowed: "I balance the sound" is musician prose, not a term). `null` (platform): none of those words anywhere. A failure adds violation
  `payment_terms_<full|compressed>: ...` (the same path as other post-check violations; the draft reaches Alex flagged,
  never auto-sent). The caller passes the same sentence the prompt used (one computation per run, passed down).
- **D5 Rejected:** the model choosing the band from `timeline_band` (that band is also set by urgency words and draws
  its line at "< 2 weeks", not "<= 14 days"); the app inserting the sentence after the price line (finding the price
  line in prose is the detector the price-block work retired; an exact-sentence check is enough here because the app
  knows the exact text); changing the contract, invoice or any price (none of this touches money amounts).

## Plan Quality Gate

### 1. What exactly is changing?
New `src/pipeline/payment-terms.ts` (+ test); `buildGeneratePrompt` (one parameter, one line); `postCheckDrafts`
(one option, one check) and its two callers in `src/run-pipeline.ts` (pass the sentence).

### 2. What must not change?
Prices, rates, `lookupPrice`, the price line, the NP2 price block and its check; the Quote Terms exclusions; every
other prompt line (verified by a golden snapshot, below); `data/leads.db`; any stored classification.

### 3. How will we know it worked?
EARS below; real-model runs (Execution Path) before the code review.

### 4. What is the most likely way this plan is wrong?
The model paraphrases ("a 50% deposit secures your date") or adds a second payment mention, so drafts get flagged
often. The check makes that visible (flagged, not sent); the runs measure how often. Second: the month arithmetic at
month ends.

### 5. How will a human RUN this, and when?
Claude Code, Alex's MacBook, after step 3 and before the code review (Execution Path).

## Acceptance Tests (EARS)

- **P1** WHEN the event is 0, 1, 13 or 14 days after today, THE SYSTEM SHALL return the full-payment sentence.
- **P2** WHEN the event is 15 days after today, or exactly 2 calendar months after today, THE SYSTEM SHALL return the
  two-weeks sentence.
- **P3** WHEN the event is 2 calendar months and 1 day after today, THE SYSTEM SHALL return the two-months sentence.
- **P4** WHEN today is 2026-12-31 and the event is 2027-02-28, THE SYSTEM SHALL return the two-weeks sentence; WHEN the
  event is 2027-03-01, the two-months sentence (month-end clamp).
- **P5** WHEN the event date is null, unparsable, or before today, THE SYSTEM SHALL return the no-date sentence.
- **P5b** WHEN the lead is a platform lead, THE SYSTEM SHALL return `null` for every date case in P1-P5, and the
  prompt SHALL carry the platform line instead of a sentence.
- **P6** WHEN `buildGeneratePrompt` builds a quote prompt, THE SYSTEM SHALL contain exactly one payment instruction with
  the sentence for the given `today`, and SHALL NOT contain "A 50% deposit holds the date. Say it plainly".
- **P7** WHEN the prompt is in clarification mode, no viable scope or residency, THE SYSTEM SHALL contain no payment
  sentence.
- **P8** THE SYSTEM SHALL leave every other prompt line unchanged: a golden prompt captured BEFORE this change (a
  committed fixture for 3 fixed leads: T2 platform, T3 direct, NP2) equals the new prompt with the payment line
  replaced by the old one. (Independent of the new code: the fixture is written at the parent commit.)
- **P9** WHEN a draft carries the sentence once and no other payment word, THE SYSTEM SHALL add no payment violation;
  WHEN the sentence is missing, changed by one word, doubled, or joined by "deposit" / "balance" / "full payment"
  elsewhere, THE SYSTEM SHALL add `payment_terms_<draft>`. WHEN a draft says "I balance the sound for the room", THE
  SYSTEM SHALL add no payment violation (overshoot control). WHEN `paymentSentence` is `null` and a draft says
  "deposit", "balance" or "full payment", THE SYSTEM SHALL add `payment_terms_<draft>`.
- **P10** WHEN `runEditPipeline` runs on a stored classification, THE SYSTEM SHALL pass a sentence computed from the
  current date (test with an injected `today`, two different dates, two different sentences).

Each test gets a named mutation (`<=` → `<` at 14 days; month clamp removed; past date banded; `today` ignored in
the edit path; check passes on a paraphrase; old line left in the prompt).

## Work steps (one concern per commit; failing test first; mutation-check each test)

0. Capture the golden prompts at the parent commit (P8 fixture) and commit them alone.
1. `payment-terms.ts` + tests (P1-P5).
2. Prompt line + `today` parameter (P6-P8).
3. Post-check option + callers (P9, P10).
4. Real-model runs, recorded in `docs/reviews/2026-10-11-payment-terms-local-runs.md`.

## Verification Commands (expected results)

- `npm test` → all pass; `npx tsc --noEmit` → clean.
- `git grep -n "50% deposit holds the date. Say it plainly" src` → no match.
- `npx tsx scripts/check-venue-history.ts` → PASS (no venue text involved; run because the repo is public).

## Execution Path

- **Target:** Alex's MacBook, CLI `src/index.ts --json`, real model, scratch `DATABASE_PATH` (nothing sent;
  `data/leads.db` untouched; the CLI overwrites the clipboard).
- **Mechanism:** 4 made-up leads, dated relative to the run day: (a) 6 days out, direct corporate; (b) 5 weeks out,
  GigSalad birthday (platform: expect NO payment wording); (c) 4 months out, direct wedding; (d) no date ("sometime next spring"). One run each.
- **Fail-closed sample rule:** the step passes only if all 4 produce quote drafts (not clarification) and 8 drafts are
  inspected; otherwise re-run that lead once, and if it still is not a quote, record "insufficient" and stop.
- **Checks per draft:** the expected sentence present exactly once; no other deposit/balance/full-payment wording;
  `violations` from post-check; the price line unchanged in shape.
- **Prerequisites:** model access for the CLI (ALREADY HAVE); `jq` (ALREADY HAVE). **Who:** Claude Code.
  **Trigger:** after step 3, before Codex code review round 1.

## Codex review

Plan review round 1 next (Claude Code's run and Alex's; stricter wins). Pre-registered stops: a 2nd NO-GO stops
automatic iteration; round 3 only with Alex's yes; a 3rd NO-GO is the hard cap.

## Feed-Forward

- **Hardest decision:** model-written exact sentence plus an exact check, versus the app inserting it. Inserting needs
  the price line's position in prose, which is the detector the price-block work retired.
- **Rejected alternatives:** `timeline_band` as the source (wrong edge, polluted by urgency words); storing the band
  on the classification (stale on edits); rewording the sentences (Alex's exact words).
- **Least confident:** how often the model paraphrases an exact sentence it is told to copy; each paraphrase is a
  flagged draft Alex must fix by hand.

## Three Questions

1. **Hardest decision in this session?** Who writes the sentence (above).
2. **What did you reject, and why?** D5.
3. **Least confident about going into the next phase?** Paraphrase rate, and month-end arithmetic.
