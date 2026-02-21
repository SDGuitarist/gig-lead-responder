import type { Classification, PricingResult } from "../types.js";

/**
 * Enrich classification based on budget gap result.
 * Pure function — returns a new object when overriding, original when not.
 */
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
  return classification;
}
