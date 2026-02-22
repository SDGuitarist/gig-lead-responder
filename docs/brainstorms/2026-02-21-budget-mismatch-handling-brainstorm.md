# Brainstorm: Budget Mismatch Handling

**Date:** 2026-02-21
**Status:** Ready for planning

## Problem

When a lead states a budget below the T2 floor for their requested format, the
pipeline classifies it as Standard, quotes at anchor, and ignores the budget
entirely. The client gets surprised on the next reply ("but I said $400"), which
loses deals. The pipeline should catch this and handle it in the first response.

**Example:** Lead says $400 for a 2hr solo guitarist. T2 floor is $500 (platform)
/ $550 (direct). Pipeline quoted $550 with no acknowledgment of the gap.

**Root cause:** Budget is extracted as text but never compared numerically to
floor. The LLM is asked to detect budget mismatch but fails at the math. Even
when Qualification tier is set, the generate prompt doesn't do anything different.

## What We're Building

A deterministic budget mismatch detection system that:

1. Extracts stated budget as a number (LLM parses, code decides)
2. Compares it to the floor for the classified format/duration/tier
3. Categorizes the gap into a response strategy
4. Feeds concrete alternative pricing to the generate prompt
5. Routes the generate prompt to the right response mode

## Key Decisions

### Decision 1: Three-tier gap response strategy

Based on the numeric gap between stated budget and floor:

| Gap Size | Threshold | Response Mode | Example |
|----------|-----------|---------------|---------|
| Small | Budget within $75 of floor | Name the gap, quote anchor | "$475 budget vs $550 rate — name it, explain value" |
| Large | Budget $75–$200 below floor | Offer scoped alternative + upgrade path | "$400 budget vs $550 2hr — offer 1hr at $450, mention 2hr at $550" |
| No viable scope | Budget >$200 below floor OR no shorter format fits | Warm redirect | "$250 wedding — no format fits, exit gracefully" |

### Decision 2: Hybrid architecture (LLM extracts, code decides)

- **LLM (classify step):** Extracts `stated_budget` as a number (currently text —
  small type change)
- **Code (price.ts):** Compares stated budget to floor, calculates `budget_gap`
  and `budget_gap_tier` ("small" | "large" | "no_viable_scope")
- **Code (price.ts):** Also looks up the next-lower duration's floor to provide a
  concrete scoped alternative price
- **LLM (generate step):** Reads `budget_gap_tier` and alternative pricing, routes
  to the matching response template

This avoids the current failure mode: asking the LLM to do math.

### Decision 3: PricingResult shape change

`PricingResult` needs new fields:

```
stated_budget: number | null        // from classification
budget_gap: number | null           // floor - stated_budget (positive = below floor)
budget_gap_tier: "none" | "small" | "large" | "no_viable_scope"
scoped_alternative: {               // only when budget_gap_tier === "large"
  format: string
  duration_hours: number
  price: number
} | null
```

The scoped alternative is concrete — "1 hour at $450" not "a shorter set." This
requires price.ts to look up the next-lower duration's floor for the same format.

### Decision 4: Classification tier override

When `budget_gap_tier` is "large" or "no_viable_scope", force `classification.tier`
to "qualification" regardless of other signals. This happens in code after pricing,
not in the LLM classify step.

### Decision 5: Generate prompt routing

Three response modes keyed off `budget_gap_tier`:

- **"none" / "small":** Current behavior (quote anchor). For "small," add one
  sentence acknowledging the budget and explaining value.
- **"large":** Lead with the scoped alternative as a concrete yes. Then name the
  full option as an upgrade. CTA is about the scoped option.
- **"no_viable_scope":** Warm redirect — acknowledge the budget respectfully,
  explain the floor, suggest alternatives (recorded music, referral to another
  musician). Don't manufacture a fake option.

## Open Questions

1. **Should the scoped alternative always be "same format, shorter duration"?**
   Or could it be "different format, same duration" (e.g., solo instead of duo)?
   Starting with duration reduction is simpler and covers most cases.

2. **What about leads with no stated budget?** Current behavior (Standard tier,
   quote anchor) is correct — no budget means no mismatch to detect. No change
   needed.

3. **Does this affect confidence scoring?** Budget mismatch leads should probably
   cap confidence: small gap → cap at 65, large gap → cap at 55, no viable scope
   → cap at 40. This is Option 3 from the original diagnosis, now as a safety net
   rather than the primary fix.

## Three Questions

1. **Hardest decision in this session?** The gap thresholds ($75 / $200). These
   are judgment calls based on deal psychology, not data. They'll need tuning
   after real leads flow through.

2. **What did you reject, and why?** Letting the LLM handle the budget comparison
   (Option 2 from original diagnosis). The current failure IS the LLM doing math
   poorly. Deterministic code is the right tool for a deterministic problem.

3. **Least confident about going into the next phase?** The scoped alternative
   lookup — price.ts needs to return the next-lower duration's floor, which means
   iterating the rate table. If a format only has one duration entry, there's no
   scope-down option, and the logic needs to handle that gracefully (fall through
   to "no_viable_scope" if the only option is still above budget).
