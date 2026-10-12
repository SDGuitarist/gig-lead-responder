---
title: "Tier B venue pricing: the app decides from a copied number, and holds with both prices where a judgment would decide"
category: architecture
tags: [pricing, tier-b, venues, hold, both-prices, model-judgment, port-error, extraction, normalization, codex-review]
module: src/data/venues.ts, src/pipeline/price.ts, src/pipeline/classify.ts, src/prompts/classify.ts, src/types.ts
symptom: "One made-up Tom Ham's Lighthouse lead (50 guests, Sunday, 5 PM, 3h solo) priced $895 in 5 runs and $1,200 in 2. The model's stealth_premium call flipped between two of Alex's rules."
root_cause: "Two rules judged from prose with no precedence (Tier B 'premium only with another signal' vs 'waterfront restaurant private buyout 50+'), and the 10-03 port had given Tom Ham's Coasterra's rule; Alex's source said 'Large party, sunset timing'."
date: 2026-10-12
model: claude-opus-5-5
predecessor: architecture/2026-10-11-venue-facts-are-not-experience-and-a-silent-dependency.md
related:
  - docs/plans/2026-10-12-fix-tier-b-venue-rule-conflict-hold-plan.md
  - docs/reviews/2026-10-12-tier-b-plan-codex-round1.md
  - docs/reviews/2026-10-12-tier-b-plan-codex-round2.md
  - docs/reviews/2026-10-12-tier-b-plan-codex-round3.md
  - docs/reviews/2026-10-12-tier-b-codex-round1.md
  - docs/reviews/2026-10-12-tier-b-codex-round2.md
  - docs/reviews/2026-10-12-tier-b-local-runs.md
  - docs/solutions/architecture/2026-10-09-app-writes-fixed-lines-model-writes-a-marker.md
---

# Tier B venue pricing: decide from a copied number; hold where a judgment would decide

## Prior Phase Risk

> "Guest count extraction and the corporate (event_arc) call now decide premium at four venues" (plan frontmatter,
> Revision 5)

Addressed by Revision 5b: the corporate call no longer decides; only the guest count does. Extraction measured: the
guest count was read correctly in 15 of 15 real runs.

## Problem

The same lead got two prices. Asked which was right, Alex could not say from memory, and no past quote settled it
(both Gmail accounts and the calendar searched; platform threads not visible). Reading his source file showed the
deeper cause: the port had flattened Tom Ham's own rule into Coasterra's.

## Solution (what ships)

| Venues | Rule (Alex, 2026-10-12) |
|---|---|
| Coasterra, Tom Ham's Lighthouse, Marina Village, Brick | 100+ guests is premium automatically; **under 100, or guests unknown, is always held with both prices**; the AI's corporate call appears only in the note; at Tom Ham's and Coasterra, 50-99 adds "waterfront 50+ buyout rule may apply" |
| Scripps Seaside Forum, Martin Johnson House | always premium |

- `TIER_B_VENUES` (data, one list for the classify prompt and the check); `matchTierB` reads the classified venue name,
  and the lead text only when the name is missing (never "brick" from prose).
- `guest_count` (and `event_start_hour`) are extracted as numbers; `normalizeWholeNumber` turns any odd value into null
  **before** validation, so a "50+" string holds the lead instead of failing it.
- `tierBHold` never writes the tier; every note names T2 and T3 from `lookupPrice` with the same inputs and travel fee;
  `tier_b:` is a hold-note prefix (hidden from generate, verify and edits; shown in the dashboard's Concerns row).
- Real runs: the measured lead held with both prices on 7 of 7 runs (5 on Revision 4 code, 2 on Revision 5b).

**After round 2 (Revision 6/6b and the cap):** every note names what the draft actually offers, because approving sends
the draft as written: "draft uses T2 $895", "draft offers 2h $650 first, then 3h $895" (large budget gap), "draft
states the minimum: 1h $550 (budget redirect)"; residency leads skip the check (their own rate and hold). Code review
round 3 found the first two mismatches, round 4 the redirect; round 4 was past the cap (Claude Code miscounted; Alex's
run B refused per policy), and Alex chose to fix the last one test-first without another review. A one-click "use this
price" action is a Module 1 (1.4 approvals) item.

## How the rule moved (all Alex's calls, each from a heads-up or a question)

1. Hold edge cases with both prices (Claude Code's recommendation: no first-party data backed either rule).
2. Source read: Tom Ham's was mis-ported; Alex set "100+ or 5 PM+", then "both", to avoid most quotes rising.
3. "Saturday evening" = any Saturday, then dropped at Coasterra (a 20-person Saturday lunch would have been premium).
4. One shared rule for four venues (100+ or corporate), then 5b: corporate is a judgment that can flip, so under 100
   always holds.

Each step was a real-world price consequence surfaced before it shipped.

## What this does NOT fix

- The model's draft price at these venues still varies (T2 or T3); the hold note shows both, so Alex picks.
- Holds rise at the four venues (every under-100 lead). That was Alex's trade: a hold over a silent guess.
- `event_start_hour` is extracted but no rule reads it now (documented; both Codex runs judged it intentional).
- The stealth list's generic "Saturday evening at named venue" line is unchanged (out of scope).
- A Saturday or peak-day price is a separate open question for Alex, to decide with his calendar data.

## Prevention

- **Where a model judgment would set a price, decide from a copied number or hold.** Guest count is copied; "corporate"
  and "buyout" are judgments. The app decides on the first and shows the rest to Alex.
- **When a ported rule looks odd, read the source before designing around it.** The Tom Ham's conflict was half a port
  error, visible only in Alex's original file.
- **Surface each rule's price consequence before building it.** Four heads-ups changed the rule before code shipped.
- **Editing a doc by script: anchor on `"\n## Heading\n"`, assert the anchor occurs exactly once and start < end, and
  list the headings afterwards.** An unanchored "## Execution Path" matched a mention inside the text three times in
  this cycle (once duplicating the plan's tests into review round 2).

## Feed-Forward

- **Hardest decision:** what the app may decide alone. Only the copied number; everything judged goes to Alex with
  both prices.
- **Rejected:** app override of the tier; prompt-only precedence; corporate as an automatic trigger (it flips).
- **Least confident:** the hold volume at the four venues; if most leads there are 50-99 guests, Alex sees many holds.
  His picks on those holds are the data for a better rule.

## Three Questions

1. **Hardest pattern to extract from the fixes?** That the right fix kept getting smaller: four rule changes ended
   at "decide on the number, hold the rest".
2. **What did you consider documenting but left out, and why?** The full plan-review history (three NO-GO rounds,
   two of them partly self-inflicted by the edit bug); it is in the review records.
3. **What might future sessions miss that this solution doesn't cover?** Other places where a model judgment sets a
   price silently (Tier A, stealth premium signals at non-Tier-B venues, competition level). Same question applies.
