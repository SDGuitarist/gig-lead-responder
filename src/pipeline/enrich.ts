import { CONCERN_4PIECE_ALT, CONCERN_FULL_ENSEMBLE, type Classification, type Format, type PricingResult } from "../types.js";
import { parseLocalDate } from "../utils/dates.js";

/**
 * Enrich classification based on budget gap, date analysis, and format routing.
 * Deterministic given inputs — no system clock reads.
 * Returns a new object when overriding, original when not.
 */
export function enrichClassification(
  classification: Classification,
  pricing: PricingResult,
  today: string,
): Classification {
  let enriched = classification;

  // ⚠️ Enrichment order matters: budget enrichment (last) overwrites tier/close_type,
  // so format routing (middle) must run first while tier still reflects the LLM's value.

  // Past-date detection (deterministic — never ask the LLM)
  if (classification.event_date_iso) {
    const eventDate = parseLocalDate(classification.event_date_iso);
    const todayDate = parseLocalDate(today);
    if (eventDate < todayDate) {
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
            ? CONCERN_4PIECE_ALT
            : CONCERN_FULL_ENSEMBLE,
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
  // Friday counts as weekend: 4-piece musicians have day-job conflicts on weekdays,
  // but Friday evening gigs run like weekend events for scheduling purposes.
  const isWeekend = day === 0 || day === 5 || day === 6; // Fri, Sat, Sun

  if (isWeekend) {
    // 4-piece not available on weekends → full ensemble, no alternative
    return { format_recommended: "mariachi_full", show_alternative: false };
  }

  // Weekday: default full ensemble, exception for corporate background.
  // Proxy: tier "premium" covers corporate events (see classify.ts Step 4).
  // If non-corporate events start getting premium tier, revisit this check.
  const isCorporateBackground =
    classification.tier === "premium" &&
    classification.event_energy === "background";

  if (isCorporateBackground) {
    return { format_recommended: "mariachi_4piece", show_alternative: true };
  }

  // Weekday, not corporate background → full ensemble, mention 4-piece as option
  return { format_recommended: "mariachi_full", show_alternative: true };
}
