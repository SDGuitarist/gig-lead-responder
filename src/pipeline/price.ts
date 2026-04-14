import { RATE_TABLES, type TierRates } from "../data/rates.js";
import type { Classification, Format, PricingResult, BudgetGapResult, ScopedAlternative } from "../types.js";

const BUDGET_GAP_SMALL_THRESHOLD = 75;  // exclusive: gap < 75 is "small"
const BUDGET_GAP_LARGE_THRESHOLD = 200; // inclusive: gap <= 200 is "large"
const NEAR_MISS_TOLERANCE = 75;         // scoped alt floor can exceed budget by up to this amount

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

  // 2. Find duration entry (snap to nearest valid if classifier returns e.g. 2.5)
  const validDurations = Object.keys(rateTable).map(Number).filter((n) => !Number.isNaN(n)).sort((a, b) => a - b);
  const snapped = validDurations.reduce((best, d) => Math.abs(d - duration_hours) < Math.abs(best - duration_hours) ? d : best);
  const durationKey = String(snapped);
  const durationRates = rateTable[durationKey];
  if (!durationRates) {
    const available = Object.keys(rateTable).join(", ");
    throw new Error(`No rates for duration "${durationKey}" in ${format_recommended}. Available: ${available}`);
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
    default:
      console.warn(`Unknown competition_level "${competition_level}" — defaulting to anchor`);
      quote_price = anchor;
      competition_position = "at anchor (fallback)";
  }

  return {
    format: format_recommended,
    duration_hours,
    tier_key: effectiveTierKey,
    anchor,
    floor,
    quote_price,
    competition_position,
    budget: { tier: "none" },
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
