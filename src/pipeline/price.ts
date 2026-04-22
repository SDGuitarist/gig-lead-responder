import { RATE_TABLES, type TierRates } from "../data/rates.js";
import { PricingError } from "../errors.js";
import type { Classification, Format, PricingResult, BudgetGapResult, ScopedAlternative, TravelFeeData, TravelComponent } from "../types.js";

const BUDGET_GAP_SMALL_THRESHOLD = 75;  // exclusive: gap < 75 is "small"
const BUDGET_GAP_LARGE_THRESHOLD = 200; // inclusive: gap <= 200 is "large"
const NEAR_MISS_TOLERANCE = 75;         // scoped alt floor can exceed budget by up to this amount

// --- Travel fee: format-to-column mapping (matches TRAVEL_FEES.md) ---

type TravelColumn = "solo_fee" | "duo_fee" | "trio_starting" | "quartet_starting";

// Maps each performance format to the correct travel fee column.
const FORMAT_TRAVEL_COLUMN: Record<Format, TravelColumn> = {
  solo:                     "solo_fee",
  duo:                      "duo_fee",
  flamenco_duo:             "duo_fee",
  flamenco_trio:            "trio_starting",
  flamenco_trio_full:       "trio_starting",
  mariachi_4piece:          "quartet_starting",
  mariachi_full:            "quartet_starting",  // overridden to custom quote
  bolero_trio:              "trio_starting",
  sourced_cultural_solo:    "solo_fee",
  sourced_cultural_duo:     "duo_fee",
  sourced_cultural_trio:    "trio_starting",
  sourced_cultural_quartet: "quartet_starting",
  sourced_cultural_5piece:  "quartet_starting",  // overridden to custom quote
};

// These formats ALWAYS require a custom travel quote regardless of distance band.
// Per TRAVEL_FEES.md: "Mariachi full ensemble (8 players): always custom quote"
// and "5+ musicians: always custom quote (do not use table)".
const CUSTOM_QUOTE_FORMATS: ReadonlySet<Format> = new Set([
  "mariachi_full",
  "sourced_cultural_5piece",
]);

// Duo formats get the musician travel stipend (fair split per TRAVEL_FEES.md).
const DUO_FORMATS: ReadonlySet<Format> = new Set([
  "duo",
  "flamenco_duo",
  "sourced_cultural_duo",
]);

/**
 * Stage 2: Look up pricing from rate cards.
 * Pure function — no API calls.
 *
 * @param travelData - Optional travel fee data from ZIP lookup.
 *   When provided, a TravelComponent is attached to the result.
 */
export function lookupPrice(
  classification: Classification,
  travelData?: TravelFeeData | null,
): PricingResult {
  const { format_recommended, duration_hours, rate_card_tier, lead_source_column, competition_level } = classification;

  // 1. Find rate table for this format
  const rateTable = RATE_TABLES[format_recommended];
  if (!rateTable) {
    const available = Object.keys(RATE_TABLES).join(", ");
    throw new PricingError(`No rate table for format "${format_recommended}". Available: ${available}`);
  }

  // 2. Find duration entry (snap to nearest valid if classifier returns e.g. 2.5)
  const validDurations = Object.keys(rateTable).map(Number).filter((n) => !Number.isNaN(n)).sort((a, b) => a - b);
  const snapped = validDurations.reduce((best, d) => Math.abs(d - duration_hours) < Math.abs(best - duration_hours) ? d : best);
  const durationKey = String(snapped);
  const durationRates = rateTable[durationKey];
  if (!durationRates) {
    const available = Object.keys(rateTable).join(", ");
    throw new PricingError(`No rates for duration "${durationKey}" in ${format_recommended}. Available: ${available}`);
  }

  // 3. Build tier+source key
  // T1 has no P/D split — it's just "T1"
  const tierKey = rate_card_tier === "T1" ? "T1" : `${rate_card_tier}${lead_source_column}`;

  // 4. Look up anchor and floor (fall back to T2P if T1 is missing for this format)
  let rates = durationRates[tierKey as keyof TierRates];
  let effectiveTierKey = tierKey;
  if (!rates && tierKey === "T1" && durationRates.T2P) {
    rates = durationRates.T2P;
    effectiveTierKey = "T2P";
    console.warn(`No T1 rates for ${format_recommended}/${durationKey} — falling back to T2P`);
  }
  if (!rates) {
    const available = Object.keys(durationRates).join(", ");
    throw new PricingError(`No rates for tier key "${tierKey}" in ${format_recommended}/${durationKey}. Available: ${available}`);
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
    default:
      console.warn(`Unknown competition_level "${competition_level}" — defaulting to anchor`);
      quote_price = anchor;
      competition_position = "at anchor (fallback)";
  }

  // Build travel component when ZIP lookup returned data
  const travel = travelData ? buildTravelComponent(travelData, format_recommended) : null;

  return {
    format: format_recommended,
    duration_hours,
    tier_key: effectiveTierKey,
    anchor,
    floor,
    quote_price,
    competition_position,
    budget: { tier: "none" },
    travel,
  };
}

/**
 * Detect gap between client's stated budget and the rate floor.
 * Pure function — returns a discriminated union describing the gap tier.
 */
export function detectBudgetGap(
  stated_budget: number | null,
  floor: number,
  format: Format,
  duration_hours: number,
  tier_key: string,
): BudgetGapResult {
  // Input validation: treat invalid budgets as "no budget stated"
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

/**
 * Try to find a shorter duration at the same tier that fits the stated budget.
 */
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
  if (currentIdx <= 0) return null; // No shorter duration exists

  const shorterDuration = allDurations[currentIdx - 1];
  const shorterRates = rateTable[String(shorterDuration)]?.[tier_key as keyof TierRates];
  if (!shorterRates || shorterRates.floor >= stated_budget + NEAR_MISS_TOLERANCE) return null;

  return {
    duration_hours: shorterDuration,
    price: shorterRates.floor, // floor, not anchor — gives client a real yes
  };
}

// --- Travel fee helpers ---

/**
 * Read the fee for a given format from the TravelFeeData columns.
 * Type-safe switch avoids dynamic property access.
 */
function getTravelFeeForColumn(data: TravelFeeData, column: TravelColumn): number {
  switch (column) {
    case "solo_fee":        return data.solo_fee;
    case "duo_fee":         return data.duo_fee;
    case "trio_starting":   return data.trio_starting;
    case "quartet_starting": return data.quartet_starting;
  }
}

/**
 * Build a TravelComponent from ZIP lookup data and the recommended format.
 *
 * Rules (from TRAVEL_FEES.md):
 * - Mariachi full + sourced 5-piece → always custom_quote_required
 * - Duo formats get musician_stipend (fair split)
 * - All others: look up fee from the format's column in the fee matrix
 */
function buildTravelComponent(data: TravelFeeData, format: Format): TravelComponent {
  const customQuote = data.custom_quote_required || CUSTOM_QUOTE_FORMATS.has(format);
  const column = FORMAT_TRAVEL_COLUMN[format];
  const fee = customQuote ? 0 : getTravelFeeForColumn(data, column);
  const musicianStipend = DUO_FORMATS.has(format) ? data.duo_musician_stipend : 0;

  return {
    fee,
    band: data.band,
    miles: data.miles,
    zip: data.zip,
    musician_stipend: musicianStipend,
    custom_quote_required: customQuote,
  };
}
