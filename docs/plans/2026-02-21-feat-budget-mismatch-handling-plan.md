---
title: "feat: Budget mismatch handling"
type: feat
date: 2026-02-21
brainstorm: docs/brainstorms/2026-02-21-budget-mismatch-handling-brainstorm.md
deepened: 2026-02-21
---

# Budget Mismatch Handling

## Enhancement Summary

**Deepened on:** 2026-02-21
**Agents used:** TypeScript reviewer, pattern recognition, performance oracle,
simplicity reviewer, architecture strategist, security sentinel, learnings researcher

### Key Improvements from Deepening
1. **Discriminated union** for budget gap result — type-safe, eliminates null-check bugs
2. **Pure enrichment function** instead of classification mutation — preserves audit trail
3. **Separate `detectBudgetGap` function** — keeps lookupPrice single-purpose, independently testable
4. **Input validation** for stated_budget — bounds checking, NaN filter, prompt injection defense
5. **Top-of-prompt placement** for budget mode — learned from prompt-placement solution
6. **Deletion test** for budget gut check — learned from testable-constraints solution
7. **Drop Phase 6** (confidence caps) — YAGNI, nothing reads confidence to make decisions
8. **Drop simplified 3-check verify gate** — standard checks work fine on redirects

### Simplifications Applied
- Removed `stated_budget` from PricingResult (only on Classification)
- Removed `budget_gap: number` from PricingResult (local variable only)
- Removed `format` from ScopedAlternative (never changes in scope-down)
- Dropped Phase 6 entirely (confidence caps are premature)
- Dropped simplified verify gate for no_viable_scope (one new gut check instead)
- 3 sessions instead of 4

---

## Overview

When a lead states a budget below the rate floor, the pipeline should detect the
gap in code (not LLM math) and route the generate prompt to a response strategy
that acknowledges the budget — instead of quoting at anchor and deferring the
friction to the next round-trip.

## Problem Statement

Lead A says "$400" for a 2hr solo guitarist. T2D floor is $550. The pipeline
classified it as Standard, quoted $550, never mentioned the $400. The client's
next reply is "but I said $400" — a second round-trip that loses deals.

Root cause: budget is extracted as text, never compared numerically to floor. The
LLM is asked to detect budget mismatch but fails at the math. Even when
Qualification tier is set, the generate prompt does nothing different.

## Proposed Solution

Hybrid architecture: LLM extracts `stated_budget` as a number, deterministic
code compares it to floor via a pure `detectBudgetGap` function, and feeds
concrete alternative pricing to the generate prompt. Three response modes keyed
off the gap size, injected at the top of the generate prompt.

---

## Implementation Phases

### Phase 1: Types and extraction (src/types.ts, src/prompts/classify.ts)

**src/types.ts** — Add `stated_budget` to Classification:

```typescript
// After line 36 (duration_hours)
stated_budget: number | null;
```

Add a discriminated union for budget gap results (new type):

```typescript
export type BudgetGapResult =
  | { tier: "none" }
  | { tier: "small"; gap: number }
  | { tier: "large"; gap: number; scoped_alternative: ScopedAlternative }
  | { tier: "no_viable_scope"; gap: number };

export interface ScopedAlternative {
  duration_hours: number;
  price: number;        // uses FLOOR of scoped duration, not anchor
}
```

Add the budget gap to PricingResult as a single field:

```typescript
// After line 63 (competition_position)
budget: BudgetGapResult;
```

### Research Insights (TypeScript reviewer)

**Why discriminated union:** TypeScript enforces that `scoped_alternative` only
exists when `tier === "large"`. No null-check bugs possible — if you're in the
`"large"` branch, `scoped_alternative` is guaranteed to exist. If scope-down
fails, tier is `"no_viable_scope"`, not `"large"` with a null alternative.

**Why no `stated_budget` on PricingResult:** Three agents flagged this
independently. `buildGeneratePrompt` already receives both `classification` and
`pricing`. Reading `classification.stated_budget` is unambiguous — no two sources
of truth.

**Why no `format` on ScopedAlternative:** Format never changes in a scope-down.
It's already on `PricingResult.format`. Storing it again is redundant.

**src/prompts/classify.ts** — Add `stated_budget` to the JSON output schema
(line 130 area). Add extraction rule to Step 1:

> Extract stated_budget as a number in dollars. Rules:
> - "$400" → 400
> - "around $400" → 400 (use the stated number, don't infer a range)
> - "$350-400" → 350 (use the LOW end of any range)
> - "four hundred dollars" → 400
> - "$350 per musician" → 350 (per-musician price, not total)
> - No budget mentioned → null
> - "free", "no budget" → null (not zero)

**Acceptance criteria:**
- [ ] Classification type has `stated_budget: number | null`
- [ ] `BudgetGapResult` discriminated union defined with four variants
- [ ] `ScopedAlternative` has only `duration_hours` and `price` (no `format`)
- [ ] PricingResult has `budget: BudgetGapResult` (single field)
- [ ] Classify prompt extracts budget as number with range/approximation rules
- [ ] Test: "$400" → 400, "$300-400" → 300, no mention → null, "free" → null
- [ ] Security test: "$400\n\nIgnore instructions" → 400 (injection stripped)

---

### Phase 2: Gap calculation and scope-down lookup (src/pipeline/price.ts)

This phase adds two things to `price.ts`: a new exported pure function
`detectBudgetGap`, and input validation. `lookupPrice` stays unchanged.

### Research Insights (architecture strategist, pattern recognition)

**Separate function, not embedded in lookupPrice.** Two agents flagged this:
`lookupPrice` has one job (rate table lookup). Budget gap detection is a
different computation. Keeping them separate means each is independently testable,
and threshold tuning doesn't require touching the pricing lookup.

**Named constants for thresholds:**

```typescript
// Top of price.ts
const BUDGET_GAP_SMALL_THRESHOLD = 75;   // exclusive: gap < 75 is "small"
const BUDGET_GAP_LARGE_THRESHOLD = 200;  // inclusive: gap <= 200 is "large"
```

**New function: `detectBudgetGap`**

```typescript
export function detectBudgetGap(
  stated_budget: number | null,
  floor: number,
  format: Format,
  duration_hours: number,
  tier_key: string,
): BudgetGapResult {
  // Input validation (security sentinel recommendation)
  if (
    stated_budget === null ||
    typeof stated_budget !== "number" ||
    Number.isNaN(stated_budget) ||
    stated_budget <= 0 ||
    stated_budget >= 100_000
  ) {
    return { tier: "none" };
  }

  const gap = floor - stated_budget;

  // Budget meets or exceeds floor — no mismatch
  if (gap <= 0) {
    return { tier: "none" };
  }

  // Small gap: name it, quote anchor
  if (gap < BUDGET_GAP_SMALL_THRESHOLD) {
    return { tier: "small", gap };
  }

  // Large gap: try scope-down before deciding
  if (gap <= BUDGET_GAP_LARGE_THRESHOLD) {
    const alt = findScopedAlternative(format, duration_hours, tier_key, stated_budget);
    if (alt) {
      return { tier: "large", gap, scoped_alternative: alt };
    }
    // No scope-down available — escalate
    return { tier: "no_viable_scope", gap };
  }

  // Extreme gap: warm redirect
  return { tier: "no_viable_scope", gap };
}
```

**Scope-down helper (private):**

```typescript
function findScopedAlternative(
  format: Format,
  duration_hours: number,
  tier_key: string,
  stated_budget: number,
): ScopedAlternative | null {
  const rateTable = RATE_TABLES[format];
  if (!rateTable) return null;

  // Sort duration keys numerically, filter NaN safety net
  const allDurations = Object.keys(rateTable)
    .map(Number)
    .filter((n) => !Number.isNaN(n))
    .sort((a, b) => a - b);

  const currentIdx = allDurations.indexOf(duration_hours);
  if (currentIdx <= 0) return null;  // No shorter duration exists

  const shorterDuration = allDurations[currentIdx - 1];
  const shorterRates = rateTable[String(shorterDuration)]?.[tier_key];
  if (!shorterRates || shorterRates.floor > stated_budget) return null;

  return {
    duration_hours: shorterDuration,
    price: shorterRates.floor,   // floor, not anchor — gives client a real yes
  };
}
```

**Boundary conventions:**
- gap < 75 → "small" (exclusive: $74.99 is small, $75 is large)
- 75 <= gap <= 200 → "large"
- gap > 200 → "no_viable_scope"

Key design choices:
- Scoped alternative uses the **same tier_key** as original (T2P stays T2P)
- Scoped alternative price is the **floor**, not anchor — gives client a real yes
- "Fits budget" check: `scoped_floor <= stated_budget`
- If no shorter duration exists (duo at 2hr) → falls to `no_viable_scope`

### Research Insights (security sentinel)

**Input validation is critical.** The LLM extracts stated_budget from
user-provided text. Malicious or malformed inputs are possible:
- Negative numbers: `gap = floor - (-500) = floor + 500` (false positive)
- Zero: conflates "no budget" with "$0 budget"
- NaN: breaks all comparisons silently
- Extremely large: no harm but worth rejecting

The validation block at the top of `detectBudgetGap` handles all cases by
treating invalid inputs as `null` → `{ tier: "none" }`.

**Acceptance criteria:**
- [ ] `detectBudgetGap` is a separate exported pure function
- [ ] `findScopedAlternative` is a private helper
- [ ] Thresholds are named constants at top of file
- [ ] NaN filter on duration key sort
- [ ] Input validation: null, NaN, <= 0, >= 100000 all return `{ tier: "none" }`
- [ ] Gap thresholds: <75 small, 75-200 large, >200 no_viable_scope
- [ ] Scope-down uses same tier_key, compares floor to stated_budget
- [ ] No scope-down → escalates to no_viable_scope
- [ ] `lookupPrice` is NOT modified (stays single-purpose)

---

### Phase 3: Enrichment and generate prompt routing (src/pipeline/enrich.ts, src/run-pipeline.ts, src/prompts/generate.ts)

This phase wires up the budget gap result and routes the generate prompt.

### Research Insights (architecture strategist)

**Pure enrichment function, not mutation.** Two agents flagged that mutating
`classification.tier` in place destroys traceability — the stored
`classification_json` can't distinguish "LLM said qualification" from "code
overrode to qualification." The fix is a pure function that returns a new object.

**New file: `src/pipeline/enrich.ts`**

```typescript
import type { Classification, PricingResult } from "../types.js";

export function enrichClassification(
  classification: Classification,
  pricing: PricingResult,
): Classification {
  if (
    pricing.budget.tier === "large" ||
    pricing.budget.tier === "no_viable_scope"
  ) {
    return {
      ...classification,
      tier: "qualification",
      close_type: "hesitant",
    };
  }
  return classification;  // no copy needed when no override
}
```

**In `run-pipeline.ts`** (after lookupPrice, before selectContext):

```typescript
const pricing = lookupPrice(classification);
const budgetGap = detectBudgetGap(
  classification.stated_budget,
  pricing.floor,
  pricing.format,
  pricing.duration_hours,
  pricing.tier_key,
);
// Attach budget gap to pricing result
pricing.budget = budgetGap;

// Enrich classification (pure — returns new object if overriding)
const enriched = enrichClassification(classification, pricing);

// All downstream stages use enriched, not classification
const context = await selectContext(enriched);
const { drafts, gate, verified } = await runWithVerification(enriched, pricing, context);
```

The original `classification` is preserved for the `onStage` callback and
`PipelineOutput`. The `enriched` version drives generation.

### Generate prompt routing (src/prompts/generate.ts)

### Research Insights (learnings: prompt-placement, sparse-lead-classification)

**Top-of-prompt placement.** From `docs/solutions/prompt-placement-for-hard-constraints.md`:
budget routing instructions go at the TOP of the generate prompt, before persona,
before examples, before pricing data. Conditional rules buried in data sections
get ignored ~30% of the time.

**Concern bundling.** From `docs/solutions/sparse-lead-type-classification.md`:
the "large gap" response should bundle the reframe into one confident sentence,
not enumerate concessions. "A 1-hour solo set at $450, fully self-contained" —
not "normally I charge $550 for 2 hours, but we could reduce to 1 hour, which
would lower the price to..."

Add budget mode injection at the top of `buildGeneratePrompt`, before all other
content, when `pricing.budget.tier !== "none"`:

**"small" mode** — Standard 5-step template + one inline instruction:

> BUDGET MODE: SMALL GAP
> The client stated a budget of $[stated_budget]. Your rate is $[quote_price].
> The gap is small ($[gap]). In your validation step, add ONE sentence that names
> the rate directly. Be matter-of-fact: "You mentioned $[budget] — my rate for a
> [duration] [format] set is $[quote_price], fully self-contained." No apology.

Word count: 100-125 words (same as standard).

**"large" mode** — Modified template:

> BUDGET MODE: LARGE GAP — OFFER SCOPED ALTERNATIVE
> The client stated a budget of $[stated_budget]. Your [duration]hr rate starts
> at $[floor] — above their range. A [scoped_duration]hr set at $[scoped_price]
> fits their budget.
>
> Structure:
> 1. Cinematic opening (same as standard — still hook them)
> 2. Lead with the scoped option as a concrete yes: one confident sentence naming
>    the duration, format, and price. Make it feel complete, not a consolation.
> 3. Name the upgrade: "If you want the full [original_duration]hr set, that's
>    $[quote_price]." One sentence, no pressure.
> 4. CTA: "Want me to hold [date] for the [scoped_duration]hr set?"
>
> Do NOT lead with the higher price. Do NOT enumerate concessions.

Word count: 100-125 words.

**"no_viable_scope" mode** — Different template entirely:

> BUDGET MODE: NO VIABLE SCOPE — WARM REDIRECT
> The client stated a budget of $[stated_budget]. Your minimum for any [format]
> set is $[min_floor] for [min_duration]hr. No combination fits their budget.
>
> Write a warm redirect (NOT a rejection):
> 1. Acknowledge what they're planning — show you read the lead.
> 2. Be direct about the floor: "My [format] sets start at $[min_floor]."
> 3. Suggest a concrete alternative: "A curated playlist or a DJ could work
>    well for your setting and budget."
> 4. Leave the door open: "If your budget shifts, I'd love to help."
>
> Tone: warm, respectful, not dismissive.

Word count: 50-75 words. No cinematic opening. No wedge instruction.

**GigSalad constraint:** For no_viable_scope on GigSalad, close with: "If your
plans change, you can find me here on GigSalad." (no phone, no "reach out")

**Stealth premium conflict:** If `stealth_premium: true` AND
`pricing.budget.tier !== "none"`, budget tier takes precedence.

**Acceptance criteria:**
- [ ] `enrichClassification` is a pure function in new `src/pipeline/enrich.ts`
- [ ] Returns a new object (spread) when overriding, original when not
- [ ] Downstream stages use `enriched`, original `classification` preserved
- [ ] Budget mode injected at TOP of generate prompt (before persona/examples)
- [ ] Three distinct instruction blocks for small/large/no_viable_scope
- [ ] "large" mode bundles the offer in one confident sentence (no enumeration)
- [ ] "no_viable_scope" mode uses 50-75 word count, no cinematic opening
- [ ] GigSalad no_viable_scope has platform-safe close
- [ ] stealth_premium does not override budget tier

---

### Phase 4: Verification update (src/prompts/verify.ts)

Add budget awareness to the verify gate with ONE new gut check.

### Research Insights (learnings: testable-constraints, simplicity reviewer)

**Deletion test, not vague check.** From `docs/solutions/testable-constraints-for-prompt-compliance.md`:
don't ask "does the draft acknowledge the budget?" — that's too vague. Use a
deletion test: "Remove the sentence that references the client's budget or the
pricing gap. Does the draft still make sense for any lead? If yes, the budget
constraint is not addressed — fail."

**No simplified 3-check gate.** The simplicity reviewer flagged this: adding a
conditional branch to the verify system for one response type adds complexity
without proven need. Standard gut checks will mostly pass trivially on a warm
redirect (shorter, simpler prose). Let the standard checks evaluate it. If they
produce false failures on redirects, fix then — don't preemptively build a
parallel verification path.

**No automatic concern injection.** The pattern recognition agent flagged that
injecting `"budget_below_floor"` into `classification.flagged_concerns` creates a
hidden synchronization dependency with the edit pipeline. Instead, the verify gate
reads `pricing.budget.tier` directly — a first-class check alongside existing
gut checks.

**Implementation:**

1. Pass `pricing` to `buildVerifyPrompt` (new parameter, optional for backward
   compat with edit pipeline — default to `{ budget: { tier: "none" } }`)

2. When `pricing.budget.tier !== "none"`, add the 11th gut check:

```
budget_acknowledged: true/false — Deletion test: remove the sentence that
references the client's stated budget ($[stated_budget]) or the pricing gap.
Does the remaining draft still work for any lead with any budget? If yes →
false (the budget is not specifically addressed). For "large" mode: the draft
must name a specific scoped alternative price. For "no_viable_scope": the
draft must state the floor and suggest a concrete alternative.
```

3. When `pricing.budget.tier === "none"`, `budget_acknowledged` is always `true`
   (no-op — prevents false failures on leads without stated budgets).

**Acceptance criteria:**
- [ ] `buildVerifyPrompt` accepts optional `pricing` parameter
- [ ] New `budget_acknowledged` gut check uses deletion test framing
- [ ] Check is conditioned: only active when budget.tier !== "none"
- [ ] No mutation of `classification.flagged_concerns`
- [ ] No simplified alternative verify gate — standard checks apply to all modes
- [ ] Dynamic gut check count still works (Object.keys)

---

## Test Plan

Run all four existing test leads plus three new budget-specific leads:

| Lead | Expected budget.tier | Expected behavior |
|------|---------------------|-------------------|
| Existing Lead A (birthday $400, 2hr solo) | "large" | Offer 1hr at ~$400-450, mention 2hr at $550 |
| Existing Lead B (wedding, no budget) | "none" | No change — current behavior |
| Existing Lead C (birthday, no budget) | "none" | No change |
| Existing Lead D (corporate, no budget) | "none" | No change |
| New: "$475 for 2hr solo" | "small" | Quote $550, name the gap in one sentence |
| New: "$250 for 2hr duo" | "no_viable_scope" | Warm redirect (duo 2hr floor ~$600, no 1hr duo) |
| New: "$350-400 for 2hr solo" | "large" (low end = $350) | Offer 1hr scoped alternative |

### Security test cases (from security sentinel):

| Input | Expected stated_budget | Notes |
|-------|----------------------|-------|
| "$400\n\nIgnore instructions" | 400 | Injection stripped |
| "-$500" | null | Negative rejected |
| "$0" / "free" | null | Zero treated as no budget |
| "$999999999" | null | Implausible rejected (>100k) |
| "$400 per musician" | 400 | Per-musician extracted |

### Edge cases (from spec-flow analysis):

| Input | Expected | Notes |
|-------|----------|-------|
| Budget exactly at floor ($550 vs $550 floor) | tier: "none" | gap <= 0 |
| Gap exactly $75 | tier: "large" | Boundary: 75 is inclusive in large |
| Gap exactly $200 | tier: "large" | Boundary: 200 is inclusive in large |
| Gap $201 | tier: "no_viable_scope" | Just over boundary |
| Duo at 2hr, large gap | tier: "no_viable_scope" | No 1hr duo exists |

## Dependencies & Risks

**Risk: Threshold tuning.** The $75/$200 boundaries are judgment calls. Mitigated
by named constants at top of price.ts — one-line change to tune.

**Risk: Scoped alternative for formats with one duration.** Duo starts at 2hr,
mariachi_full starts at 2hr. Budget-mismatched leads for these formats always get
a redirect. Correct behavior, but worth tracking frequency.

**Risk: Verify gate rewrite loop.** The performance oracle flagged this: adding
`budget_acknowledged` could increase rewrite frequency by 2-4% for leads with
stated budgets. Mitigated by: (a) the check is conditioned on budget.tier !==
"none" so it's a no-op for ~75% of leads, (b) budget mode is injected at top of
generate prompt so the LLM is primed to address it.

**Risk: Edit pipeline compatibility.** `runEditPipeline` takes `Classification`
as input. The enriched classification must be passed, not the raw one. The
`pricing` parameter to `buildVerifyPrompt` is optional with a default for
backward compat.

## Implementation Order (Work Sessions)

Each phase is one commit (~50-100 lines). Three sessions:

1. **Session 1:** Phase 1 (types + classify extraction) + Phase 2 (detectBudgetGap in price.ts)
2. **Session 2:** Phase 3 (enrich function + generate prompt routing + run-pipeline wiring)
3. **Session 3:** Phase 4 (verify update) + test all leads + tune thresholds

## Files Changed

| File | Change | Phase |
|------|--------|-------|
| `src/types.ts` | Add `stated_budget`, `BudgetGapResult`, `ScopedAlternative` | 1 |
| `src/prompts/classify.ts` | Add `stated_budget` to JSON schema + extraction rules | 1 |
| `src/pipeline/price.ts` | Add `detectBudgetGap` + `findScopedAlternative` (exported + private) | 2 |
| `src/pipeline/enrich.ts` | New file: `enrichClassification` pure function | 3 |
| `src/run-pipeline.ts` | Wire detectBudgetGap + enrichClassification between stages | 3 |
| `src/prompts/generate.ts` | Add budget mode injection at top of prompt | 3 |
| `src/prompts/verify.ts` | Add optional `pricing` param + `budget_acknowledged` gut check | 4 |

## References

- Brainstorm: `docs/brainstorms/2026-02-21-budget-mismatch-handling-brainstorm.md`
- Rate tables: `src/data/rates.ts`
- Pricing logic: `src/pipeline/price.ts`
- Classify prompt: `src/prompts/classify.ts`
- Generate prompt: `src/prompts/generate.ts`
- Verify prompt: `src/prompts/verify.ts`
- Pipeline orchestration: `src/run-pipeline.ts`
- Learning: `docs/solutions/prompt-placement-for-hard-constraints.md` — budget mode at top of prompt
- Learning: `docs/solutions/testable-constraints-for-prompt-compliance.md` — deletion test for gut check
- Learning: `docs/solutions/sparse-lead-type-classification.md` — concern bundling for large gap response

## Three Questions

1. **Hardest decision in this session?** The scoped alternative pricing — using
   floor instead of anchor, and comparing against stated_budget to determine
   viability. This is the most load-bearing math in the feature: if the comparison
   is wrong, the pipeline offers alternatives the client still can't afford.

2. **What did you reject, and why?** Format-change scope-down (offering solo
   instead of duo). It's a different service with different value — the client
   asked for a duo for a reason. Duration reduction preserves the format they
   chose. If no duration fits, the honest answer is a redirect, not a bait-and-
   switch to a cheaper format.

3. **Least confident about going into the next phase?** Whether standard gut
   checks will pass cleanly on no_viable_scope redirects. The simplicity reviewer
   argued they will (shorter, simpler prose passes trivially). If they don't, the
   fix is targeted — adjust individual checks — not a parallel verification path.
