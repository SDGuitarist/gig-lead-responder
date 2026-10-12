---
title: "Tier B venues: the app decides when the venue rules disagree, and holds with both prices"
type: fix
date: 2026-10-12
status: plan (plan review closed at the hard cap; Alex: fix and build, 2026-10-12)
feed_forward:
  risk: "Extraction of guest count and start hour from real lead wording; Brick held until Alex defines it"
  verify_first: true
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

## Revision 4 (Alex, 2026-10-12, during work; no plan-review round: the cap fired, the code review covers it)

A heads-up showed "any Saturday" made every Saturday event at Coasterra premium, even a 20-person lunch. **Alex:
Coasterra is premium only with 100+ guests or a corporate event; Saturday does not count.** Changes: D1 Coasterra
rule and prompt text "100+ guests or corporate"; the date is no longer read for Tier B (the strict-date rule and B5's
date cases now assert that the date does not matter); a Coasterra lead with guests unknown and not corporate holds
("guests not stated"). B13's tb3 (Coasterra, Saturday, 40 guests, noon): expected standard with no note, or held if the
model prices it premium ("own rule says standard; priced premium"). Commit after the plan: the code change.

## Revision 3 (after Codex PLAN round 3 = NO-GO on both runs, the hard cap; Alex: fix and build, no further plan review; `docs/reviews/2026-10-12-tier-b-plan-codex-round3.md`)

| # | Finding | Change |
|---|---|---|
| 1 | Tom Ham's guests null + start < 17 had no row (A P1) | new D3 row "guests not stated; waterfront 50+ buyout rule may apply" before the waterfront row; B4f |
| 2 | dashboard visibility not tested (A P1, B P2) | B14 pins the lead-detail "Concerns" renderer |
| 3 | EARS form and grouping (A P2) | B1-B14 rewritten WHEN/SHALL, Happy Path / Error Cases |
| 4 | frontmatter (A P2) | `feed_forward` added |
| 5 | PF-Intel prerequisite (A note) | listed |
| 6 | "log lines before the JSON" (B P3) | not accepted: the CLI prints log lines on stdout before the JSON (observed 2026-10-11) |

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
   | own rule not met, waterfront, guests null (R097 cannot be settled; Revision 3) | "tier_b: <venue> guests not stated; waterfront 50+ buyout rule may apply; T2 $a / T3 $b" |
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

Unit tests use classifications built in the test (no model) and `lookupPrice` for the candidate prices. "Held" means
exactly one `tier_b:` note naming both prices (T2 $a / T3 $b from `lookupPrice`); "none" means no `tier_b:` note.
`rate_card_tier` and the quoted price SHALL be unchanged in every case.

### Happy Path

- **B1** WHEN the classify prompt is built, THE SYSTEM SHALL contain the literal D1 Tier B line exactly once (pinned as
  a string in the test) AND SHALL NOT contain the old Tier B line.
- **B3** WHEN the classify prompt is built, THE SYSTEM SHALL contain the D2 extraction rules (pinned phrases "50+",
  "5-8 PM", "noon", "under 60").
- **B4a** WHEN a Tom Ham's lead has guests 120, start hour 18 and is priced T3, THE SYSTEM SHALL add no note.
- **B4b** WHEN a Tom Ham's lead has guests 120, start hour 18 and is priced T2, THE SYSTEM SHALL hold with "own rule says
  premium (100+ guests and starts 5 PM or later)".
- **B4c** WHEN a Tom Ham's lead has guests 40, start hour 18 or guests 49, start hour 16, priced T2, THE SYSTEM SHALL add
  no note.
- **B5a** WHEN a Coasterra lead is on a Saturday with guests 30, priced T2, THE SYSTEM SHALL hold with "own rule says
  premium (any Saturday)".
- **B5b** WHEN a Coasterra lead is corporate on a Sunday with guests 30, priced T3, THE SYSTEM SHALL add no note; WHEN
  it is not corporate on a Sunday with guests 30, priced T2, THE SYSTEM SHALL add no note.
- **B6a** WHEN a Marina Village lead has guests 75, or is corporate with guests null, priced T2, THE SYSTEM SHALL hold
  ("own rule says premium"); WHEN it has guests 74, not corporate, priced T2, THE SYSTEM SHALL add no note.
- **B6b** WHEN a Scripps Seaside Forum ("Scripps Forum") or Martin Johnson House lead is priced T2, THE SYSTEM SHALL
  hold; WHEN priced T3, THE SYSTEM SHALL add no note.
- **B8** WHEN the venue is "Tom Hams Lighthouse", "Tom Ham's", "Tom Ham’s", "TOM HAM'S LIGHTHOUSE", "Coasterra", "Scripps
  Forum", "Scripps Seaside Forum", "Marina Village" or "Martin Johnson House", THE SYSTEM SHALL match the Tier B entry;
  WHEN it is "Tom Hanks", "Scripps Ranch" or "Coaster", THE SYSTEM SHALL NOT.
- **B10** WHEN any note is added, its two prices SHALL equal `lookupPrice` with T2 and T3 for the same format, duration,
  column and travel data; WHEN the lead is out of area with a travel fee, both prices SHALL include it.
- **B12** WHEN the Tier A verify tests run, THE SYSTEM SHALL pass them unchanged; WHEN a lead names a Tier A venue only,
  THE SYSTEM SHALL add no Tier B note.
- **B14** WHEN the dashboard renders a lead's detail, THE SYSTEM SHALL print every `flagged_concerns` entry in the
  "Concerns" row (test: `public/dashboard.html` contains the renderer line `['Concerns', c.flagged_concerns.join(', ')]`
  inside the lead-detail rows, pinned), so Alex sees the `tier_b:` note with both prices.

### Error Cases

- **B2** WHEN `guest_count` / `event_start_hour` arrive as below, THE SYSTEM SHALL normalize before validation and SHALL
  NOT fail classification. Each field tested on its own:

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
- **B4d** WHEN a Tom Ham's lead has guests 50, start hour 17 (priced T2 or T3), or guests 120, start hour 12 (T2), THE
  SYSTEM SHALL hold with "own rule says standard; waterfront 50+ buyout rule may apply".
- **B4e** WHEN a Tom Ham's lead has guests 120 and start hour null, THE SYSTEM SHALL hold with "start hour not stated";
  WHEN guests null and start hour 18, THE SYSTEM SHALL hold with "guests not stated".
- **B4f** WHEN a Tom Ham's lead has guests null and start hour 12 (own rule decided: not met; R097 cannot be settled),
  THE SYSTEM SHALL hold with "guests not stated; waterfront 50+ buyout rule may apply" (Revision 3 row).
- **B5c** WHEN a Coasterra lead has date null, or the impossible date "2026-02-31", guests 30, not corporate, priced T2,
  THE SYSTEM SHALL hold with "date not stated"; WHEN a Sunday with guests 55, priced T2, THE SYSTEM SHALL hold with the
  waterfront note.
- **B6c** WHEN a Marina Village lead has guests null and is not corporate, THE SYSTEM SHALL hold with "guests not
  stated"; WHEN the venue is "Brick" (`venue_name`), THE SYSTEM SHALL hold at any tier.
- **B7** WHEN a Tom Ham's lead has guests 40, start hour 12, and is priced T3, THE SYSTEM SHALL hold with "own rule says
  standard; priced premium (<stealth signals>)".
- **B9** WHEN `venue_name` is "Example Harbor Grill" and the lead text says "we considered Tom Ham's", or the buyer is a
  nonprofit, or it is a clarification lead, or no Tier B venue is named, or `venue_name` is another venue and the text
  says "brick", or an unrelated waterfront restaurant has 80 guests, THE SYSTEM SHALL add no Tier B note.
- **B11** WHEN `flagged_concerns` holds a `tier_b:` note, `buildGeneratePrompt` and the verify prompt SHALL contain no
  `tier_b:` text AND `routeLead` SHALL hold the lead; WHEN `runEditPipeline(stored, pricing, "shorter")` runs with a
  stubbed model requester capturing every prompt, no captured prompt SHALL contain `tier_b:`, the `stored` object SHALL
  still hold the note afterwards, and the return value SHALL still be `{ drafts, gate }`.
- **B13 (real model)** WHEN tb1 (Tom Ham's, 50 guests, 5 PM, Sunday) runs 5 times, THE SYSTEM SHALL record guest_count
  50 and event_start_hour 17 and hold with both prices ($895 / $1,200) on every run; WHEN tb2 (Tom Ham's, 120 guests,
  Wednesday 6 PM) and tb3 (Coasterra, Saturday, 40 guests) run twice each, THE SYSTEM SHALL price them T3, or hold with
  both prices, and SHALL NEVER leave an unflagged T2.

## Work steps (one concern per commit; failing test first; mutation-check each test)

1. `TIER_B_VENUES` + the literal prompt line (B1, B8). Mutations: old line back; drop the apostrophe-optional match.
2. Two fields: types, prompt rules, normalize-then-validate (B2, B3). Mutations: validate before normalizing (B2
   fails); drop "50+" rule text (B3 fails).
3. `tierBHold` + `tier_b:` prefix + the one call (B4-B12, B14). Mutations: `>` for `>=` at 100 / 75 / 50 / 17 (each fails
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
- **Prerequisites:** Anthropic key in `.env`: ALREADY HAVE. PF-Intel production URL + key in `.env`: ALREADY HAVE (fixed
  2026-10-11, verified hit/miss; lookups are live reads). Suite + tsc green after the work steps: MUST OBTAIN
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
