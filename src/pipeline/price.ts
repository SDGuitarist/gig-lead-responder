import { RATE_TABLES, type TierRates } from "../data/rates.js";
import type { Classification, PricingResult } from "../types.js";

/**
 * Stage 2: Look up pricing from rate cards.
 * Pure function — no API calls.
 */
export function lookupPrice(classification: Classification): PricingResult {
  const { format_recommended, duration_hours, rate_card_tier, lead_source_column, competition_level } = classification;

  // 1. Find rate table for this format
  const rateTable = RATE_TABLES[format_recommended];
  if (!rateTable) {
    const available = Object.keys(RATE_TABLES).join(", ");
    throw new Error(`No rate table for format "${format_recommended}". Available: ${available}`);
  }

  // 2. Find duration entry
  const durationKey = String(duration_hours);
  const durationRates = rateTable[durationKey];
  if (!durationRates) {
    const available = Object.keys(rateTable).join(", ");
    throw new Error(`No rates for duration "${durationKey}" in ${format_recommended}. Available: ${available}`);
  }

  // 3. Build tier+source key
  // T1 has no P/D split — it's just "T1"
  const tierKey = rate_card_tier === "T1" ? "T1" : `${rate_card_tier}${lead_source_column}`;

  // 4. Look up anchor and floor
  const rates = durationRates[tierKey as keyof TierRates];
  if (!rates) {
    const available = Object.keys(durationRates).join(", ");
    throw new Error(`No rates for tier key "${tierKey}" in ${format_recommended}/${durationKey}. Available: ${available}`);
  }

  const { anchor, floor } = rates;

  // 5. Apply competition positioning
  let quote_price: number;
  let competition_position: string;

  switch (competition_level) {
    case "low":
      quote_price = anchor;
      competition_position = "at anchor";
      break;
    case "medium":
      quote_price = anchor;
      competition_position = "at anchor, willing to flex";
      break;
    case "high":
      quote_price = Math.round(floor + (anchor - floor) * 0.25);
      competition_position = "near floor";
      break;
    case "extreme":
      quote_price = floor;
      competition_position = "at floor";
      break;
  }

  return {
    format: format_recommended,
    duration_hours,
    tier_key: tierKey,
    anchor,
    floor,
    quote_price,
    competition_position,
  };
}
