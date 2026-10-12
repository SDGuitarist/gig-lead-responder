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

## Revision 2 (after Codex PLAN round 2 = NO-GO on both runs, the 2nd NO-GO; `docs/reviews/2026-10-12-tier-b-plan-codex-round2.md`)

| # | Finding | Change |
|---|---|---|
| 1 | stale duplicate EARS / Work steps block (an edit-script bug: it matched "## Execution Path" inside Q5) | deleted; one B1-B13 set |
| 2 | prompt still described Brick | "Brick (rule not defined yet: Alex reviews)" |
| 3 | own-rule-met note showed only T3 | every `tier_b:` note names both prices |
| 4 | B11 asked for a return value that does not exist | asserts on the stored object passed in; return shape unchanged |
| 5 | Execution Path not runnable | fixtures committed in `docs/reviews/2026-10-12-tier-b-leads/`; exact commands |
| 6 | B2 mapping ambiguous | a table per field |
| 7 | venue-name vs raw-text precedence | `venue_name` when present; raw text only when null; negative test (B9) |
| 8 | impossible dates | strict `civilDay`; impossible = unknown; test (B5) |

## Revision 1 (after Codex PLAN round 1 = NO-GO on both runs; `docs/reviews/2026-10-12-tier-b-plan-codex-round1.md`)

**Alex's answers (2026-10-12), after Claude Code read his source file** (`~/Data/gig-lead-responder/Gig_Lead_Response_
System_4.0_Extraction.md`, "Tier B: Context-Dependent Premium", lines 1110-1122; text not copied beyond venue rules):
- The source's Tom Ham's rule is "Large party, sunset timing", **not** the 100+/corporate/Saturday rule the 10-03 port
  gave it (a port error). Alex first said "either alone", then the same day changed it: **Tom Ham's is premium only
  with BOTH 100+ guests AND a start at 5 PM or later** (his reason: "either" made almost every Tom Ham's evening event
  premium, moving most quotes there from $895 to $1,200).
- **"Saturday evening" means any Saturday** ("the busiest day of the week").
- Brick ("Large corporate, evening event") is not defined: **held until Alex defines it.**
- Under these rules the measured lead (Tom Ham's, 50 guests, starts 5 PM) is standard by Tom Ham's own rule, while
  the waterfront 50+ buyout rule may apply: it is **held with both prices** on every run. The flip had two causes: the
  wrong Tom Ham's rule in the prompt, and two rules judged from prose.

| # | Finding (runs) | Change |
|---|---|---|
| 1 | Saturday-evening cutoff; Brick undefined (A P1, B P1) | Alex's rules above; Brick always held |
| 2 | "private buyout" dropped (A P1) | buyout is never extracted: a waterfront lead with guests >= 50 whose own rule says standard is always held |
| 3 | prefix missing from `HOLD_NOTE_PREFIXES` (A P1, B P1) | `tier_b:` added; tests on generate, verify, edit |
| 4 | where Alex sees both prices (A P1) | dashboard lead detail "Concerns" row (`public/dashboard.html:1510`); SMS count only (a Module 1 item) |
| 5 | malformed values fail validation (B P1) | normalize first, then validate |
| 6 | extraction rules (A P2, B P2) | exact rules + fixtures (D2) |
| 7 | aliases (A P2, B P2) | enumerated patterns + tests (D1) |
| 8 | stealth_premium / Tier A relationship (A P2) | reads `rate_card_tier` only, writes nothing; Tier A test unchanged |
| 9 | edit path untested (A P2, B P2) | a real `runEditPipeline` test (B10) |
| 10 | tier family and candidate prices (A P2, B P2) | D3 definitions |
| 11 | coverage, literal pin, concrete run (A P3, B P3) | B1 literal; B9 every venue; Execution Path files listed |

## Decision (Alex, 2026-10-12)

**The app decides Tier B from plain facts, using Alex's rules; when a rule is undecidable or two rules disagree, the
lead is held with both rate-card prices.** No price is invented or changed; the app never writes `rate_card_tier`.

1. **D1, Tier B as data** (`src/data/venues.ts`, `TIER_B_VENUES`). The classify prompt prints its Tier B line from this
   data. Each entry: name, pattern, own rule, waterfront flag.

   | Venue | Pattern (case-insensitive) | Own rule: premium when | Waterfront (R097 applies) |
   |---|---|---|---|
   | Coasterra | `\bcoasterra\b` | guests >= 100, or corporate, or any Saturday | yes |
   | Tom Ham's Lighthouse | `\btom\s+ham['’]?s?\b` (Tom Ham's, Tom Hams, Tom Ham) | guests >= 100 **and** start hour >= 17 | yes |
   | Marina Village | `\bmarina village\b` | corporate, or guests >= 75 | no |
   | Brick | `venue_name` only, `^\s*brick\b` (the word is common in prose, so never the raw text) | undefined: always held | no |
   | Scripps Seaside Forum | `\bscripps (?:seaside )?forum\b` | always | no |
   | Martin Johnson House | `\bmartin johnson house\b` | always | no |

   Matching (Revision 2): when `classification.venue_name` is present, only it is matched; the raw lead text is matched
   only when `venue_name` is null (never for Brick). A lead whose venue is another place but whose prose mentions a Tier
   B venue ("we considered Tom Ham's") gets no Tier B note. "Corporate" = `event_arc === "corporate"`.
   "Saturday" = `event_date_iso` is a real calendar date (strict: `civilDay` in `payment-terms.ts`, so "2026-02-31" or
   "TBD" is not a date) falling on a Saturday; a missing or impossible date means "Saturday" is unknown. The literal new prompt line (B1):

   > `- Tier B venues (premium only with their own signal): Coasterra (100+ guests, corporate, or any Saturday), Tom Ham's Lighthouse (100+ guests and starting 5 PM or later), Marina Village (corporate or 75+), Brick (rule not defined yet: Alex reviews). Scripps Seaside Forum and Martin Johnson House are premium for any booking`

   Rejected: keeping the old line (it carries the mis-ported Tom Ham's rule the model was reading).
2. **D2, two extracted facts** (`Classification.guest_count?: number | null`, `event_start_hour?: number | null`).
   Prompt rules (the model writes a number, never prose):
   - guests: the number stated; "50+", "50 or more", "at least 50" → 50; "about/around/approximately 50" → 50;
     "50-60" / "50 to 60" → 60; "up to 60" → 60; "under 60" / "fewer than 60" → 59; none stated → null.
   - start hour (0-23, the lead's local time): "5-8 PM" → 17; "5:30 PM" → 17; "6pm" → 18; "17:00" → 17; "noon" → 12;
     "midnight" → 0; "evening" or "dinner" with no number → null; none stated → null.
   **Normalization before validation** (`classify.ts`): an integer in range passes (guests 1-5000, hour 0-23); a string
   of digits only is parsed ("50" → 50); anything else ("50+", 50.5, -3, 24, "evening", a missing key) becomes null. A
   bad value never fails classification. `event_date_iso` null, malformed or impossible
   (per `civilDay`) → "Saturday" is unknown.
3. **D3, the check** (`tierBHold(classification, rawText, pricing, travelData)` in `src/pipeline/price.ts`, called in
   `runPipeline` right after `t4FallbackHold`, run-pipeline.ts:219; the note goes into `enriched.flagged_concerns`).
   Tier family: premium = `rate_card_tier` T3 or T4; standard = T1 or T2 (the P/D column is separate and kept).
   Candidate prices: `lookupPrice({ ...classification, rate_card_tier: "T2" }, travelData).quote_price` and the same with
   "T3": same format, duration, column and travel treatment. Not applied to a nonprofit buyer (the NP track holds it)
   or a clarification lead (no rate table). Cases, first match wins:

   | Case | Note (prefix `tier_b:`) |
   |---|---|
   | Brick | "tier_b: Brick (rule not defined); T2 $a / T3 $b" |
   | own rule met (Scripps, Martin Johnson always) and priced standard | "tier_b: <venue> own rule says premium (<condition>); priced <tier>; T2 $a / T3 $b" |
   | own rule met and priced premium | none |
   | own rule undecidable (a needed fact null: guests, start hour, or date) | "tier_b: <venue> <fact> not stated; T2 $a / T3 $b" |
   | own rule not met, waterfront, guests >= 50 (R097, buyout never known) | "tier_b: <venue> own rule says standard; waterfront 50+ buyout rule may apply; T2 $a / T3 $b" |
   | own rule not met and priced premium | "tier_b: <venue> own rule says standard; priced premium (<stealth signals>); T2 $a / T3 $b" |
   | own rule not met, priced standard | none |

   "Undecidable" means the rule cannot be settled with the facts present: Tom Ham's with guests null and hour null or
   >= 17, or with guests >= 100 and hour null (a known guests < 100 or a known hour < 17 decides it: not met);
   Coasterra with no corporate, guests < 100 or null, and date null; Marina Village with no corporate and guests null.
   A rule already met or already failed by a known fact is decided (corporate Coasterra with no date: met). For a
   waterfront venue whose own rule is not met, guests null is also "not stated" (R097 cannot be settled) and holds.
   **`tier_b:` joins `HOLD_NOTE_PREFIXES`** (`src/types.ts`), so `withoutHoldNotes` strips it from the generate and
   verify prompts; `routeLead` holds any flagged concern; the dashboard shows it.

Rejected: app override of the tier (Alex picked no default); prompt-only precedence; a "buyout" fact (rarely stated).

## Plan Quality Gate

### 1. What exactly is changing?
`src/data/venues.ts` (`TIER_B_VENUES`); `src/prompts/classify.ts` (Tier B line from data, with Alex's corrected Tom
Ham's and Saturday rules; two output fields with extraction rules); `src/pipeline/classify.ts` (normalize, then
validate, the two fields); `src/types.ts` (two optional fields; `tier_b:` in `HOLD_NOTE_PREFIXES`);
`src/pipeline/price.ts` (`tierBHold`); `src/run-pipeline.ts` (one call in `runPipeline`); tests.

### 2. What must not change?
Every rate-card number; `lookupPrice`'s tier choice; Tier A and its verify check; the context-dependent rules for
venues not in `TIER_B_VENUES` (still the model's judgment); nonprofit handling; payment terms; the post-check;
`runEditPipeline` code (it reuses the stored classification, which already carries the note); `.env`; `~/Data`. The
stealth list's own "Saturday evening at named venue" line is out of scope (Alex answered for Tier B).

### 3. How will we know it worked?
EARS below (each mutation-checked), suite + tsc green, leak check exit 0, and the real-model runs: the measured Tom
Ham's lead is held with both prices on every run (its own rule says standard; the waterfront 50+ rule may apply);
leads whose rule is undecidable are held every run.

### 4. What is the most likely way this plan is wrong?
**Extraction misses** (guests or start hour null when the lead states them) hold leads Alex did not need to see. The
runs record both facts for every lead. Second: most Tom Ham's leads are 50-99 guests, so many will be held (waterfront 50+);
that is Alex's chosen trade (a hold over a guessed price), measured in the runs.

### 5. How will a human RUN this, and when?
See `## Execution Path` below.

## Acceptance Tests (EARS)

Unit tests use classifications built in the test (no model) and `lookupPrice` for the candidate prices.

- **B1** WHEN the classify prompt is built, THE SYSTEM SHALL contain the literal D1 Tier B line exactly once (pinned as
  a string in the test, not regenerated from data) and SHALL NOT contain the old line.
- **B2** Normalization (before validation; classification never fails for these). Each field tested on its own:

  | Raw value | `guest_count` | `event_start_hour` |
  |---|---|---|
  | 50 / 17 (integer in range) | 50 | 17 |
  | "50" / "17" (digits only) | 50 | 17 |
  | key missing | null | null |
  | null | null | null |
  | "50+" / "5pm" (other text) | null | null |
  | 50.5 / 17.5 (decimal) | null | null |
  | -3 / -1 (negative) | null | null |
  | 0 | null | 0 |
  | 5001 / 24 (out of range) | null | null |
  | "evening" | null | null |
- **B3** WHEN the prompt is built, THE SYSTEM SHALL contain the D2 extraction rules (pinned phrases: "50+", "5-8 PM",
  "noon", "under 60").
- **B4** Tom Ham's (both conditions needed): guests 120, hour 18, T3 → no note; T2 → "own rule says premium (100+ guests and
  starts 5 PM or later)", both prices; guests 50, hour 17, T2 or T3 → held, "waterfront 50+ buyout rule may apply", both prices;
  guests 120, hour 12, T2 → held (waterfront 50+); guests 40, hour 18, T2 → none; guests 40, hour 18, T3 → held
  (priced premium, own rule says standard); guests 49, hour 16, T2 → none; guests 120, hour null → held (start hour not
  stated); guests null, hour 18 → held (guests not stated); guests null, hour 12 → held (waterfront, guests not stated).
- **B5** Coasterra: Saturday, guests 30, T2 → held (any Saturday); Sunday, guests 30, corporate, T3 → none; Sunday,
  guests 30, T2 → none; date null, guests 30, not corporate, T2 → held (date not stated); date "2026-02-31" (impossible), guests 30,
  not corporate, T2 → held (date not stated); Sunday, guests 55, T2 → held
  (waterfront 50+).
- **B6** Marina Village: guests 75, T2 → held; guests 74, not corporate, T2 → none; corporate, guests null, T2 → held
  (own rule met); guests null, not corporate → held (guests not stated). Scripps Seaside Forum and "Scripps Forum",
  Martin Johnson House, priced T2 → held; priced T3 → none. Brick (venue_name "Brick") → held at any tier; the word
  "brick" in the lead text with another venue → no Tier B note.
- **B7** Priced premium against an own rule that says standard (Tom Ham's, guests 40, hour 12, T3) → held with both
  prices and the stealth signals named.
- **B8** Aliases. Match: "Tom Hams Lighthouse", "Tom Ham's", "Tom Ham’s" (curly), "TOM HAM'S LIGHTHOUSE", "Coasterra",
  "Scripps Forum", "Scripps Seaside Forum", "Marina Village", "Martin Johnson House". Miss: "Tom Hanks", "Scripps
  Ranch", "Coaster" and a lead text containing "brick" when `venue_name` is another venue.
- **B9** Not applied: `venue_name` "Example Harbor Grill" with lead text "we considered Tom Ham's" → no Tier B note; a
  nonprofit buyer at Tom Ham's; a clarification lead; a lead naming no Tier B venue; an unrelated
  waterfront restaurant (e.g. "Example Harbor Grill", 80 guests) → no note, tier unchanged.
- **B10** Candidate prices equal `lookupPrice` with T2 and T3 for the same format, duration, column and travel data;
  for an out-of-area lead with a travel fee both include it; `rate_card_tier` and the quoted price are unchanged after
  the check (every case above).
- **B11** Hidden from the drafter: with a `tier_b:` note in `flagged_concerns`, `buildGeneratePrompt` and the verify
  prompt contain no `tier_b:` text; `routeLead` holds the lead. Edit path: a test builds a stored classification with
  the note, calls `runEditPipeline(stored, pricing, "shorter")` with a stubbed model requester that captures every
  prompt, and asserts (a) no captured prompt contains `tier_b:`, (b) the `stored` object still holds the note after the
  call (the edit path never re-derives notes), (c) the return value is still `{ drafts, gate }` (shape unchanged).
- **B12** Tier A unchanged: the existing Tier A verify tests pass untouched; a Tier A venue gets no Tier B note.
- **B13 (real model)** pv3 Tom Ham's lead x5: `guest_count` 50 and `event_start_hour` 17 on every run, and **held with
  both prices ($895 / $1,200) on every run** whatever tier the model picks; AND tb2 (Tom Ham's 120 guests, Wednesday
  6 PM) x2 → premium, or held with both prices if priced T2, never an unflagged T2; AND tb3 (Coasterra, Saturday, 40
  guests) x2 → premium, or held with both prices, never an unflagged T2.

## Work steps (one concern per commit; failing test first; mutation-check each test)

1. `TIER_B_VENUES` + the literal prompt line (B1, B8). Mutations: old line back; drop the apostrophe-optional match.
2. Two fields: types, prompt rules, normalize-then-validate (B2, B3). Mutations: validate before normalizing (B2
   fails); drop "50+" rule text (B3 fails).
3. `tierBHold` + `tier_b:` prefix + the one call (B4-B12). Mutations: `>` for `>=` at 100 / 75 / 50 / 17 (each fails
   one case); `||` for `&&` in the Tom Ham's rule (B4 fails); Saturday read as weekend (B5 fails); write the tier (B10 fails); drop the prefix (B11 fails); skip the
   nonprofit guard (B9 fails); omit travel data (B10 fails).
4. Real-model runs B13; record guests, hour, tier, note per run.
5. Codex code review (both runs).

## Execution Path

- **Target:** Alex's MacBook, this repo, the CLI against the real model (PF-Intel lookups are live reads).
- **Mechanism:** the three lead texts are committed in `docs/reviews/2026-10-12-tier-b-leads/` (tb1 = the pv3 Tom Ham's
  lead, 50 guests, 5 PM, Sunday; tb2 = Tom Ham's, 120 guests, 6 PM, Wednesday; tb3 = Coasterra, 40 guests, noon,
  Saturday). From the repo root (nothing is sent; each run overwrites the clipboard):
  ```
  S=$(mktemp -d); L=docs/reviews/2026-10-12-tier-b-leads
  for i in 1 2 3 4 5; do DATABASE_PATH=$S/tb1-$i.db npx tsx src/index.ts --json < $L/tb1-tom-hams-50-5pm.txt > $S/tb1-$i.out; done
  for i in 1 2; do DATABASE_PATH=$S/tb2-$i.db npx tsx src/index.ts --json < $L/tb2-tom-hams-120-6pm.txt > $S/tb2-$i.out; done
  for i in 1 2; do DATABASE_PATH=$S/tb3-$i.db npx tsx src/index.ts --json < $L/tb3-coasterra-saturday-40.txt > $S/tb3-$i.out; done
  ```
  Read from each `.out` (the JSON after the log lines): `classification.guest_count`, `event_start_hour`,
  `rate_card_tier`, and every `flagged_concerns` entry starting `tier_b:`. Record them in
  `docs/reviews/2026-10-12-tier-b-local-runs.md`.
- **Prerequisites:** Anthropic key in `.env`: ALREADY HAVE. Suite + tsc green after the work steps: MUST OBTAIN
  (produced by the work).
- **Who:** Claude Code runs and records; Alex reads the hold notes.
- **Trigger:** after the last code step commits, before the Codex code-review prompt.

Stop and report to Alex if any B13 case misses (extraction wrong, an unflagged T2 at Coasterra on a Saturday, or a
noon 60-guest Tom Ham's lead not held).

## Verification Commands (expected results)

- `npx tsx --test src/tier-b-hold.test.ts` → all pass (B1-B12)
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
- **Least confident:** extraction of guest count and start hour (ranges, "around", missing times); and Brick held on
  every lead until Alex defines "large" and "evening".

## Three Questions

1. **Hardest decision in this session?** Hold versus decide. Alex asked for a recommendation; hold was the only option
   that does not guess at money.
2. **What did you reject, and why?** Overriding the tier (a price decision Alex has not made); prompt-only wording (the
   flip remains).
3. **Least confident about going into the next phase?** Extraction of guest count and start hour from real lead
   wording; Saturday and Tom Ham's are now Alex's stated rules (2026-10-12), Brick is held until he defines it.
