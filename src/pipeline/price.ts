import { FLAMENCO_TRIO_3H_DANCER_2H_RATES, MARIACHI_FULL_OUTSIDE_SD_RATES, RATE_TABLES, RESIDENCY_FLOORS, RESIDENCY_RATES, type FormatRates, type TierRates } from "../data/rates.js";
import { PricingError } from "../errors.js";
import type { Classification, Format, PricingResult, ResidencyCadence, ResidencyQuote, ResidencyTier, BudgetGapResult, ScopedAlternative, TravelBand, TravelFeeData, TravelComponent } from "../types.js";

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

// Distance bands that count as outside San Diego County for full mariachi
// (35+ miles; Alex 2026-10-03). Overnight stays a custom quote.
const OUTSIDE_SD_BANDS: ReadonlySet<TravelBand> = new Set(["Near", "Regional", "Far", "Very Far"]);

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
const NP_MIN_IN_KIND = 100; // Alex 2026-10-09: the smallest in-kind contribution worth a line

export function lookupPrice(
  classification: Classification,
  travelData?: TravelFeeData | null,
): PricingResult {
  const standard = lookupStandardPrice(classification, travelData);
  // NP2 (port manifest R403, Alex 2026-10-09): an established-foundation solo at 1-2h is quoted AT the
  // NP2 floor, and the standard price is kept for the in-kind line. Only when the standard is at least
  // $100 above the NP2 price (Alex: a $5 or $50 contribution line is not worth sending); anything else
  // keeps the standard price and is held for Alex. Solo only because only SOLO_RATES has NP2 rows.
  const np2 = rateTableFor(standard)[String(standard.duration_hours)]?.NP2;
  if (np2 && classification.nonprofit_buyer === true && classification.np_tier === "NP2"
    && classification.rate_card_tier !== "T4"
    && classification.engagement_type !== "residency" && standard.quote_price - np2.floor >= NP_MIN_IN_KIND) {
    return { ...standard, tier_key: "NP2", anchor: np2.floor, floor: np2.floor, quote_price: np2.floor,
      competition_position: "NP2 at the floor", in_kind: { standard: standard.quote_price } };
  }
  return standard;
}

function lookupStandardPrice(
  classification: Classification,
  travelData?: TravelFeeData | null,
): PricingResult {
  const { format_recommended, duration_hours, rate_card_tier, lead_source_column, competition_level } = classification;
  if (format_recommended === "unresolved") {
    throw new PricingError('Cannot look up pricing for unresolved format');
  }

  // 1. Find rate table for this format. Full mariachi 35+ miles out uses the
  // outside-San-Diego table, which already includes travel (port manifest R051).
  const outsideSd =
    format_recommended === "mariachi_full" && !!travelData && OUTSIDE_SD_BANDS.has(travelData.band);
  const rateTable = rateTableFor({ format: format_recommended, rate_table: outsideSd ? "mariachi_full_outside_sd" : undefined });
  if (!rateTable) {
    const available = Object.keys(RATE_TABLES).join(", ");
    throw new PricingError(`No rate table for format "${format_recommended}". Available: ${available}`);
  }

  // 2. Find duration entry: a request between card lengths rounds UP (2.5 h → 3 h,
  // Alex 2026-10-03); above the longest card length, the longest.
  const validDurations = Object.keys(rateTable).map(Number).filter((n) => !Number.isNaN(n)).sort((a, b) => a - b);
  const snapped = validDurations.find((d) => d >= duration_hours) ?? validDurations[validDurations.length - 1];
  const durationKey = String(snapped);
  // A 3-hour flamenco trio with the dancer for 2 hours has its own row (R048).
  const durationRates =
    format_recommended === "flamenco_trio" && durationKey === "3" && classification.extended_dancer === true
      ? FLAMENCO_TRIO_3H_DANCER_2H_RATES
      : rateTable[durationKey];
  if (!durationRates) {
    const available = Object.keys(rateTable).join(", ");
    throw new PricingError(`No rates for duration "${durationKey}" in ${format_recommended}. Available: ${available}`);
  }

  // 3. Build tier+source key
  // T1 and T4 have no P/D split: just "T1" / "T4"
  const tierKey = rate_card_tier === "T1" || rate_card_tier === "T4" ? rate_card_tier : `${rate_card_tier}${lead_source_column}`;

  // 4. Look up anchor and floor (fall back to T2P if T1 is missing for this format)
  let rates = durationRates[tierKey as keyof TierRates];
  let effectiveTierKey = tierKey;
  if (!rates && tierKey === "T1" && durationRates.T2P) {
    rates = durationRates.T2P;
    effectiveTierKey = "T2P";
    console.warn(`No T1 rates for ${format_recommended}/${durationKey} — falling back to T2P`);
  }
  // A format with no T4 price is priced at its T3 reference and held (t4FallbackHold, Alex 2026-10-09).
  if (!rates && tierKey === "T4") {
    effectiveTierKey = `T3${lead_source_column}`;
    rates = durationRates[effectiveTierKey as keyof TierRates];
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
  const travel = !travelData
    ? null
    : outsideSd
      ? { fee: 0, band: travelData.band, miles: travelData.miles, zip: travelData.zip, musician_stipend: 0,
          custom_quote_required: false, included_in_price: true }
      : buildTravelComponent(travelData, format_recommended);

  return {
    format: format_recommended,
    // Always the hours actually priced, never the hours asked for: a 1-hour mariachi
    // request is priced at the 2-hour minimum and must say 2 hours (Alex 2026-10-03).
    duration_hours: snapped,
    tier_key: effectiveTierKey,
    anchor,
    floor,
    quote_price,
    competition_position,
    budget: { tier: "none" },
    travel,
    ...(outsideSd ? { rate_table: "mariachi_full_outside_sd" as const } : {}),
    // Residency pricing is solo Alex only; any other recurring format is a series of
    // private events at its private-event price (R286, Alex 2026-10-04: no discount).
    // Every residency carries a quote so drafting stays in residency mode (Codex round 1 P1).
    ...(classification.engagement_type !== "residency" ? {}
      : format_recommended === "solo"
        ? { residency: lookupResidencyRate(classification.residency_tier ?? "R2", duration_hours, classification.residency_cadence ?? null) }
        : { residency: { tier: classification.residency_tier ?? "R2", cadence: classification.residency_cadence ?? null, hours: snapped,
            rate: quote_price, floor, reason: null, series: true as const } }),
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
  rateTable: FormatRates = RATE_TABLES[format],
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
    const alt = findScopedAlternative(rateTable, duration_hours, tier_key, stated_budget);
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
  rateTable: FormatRates | undefined,
  duration_hours: number,
  tier_key: string,
  stated_budget: number,
): ScopedAlternative | null {
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

/**
 * The rate table that priced this result. lookupPrice, the budget gap and the
 * minimum-floor message all read it, so they can't disagree (Codex round 1, finding 1).
 */
export function rateTableFor(pricing: Pick<PricingResult, "format" | "rate_table">): FormatRates {
  if (pricing.rate_table === "mariachi_full_outside_sd") return MARIACHI_FULL_OUTSIDE_SD_RATES;
  return RATE_TABLES[pricing.format as Format];
}

/** Budget gap for a priced lead, against the table that priced it (callers: run-pipeline). */
export function budgetGapFor(classification: Classification, pricing: PricingResult): BudgetGapResult {
  return detectBudgetGap(classification.stated_budget, pricing.floor, pricing.format as Format,
    pricing.duration_hours, pricing.tier_key, rateTableFor(pricing));
}

/**
 * Residency price per night, solo Alex (port manifest R221/R108–R111). Pure.
 * No rate (null + reason) for R1, above 3 hours, or an unknown cadence:
 * those go to Alex, never to an invented number.
 */
export function lookupResidencyRate(tier: ResidencyTier, hours: number, cadence: ResidencyCadence | null): ResidencyQuote {
  const none = (reason: string): ResidencyQuote => ({ tier, cadence, hours: null, rate: null, floor: null, reason });
  if (tier === "R1") return none("R1 owner-operator residency: Alex sets the rate in conversation");
  if (hours > 3) return none(`no residency rate for ${hours} hours (the card stops at 3)`);
  if (cadence === null) return none("residency cadence unknown (weekly, bi-weekly or monthly)");
  const priced = hours <= 2 ? 2 : 3;
  return { tier, cadence, hours: priced, rate: RESIDENCY_RATES[tier][priced === 2 ? "2" : "3"][cadence], floor: RESIDENCY_FLOORS[tier], reason: null };
}

/** A residency draft states a number only when the venue asked and a rate exists (Alex 2026-10-04). */
export function residencyStatesPrice(classification: Pick<Classification, "price_asked">, q: ResidencyQuote): boolean {
  return classification.price_asked === true && q.rate !== null;
}

/**
 * Find the minimum floor price across all durations for a format+tier_key.
 * Used by no_viable_scope mode to state the absolute minimum.
 */
export function findMinFloor(
  rateTable: FormatRates,
  tier_key: string,
): { min_floor: number; min_duration: number } {
  let min_floor = Infinity;
  let min_duration = 0;

  for (const [durationKey, tiers] of Object.entries(rateTable)) {
    const rates = tiers[tier_key as keyof TierRates];
    if (rates && rates.floor < min_floor) {
      min_floor = rates.floor;
      min_duration = Number(durationKey);
    }
  }

  return { min_floor, min_duration };
}

// Port manifest R295/R362: "$150 minimum profit on every booking, no exceptions" (Project).
// Checked only where a real cost exists (Alex 2026-10-07): sourced formats at the Project's
// $200/hr per musician, and duo / flamenco duo at 2-3h against Alex's real $600 payout (T1 4h+
// held: a flat price, outside his range). Trio, mariachi and bolero have no cost data: not checked (known gap).
const MIN_PROFIT = 150;
const SOURCED_MUSICIAN_RATE = 200;
const DUO_SECOND_MUSICIAN_PAY = 600; // Alex 2026-10-07: $400-$600 for 2-3h; the top of the range
const SOURCED_PLAYERS: Partial<Record<string, number>> = { sourced_cultural_solo: 1, sourced_cultural_duo: 2,
  sourced_cultural_trio: 3, sourced_cultural_quartet: 4, sourced_cultural_5piece: 5 };
export function minimumProfitHold(
  pricing: Pick<PricingResult, "format" | "duration_hours" | "tier_key" | "quote_price"> & Partial<Pick<PricingResult, "travel" | "budget">>,
): string | null {
  const players = SOURCED_PLAYERS[pricing.format];
  if (players && pricing.quote_price > 0) {
    // Travel (docs/TRAVEL_FEES.md): the client pays the fee and the musician's stipend comes out of
    // it, so the fee is income (unless already inside the quote) and the stipend is cost.
    const t = pricing.travel;
    const fee = t && !t.included_in_price ? t.fee : 0;
    const stipend = t?.musician_stipend ?? 0;
    const check = (label: string, hours: number, price: number): string | null => {
      const cost = players * SOURCED_MUSICIAN_RATE * hours;
      const profit = price + fee - cost - stipend;
      return profit < MIN_PROFIT
        ? `minimum_profit: ${pricing.format}${label} ${hours}h at $${price} leaves $${profit} after $${cost} for ${players} ` +
          `musician${players === 1 ? "" : "s"}${stipend ? ` and a $${stipend} travel stipend` : ""} (under $${MIN_PROFIT}); Alex prices it`
        : null;
    };
    // The scoped alternative is a second price the client sees (Codex round 1, minimum profit P2).
    const alt = pricing.budget?.tier === "large" ? pricing.budget.scoped_alternative : null;
    return check("", pricing.duration_hours, pricing.quote_price)
      ?? (alt ? check(" scoped alternative", alt.duration_hours, alt.price) : null);
  }
  if (pricing.format === "duo" || pricing.format === "flamenco_duo") {
    // Alex 2026-10-07: he pays the second musician $400-$600 for a 2-3h gig; use $600 so the check
    // never assumes he paid less. 4h+ is outside that range: a flat T1 price stays held. 1h: no data.
    const h = pricing.duration_hours;
    const t = pricing.travel;
    const fee = t && !t.included_in_price ? t.fee : 0;
    const stipend = t?.musician_stipend ?? 0;
    const check = (label: string, hours: number, price: number): string | null => {
      if (!(hours === 2 || hours === 3) || !(price > 0)) return null;
      const profit = price + fee - DUO_SECOND_MUSICIAN_PAY - stipend;
      return profit < MIN_PROFIT
        ? `minimum_profit: ${pricing.format}${label} ${hours}h at $${price} leaves $${profit} after $${DUO_SECOND_MUSICIAN_PAY} ` +
          `for the second musician${stipend ? ` and a $${stipend} travel stipend` : ""} (under $${MIN_PROFIT}); Alex prices it`
        : null;
    };
    // The scoped alternative is a second price the client sees (Codex round 1, duo P2).
    const alt = pricing.budget?.tier === "large" ? pricing.budget.scoped_alternative : null;
    const note = check("", h, pricing.quote_price) ?? (alt ? check(" scoped alternative", alt.duration_hours, alt.price) : null);
    if (note) return note;
    if (h >= 4 && pricing.tier_key === "T1") {
      return `minimum_profit: T1 ${pricing.format} ${h}h at the flat T1 price; the second musician's hours may ` +
        `leave under $${MIN_PROFIT}; Alex prices it`;
    }
  }
  return null;
}

// The price the client is told for a base price: base + the travel fee, exactly when the generate
// prompt's travel section adds one (not a custom quote, not included in the price, not Local).
// One rule for every client-facing number (Codex round 1, price line: two totals to one client).
export function clientTotal(pricing: Pick<PricingResult, "travel">, base: number): number {
  const t = pricing.travel;
  return t && !t.custom_quote_required && !t.included_in_price && t.band !== "Local" ? base + t.fee : base;
}

// T4 with no T4 price for this format (port manifest R403; Alex 2026-10-09: hold, never invent one):
// lookupPrice used the T3 price as a reference, and the lead is held for Alex.
export function t4FallbackHold(classification: Pick<Classification, "rate_card_tier">,
  pricing: Pick<PricingResult, "tier_key" | "format" | "duration_hours" | "quote_price">): string | null {
  return classification.rate_card_tier === "T4" && pricing.tier_key !== "T4" && pricing.quote_price > 0
    ? `t4: no T4 price for ${pricing.format} ${pricing.duration_hours}h; the draft uses the T3 price as a reference; Alex prices it`
    : null;
}

// Every nonprofit lead is held (R403; Alex 2026-10-09: a priced NP2 is still reviewed before sending).
// This note says whether NP2 priced it and, if not, why; the classify-stage note does the holding.
export function nonprofitPriceNote(classification: Pick<Classification, "nonprofit_buyer" | "np_tier" | "rate_card_tier" | "engagement_type">,
  pricing: Pick<PricingResult, "format" | "duration_hours" | "quote_price" | "in_kind" | "rate_table">): string | null {
  if (classification.nonprofit_buyer !== true) return null;
  const h = pricing.duration_hours;
  if (pricing.in_kind) {
    return `nonprofit: NP2 ${pricing.format} ${h}h at $${pricing.quote_price} (standard $${pricing.in_kind.standard}, ` +
      "in-kind line in the drafts); Alex reviews before sending";
  }
  const what = `${classification.np_tier ?? "NP tier unsure"} ${pricing.format} ${h}h`;
  const np2 = rateTableFor(pricing)[String(h)]?.NP2;
  const why = classification.rate_card_tier === "T4" ? `${what} was classified T4`
    : classification.engagement_type === "residency" ? `${what} is a residency`
    : classification.np_tier === "NP2" && np2 ? `${what}, standard $${pricing.quote_price} is not $${NP_MIN_IN_KIND} above the NP2 $${np2.floor}`
    : `${what} has no NP rate`;
  return `nonprofit: no NP price (${why}); the draft uses the standard price; Alex prices it`;
}
