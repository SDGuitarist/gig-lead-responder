import type { Classification, PricingResult } from "../types.js";
import { parseLocalDate } from "../utils/dates.js";

/**
 * Enrich classification based on budget gap and date analysis.
 * Pure function — returns a new object when overriding, original when not.
 */
export function enrichClassification(
  classification: Classification,
  pricing: PricingResult,
): Classification {
  let enriched = classification;

  // Past-date detection (deterministic — never ask the LLM)
  if (classification.event_date_iso) {
    const eventDate = parseLocalDate(classification.event_date_iso);
    const today = parseLocalDate(new Date().toISOString().slice(0, 10));
    if (eventDate < today) {
      enriched = { ...enriched, past_date_detected: true };
    }
  }

  // Budget enrichment
  if (
    pricing.budget.tier === "large" ||
    pricing.budget.tier === "no_viable_scope"
  ) {
    enriched = {
      ...enriched,
      tier: "qualification",
      close_type: "hesitant",
    };
  }

  return enriched;
}
