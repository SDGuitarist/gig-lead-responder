import type { Classification, Format, PricingResult } from "../types.js";
import { parseLocalDate } from "../utils/dates.js";

/**
 * Enrich classification based on budget gap, date analysis, and format routing.
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

  // Format routing override (mariachi weekday/weekend rules)
  const routing = resolveFormatRouting(enriched);
  if (routing) {
    enriched = {
      ...enriched,
      format_recommended: routing.format_recommended,
      ...(routing.show_alternative && {
        flagged_concerns: [
          ...enriched.flagged_concerns,
          routing.format_recommended === "mariachi_full"
            ? "mention_4piece_alternative"
            : "mention_full_ensemble_upgrade",
        ],
      }),
    };
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

/**
 * Override format routing for mariachi leads based on day-of-week + event signals.
 * Hard constraint: 4-piece is weekday only. Default: full ensemble.
 * Exception: weekday + corporate + background → 4-piece.
 */
function resolveFormatRouting(
  classification: Classification,
): { format_recommended: Format; show_alternative: boolean } | null {
  // Only applies to mariachi formats
  if (
    classification.format_recommended !== "mariachi_4piece" &&
    classification.format_recommended !== "mariachi_full"
  ) {
    return null;
  }

  const dateISO = classification.event_date_iso;
  if (!dateISO) {
    // No date → can't determine day-of-week → keep LLM's recommendation
    return null;
  }

  const day = parseLocalDate(dateISO).getDay(); // 0=Sun, 6=Sat
  const isWeekend = day === 0 || day === 5 || day === 6; // Fri, Sat, Sun

  if (isWeekend) {
    // 4-piece not available on weekends → full ensemble, no alternative
    return { format_recommended: "mariachi_full", show_alternative: false };
  }

  // Weekday: default full ensemble, exception for corporate background
  const isCorporateBackground =
    classification.tier === "premium" &&
    classification.event_energy === "background";

  if (isCorporateBackground) {
    return { format_recommended: "mariachi_4piece", show_alternative: true };
  }

  // Weekday, not corporate background → full ensemble, mention 4-piece as option
  return { format_recommended: "mariachi_full", show_alternative: true };
}
