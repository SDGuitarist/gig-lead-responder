import { test } from "node:test";
import assert from "node:assert/strict";
import { lookupPrice } from "./pipeline/price.js";
import { buildGeneratePrompt } from "./prompts/generate.js";
import type { Classification, TravelBand, TravelFeeData } from "./types.js";

// Port manifest R051 (Alex 2026-10-03): full mariachi 35+ miles out (Near band
// and beyond) uses the card's outside-San-Diego table, travel built in, 3-hour
// minimum. Overnight stays a custom quote. Card: 3h T2P $2,900/$2,700, 4h T3D $4,500/$4,200.
const c = (duration: number, tier: "T2" | "T3" = "T2", col: "P" | "D" = "P") =>
  ({ format_recommended: "mariachi_full", duration_hours: duration, rate_card_tier: tier, lead_source_column: col,
     competition_level: "low", stated_budget: null }) as unknown as Classification;
const at = (band: TravelBand, miles: number): TravelFeeData => ({ zip: "92000", miles, band, solo_fee: 0, duo_fee: 0,
  duo_musician_stipend: 0, trio_starting: 0, quartet_starting: 950, custom_quote_required: band === "Overnight" });

test("mariachi outside SD: 35+ miles uses the outside table with travel built in", () => {
  const p = lookupPrice(c(2), at("Near", 40));
  assert.deepEqual([p.anchor, p.floor, p.duration_hours], [2900, 2700, 3], "3-hour minimum");
  assert.equal(p.travel?.fee, 0);
  assert.equal(p.travel?.included_in_price, true);
  assert.equal(p.travel?.custom_quote_required, false);
  const far = lookupPrice(c(4, "T3", "D"), at("Very Far", 120));
  assert.deepEqual([far.anchor, far.floor, far.duration_hours], [4500, 4200, 4]);
});

test("mariachi outside SD: under 35 miles and overnight keep today's behavior", () => {
  const local = lookupPrice(c(2), at("Local", 10));
  assert.deepEqual([local.anchor, local.floor], [1800, 1650], "San Diego County table");
  const overnight = lookupPrice(c(3), at("Overnight", 300));
  assert.equal(overnight.travel?.custom_quote_required, true);
  assert.notEqual(overnight.travel?.included_in_price, true);
});

test("mariachi outside SD: the draft is told travel is included", () => {
  const cl = { ...c(3), action: "quote", flagged_concerns: [], cultural_context_active: false, tier: "standard",
    competition_level: "low", platform: "yelp", format_requested: "mariachi", venue_name: null, client_first_name: null,
    stealth_premium_signals: [], context_modifiers: [], close_type: "soft_hold", timeline_band: "comfortable" } as unknown as Classification;
  const prompt = buildGeneratePrompt(cl, lookupPrice(c(3), at("Regional", 60)), "ctx");
  assert.ok(prompt.includes("Travel is built into this price"));
});
