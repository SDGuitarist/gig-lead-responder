---
title: "Tier B venues: the app decides when the venue rules disagree, and holds with both prices"
type: fix
date: 2026-10-12
status: plan (awaiting Codex plan review)
---

# Tier B venues: when the venue rules disagree, hold with both prices

### Prior Phase Risk

No brainstorm (skip gate: a measured defect with exact files; Alex chose the behavior in chat). Nearest prior phase:
the PF-Intel cycle's solution doc, "What this does NOT fix" / END-TO-END-STATUS known risks: "Same lead, different
price ... the model's `stealth_premium` call flipped ... 50 sits exactly on the '50+' edge." This plan addresses it.

## Problem (measured 2026-10-11)

One made-up lead (Tom Ham's Lighthouse, 50 guests, Sunday, 40th anniversary dinner, 3h solo) ran 7 times: 5 at T2
$895, 2 at T3 $1,200 (`docs/reviews/2026-10-11-venue-history-local-runs.md`). The T3 runs gave "Tier B venue with 50
guests, meets the 50+ waterfront private buyout signal".

**Root cause:** two of Alex's rules, both ported from his Venue Intelligence file, disagree and nothing says which
wins (`src/prompts/classify.ts` Step 2.75):
- R079 Tier B: "Tom Ham's Lighthouse ... premium only with another signal: 100+ guests, corporate, Saturday evening".
- R097 context-dependent: "waterfront restaurant private buyout (50+)".

The model judges both from prose every run, so the tier is a coin flip at the edge. No past quote settles it (Gmail
both accounts and calendar checked 2026-10-12; platform threads not visible).

## Decision (Alex, 2026-10-12)

**Hold edge cases for Alex with both rate-card prices.** Claude Code recommended it: neither rule is backed by Alex's
own results, every lead is already held for approval, and the held choices become the data a later rule can follow.
No price is invented and no price is changed: both prices are existing rate-card cells.

1. **D1, Tier B as data** (`src/data/venues.ts`, `TIER_B_VENUES`, like `TIER_A_VENUES`): name, pattern, the venue's
   own premium conditions, and the generic rule that can also reach it. The classify prompt prints the Tier B list from
   this data (same words as today), so there is one list.

   | Venue | Own rule: premium when | Generic rule that also reaches it |
   |---|---|---|
   | Coasterra | guests >= 100, or corporate, or Saturday evening | waterfront restaurant, guests >= 50 |
   | Tom Ham's Lighthouse | guests >= 100, or corporate, or Saturday evening | waterfront restaurant, guests >= 50 |
   | Marina Village | corporate, or guests >= 75 | none |
   | Brick | corporate evening with guests >= 100 ("large corporate evening") | none |
   | Scripps Seaside Forum, Martin Johnson House | always ("premium for any booking") | none |

   "Saturday evening" = `event_date_iso` is a Saturday (computed by the app, Pacific calendar day) and the start hour
   is 17 or later. "Corporate" = `event_arc === "corporate"`.
2. **D2, two extracted facts** on `Classification`: `guest_count: number | null` (the number the lead states; a range
   takes its upper bound; "about 50" is 50; none stated is null) and `event_start_hour: number | null` (0-23, Pacific,
   from the lead's start time; none stated is null). Extraction, not judgment: the classify prompt asks for the number
   as written; `classify.ts` validation accepts only integers in range or null.
3. **D3, the app's check** (`tierBHold(classification, rawText, pricing)` in `src/pipeline/price.ts`, beside
   `t4FallbackHold`, called in `runPipeline` right after `t4FallbackHold`, run-pipeline.ts:219). The edit path
   (`runEditPipeline`) re-runs no price or hold check: it reuses the stored pricing and the stored classification,
   whose `flagged_concerns` already carry the note (`post-pipeline.ts:20` and `orchestrator.ts:221` store the
   enriched classification). No edit-path change. For a lead whose venue matches a Tier B pattern, and not a nonprofit buyer:
   - own rule **met** (computable from the facts) and the lead is priced below T3 → hold: "Tier B <venue>: its own rule
     says premium (<which condition>); priced <tier> $<x>; T3 is $<y>".
   - own rule **not met** and a generic rule **can** reach it (guests >= its threshold) → hold with both prices:
     "Tier B <venue>: own rule says standard (T2 $<a>); <generic rule> says premium (T3 $<b>); pick one".
   - a needed fact is **null** (guests or start hour unknown, so the own rule cannot be decided) → hold: "Tier B
     <venue>: <fact> not stated; T2 $<a> / T3 $<b>".
   - otherwise no hold. The draft keeps the price the pipeline chose; **the app never changes the tier**. Both prices
     come from `lookupPrice` with the tier set to T2 and T3 (same format, duration, column).
   The hold is a `flagged_concerns` note (the same mechanism as `t4FallbackHold`), never shown to the drafter.

Rejected: the app overriding the tier (Alex did not pick a default price; "under- or over-pricing either way");
prompt-only precedence (the model can still flip); adding a "buyout" fact (the lead rarely says it; guests >= 50 is
the computable part of R097, and the hold lets Alex judge "buyout").

## Plan Quality Gate

### 1. What exactly is changing?
`src/data/venues.ts` (`TIER_B_VENUES`); `src/prompts/classify.ts` (Tier B line printed from data; two new output
fields with extraction wording); `src/pipeline/classify.ts` (validate the two fields); `src/types.ts` (two optional
fields); `src/pipeline/price.ts` (`tierBHold`); `src/run-pipeline.ts` (call it in `runPipeline`); tests.

### 2. What must not change?
Every rate-card number; `lookupPrice`'s tier choice; Tier A behavior; the context-dependent rules for venues not in
`TIER_B_VENUES` (rooftop, golf, brewery, other waterfront restaurants: still the model's judgment); nonprofit handling
(a nonprofit buyer is never held by this check: the NP track holds it already); payment terms; the post-check; `.env`;
`~/Data`. The Tier B prompt words stay byte-identical except that they are generated from data.

### 3. How will we know it worked?
EARS below (each test mutation-checked), suite + tsc green, leak check exit 0, and real-model runs (Execution Path):
the Tom Ham's lead held with both prices on every run whatever tier the model picks.

### 4. What is the most likely way this plan is wrong?
**Extraction misses:** the model leaves `guest_count` null or misreads "50-60 guests", so leads are held for a missing
fact more often than expected (noise for Alex) or not held when they should be. Measured in the runs: guest count and
start hour recorded for every lead. Second: a venue named differently ("Tom Hams", "Coasterra Harbor Island") missing
the pattern; the patterns are tested against spellings seen in today's runs.

### 5. How will a human RUN this, and when?
See `## Execution Path` below.

## Acceptance Tests (EARS)

- **B1** WHEN the classify prompt is built, THE SYSTEM SHALL print the Tier B line from `TIER_B_VENUES`, byte-identical
  to today's line (pinned).
- **B2** WHEN the classifier returns `guest_count` or `event_start_hour` outside the allowed shape (non-integer, < 0,
  hour > 23, a string), THE SYSTEM SHALL treat it as null; a valid integer passes through.
- **B3** WHEN a non-nonprofit lead names Tom Ham's Lighthouse with guests 50, a Sunday, start hour 17, not corporate,
  THE SYSTEM SHALL add one hold note naming both prices (T2 and T3 from `lookupPrice`), whether the classification is T2
  or T3, and SHALL NOT change `rate_card_tier` or the quoted price.
- **B4** WHEN the same lead has guests 49 (under both thresholds), THE SYSTEM SHALL add no Tier B note.
- **B5** WHEN guests 100, or `event_arc` corporate, or a Saturday with start hour 17 (each alone), and the lead is
  priced T2, THE SYSTEM SHALL hold ("own rule says premium"); priced T3, no note.
- **B6** WHEN a Saturday with start hour 12, guests 40, THE SYSTEM SHALL add no note (Saturday but not evening).
- **B7** WHEN guests or start hour is null and the own rule cannot be decided without it, THE SYSTEM SHALL hold with
  both prices; WHEN it can be decided anyway (corporate, or guests >= 100), THE SYSTEM SHALL NOT hold for the null.
- **B8** WHEN the lead is a nonprofit buyer, or names no Tier B venue, THE SYSTEM SHALL add no Tier B note.
- **B9** WHEN Scripps Seaside Forum is priced T2, THE SYSTEM SHALL hold; Marina Village guests 75 priced T2 SHALL hold,
  guests 74 not corporate SHALL NOT.
- **B10** WHEN `runPipeline` returns for a held Tier B lead, THE SYSTEM SHALL include the note in the returned
  classification's `flagged_concerns` (the object the intake stores, so an edit keeps it).
- **B11 (real model)** WHEN the Tom Ham's anniversary lead (pv3 text) runs 5 times, THE SYSTEM SHALL hold all 5 with
  both prices ($895 and $1,200) and record `guest_count` 50 every time; AND a Tom Ham's lead with 120 guests on a
  Saturday at 6 PM runs twice and is priced T3 without a Tier B note (positive control).

## Work steps (one concern per commit; failing test first; mutation-check each test)

1. `TIER_B_VENUES` + prompt line from data (B1). Mutation: drop a venue (pin fails).
2. Two fields: types, classify prompt wording, validation (B2). Mutation: accept a string (fails).
3. `tierBHold` + wiring, both paths (B3-B10). Mutations: change the tier (B3 fails); `>` for `>=` at 50 (B3 fails);
   ignore the hour (B6 fails); hold on null when decidable (B7 fails); skip the nonprofit guard (B8 fails); add the
   note to a copy instead of the returned classification (B10 fails).
4. Real-model runs B11; record guest counts, start hours, tiers, notes.
5. Codex code review (both runs).

## Execution Path

- **Target:** Alex's MacBook, this repo, the CLI against the real model (PF-Intel lookups are live reads).
- **Mechanism:** `DATABASE_PATH=<scratchpad>/tbN.db npx tsx src/index.ts --json < tbN.txt`; scratch DB per run;
  nothing is sent; it overwrites the clipboard.
- **Prerequisites:** Anthropic key in `.env`: ALREADY HAVE. Suite + tsc green after the work steps: MUST OBTAIN
  (produced by the work).
- **Who:** Claude Code runs and records; Alex reads the hold notes.
- **Trigger:** after the last code step commits, before the Codex code-review prompt.

Stop and report to Alex if any B11 run is not held, or the positive control is held.

## Verification Commands (expected results)

- `npx tsx --test src/tier-b-hold.test.ts` → all pass
- `npm test` → 0 fail
- `npx tsc --noEmit` → exit 0
- `npx tsx scripts/check-venue-history.ts; echo $?` → 0

## Codex review

Plan review: 2 runs (Claude's run A, Alex's run B); stricter verdict wins; a 2nd NO-GO stops automatic iteration;
round 3 needs Alex's YES; a 3rd NO-GO is the hard cap.

## Feed-Forward

- **Hardest decision:** the app holds but never sets the tier. Alex did not pick a default; holding is the one
  behavior that is right under both rules.
- **Rejected:** app override of the tier; prompt-only precedence; a "buyout" fact.
- **Least confident:** extraction of guest count and start hour (ranges, "around", missing times).

## Three Questions

1. **Hardest decision in this session?** Hold versus decide. Alex asked for a recommendation; hold was the only option
   that does not guess at money.
2. **What did you reject, and why?** Overriding the tier (a price decision Alex has not made); prompt-only wording (the
   flip remains).
3. **Least confident about going into the next phase?** Whether "Saturday evening" at hour >= 17 matches Alex's
   meaning; the plan review should check it against the source rule.
