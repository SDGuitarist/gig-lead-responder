---
category: verification-design
tags: [verification-gate, gut-checks, conditional-features, type-stability, threshold-design]
module: src/prompts/verify.ts, src/types.ts
symptoms: [variable check counts, broken threshold math, optional type proliferation, inconsistent gate results]
---

# No-Op Gut Checks for Conditional Verification Features

## Problem

The verification gate runs N gut checks on every generated draft. As features are added, some checks only apply to certain leads: `past_date_acknowledged` only matters when a past date was detected, `budget_acknowledged` only when budget data exists, `mariachi_pricing_format` only for ensemble-format leads, `cultural_vocabulary_used` only when cultural context is active.

The naive approach is to omit inapplicable checks from the list. This causes cascading problems:

- The total check count varies per lead (10 checks for plain leads, 12 for budget leads, etc.)
- The threshold must be recalculated for every combination: 8/10, 9/11, 10/12, 11/13...
- `GateResult` needs optional fields or null checks at every call site
- The LLM receives variable-length JSON schemas, increasing parse failures
- The CLI output "12/14 gut checks passed" becomes "8/10" or "11/13" depending on the lead, making results impossible to compare

## The Solution

In `src/prompts/verify.ts`, every conditional builder returns `"Always true — [reason]."` when its feature is inactive. The check is always present; it just always passes.

```typescript
function buildPastDateInstruction(classification: Classification): string {
  if (!classification.past_date_detected) {
    return "Always true — no past date detected.";
  }
  return 'Draft must contain language clarifying the date...';
}

function buildMariachiPricingInstruction(classification: Classification): string {
  if (!classification.flagged_concerns.includes(CONCERN_4PIECE_ALT) &&
      !classification.flagged_concerns.includes(CONCERN_FULL_ENSEMBLE)) {
    return "Always true — no dual-format context.";
  }
  // ... real check logic
}

function buildCulturalVocabInstruction(classification: Classification): string {
  if (!classification.cultural_context_active) {
    return "Always true — no cultural context active.";
  }
  return 'Draft must use specific cultural terminology...';
}

function buildBudgetInstruction(pricing: PricingResult, classification: Classification): string {
  if (pricing.budget.tier === "none") {
    return "Always true — no budget data.";
  }
  // ... real check logic per tier
}
```

The threshold stays at `GUT_CHECK_THRESHOLD of GUT_CHECK_TOTAL` (currently 12/14). For a plain lead with all four conditional checks inactive, four checks are free passes — effective difficulty is 8/10, which matches the original system before any of these features existed.

## Why This Works

**1. Check count stays stable.**
`Object.keys(checks).length` always returns 14. The CLI always displays "14/14 gut checks passed." Results are comparable across leads and sessions.

**2. Threshold math is simple.**
One threshold works for all leads. Adding a 15th feature adds one number to update (`GUT_CHECK_TOTAL`, `GUT_CHECK_THRESHOLD`), not a matrix of per-combination thresholds.

**3. `GateResult` interface stays fixed.**
All 14 keys are always present with no optional fields:

```typescript
gut_checks: {
  can_see_it: boolean;
  would_reply: boolean;
  // ... 10 always-active checks ...
  past_date_acknowledged: boolean;    // no-op when inactive
  budget_acknowledged: boolean;       // no-op when inactive
  mariachi_pricing_format: boolean;   // no-op when inactive
  cultural_vocabulary_used: boolean;  // no-op when inactive
}
```

No null checks, no type narrowing, no `?:` fields at call sites.

**4. The LLM always sees 14 checks.**
A consistent JSON schema produces more consistent JSON. Variable-length check lists are a source of parse failures and subtle misalignment between what was asked and what was returned.

## The Key Insight

When `budget_acknowledged` was first added, the alternative was making it optional in `GateResult` — present only when `tier !== "none"`. That was rejected because it breaks `Object.keys(checks).length` and requires null checks everywhere the result is consumed.

The "always-present, always-true when inactive" approach is slightly redundant — the LLM is told to mark a check true for a reason that doesn't exist. But the redundancy is invisible at runtime and eliminates a class of correctness problems across the type system, the threshold calculation, and the display layer.

## Reusable Pattern

When adding a new conditional gut check to a fixed verification gate:

1. Add the key to `GateResult` as a required `boolean` (not optional).
2. Add the key to `GUT_CHECK_KEYS` in `src/types.ts`.
3. Update `GUT_CHECK_TOTAL`. Re-evaluate `GUT_CHECK_THRESHOLD` (usually `total - 2`).
4. Write a builder function that returns `"Always true — [reason]."` when the feature is inactive.
5. Pass the builder's output into the shared check list alongside all other checks.

Never add a conditional check as an optional type. Never branch the check list based on lead properties. The gate is unconditional; the instructions adapt.

## Prior Phase Risk

No risk flagged by previous phase — prior phase document had no actionable "least confident" item. Proceeding normally.

## Three Questions

1. **Hardest pattern to extract:** Whether to frame this as a verification pattern or a type design pattern. It is both — the no-op check preserves a stable interface AND a stable threshold. Documented as a verification pattern because that is the primary benefit, but the type stability argument is equally important and appears in the code examples.

2. **What was left out:** The Production Watch Item from MEMORY.md about `no_viable_scope` redirects potentially failing standard checks. This is a risk of the "one threshold for all" approach — if a new check makes the gate harder for redirect-mode drafts, the no-op pattern does not help. The fix for that case is targeted prompt adjustment in `verify.ts` (scoped definitions of what passing means in redirect context), not a bifurcated gate. Left out because it is a separate problem with a separate documented fix path.

3. **What future sessions might miss:** When adding a 15th gut check, all three constants in `src/types.ts` must be updated together: `GUT_CHECK_KEYS` (add the key), `GUT_CHECK_TOTAL` (increment), and `GUT_CHECK_THRESHOLD` (re-evaluate). The `constants-at-the-boundary` solution documents this, but a contributor who only reads `verify.ts` will write the builder function and miss the constants entirely. Consider adding a compile-time assertion: `GUT_CHECK_KEYS.length === GUT_CHECK_TOTAL`.
