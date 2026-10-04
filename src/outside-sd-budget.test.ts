import { test } from "node:test";
import assert from "node:assert/strict";
import { lookupPrice, budgetGapFor } from "./pipeline/price.js";
import { buildGeneratePrompt } from "./prompts/generate.js";
import type { Classification, TravelBand, TravelFeeData } from "./types.js";

// Codex round 1 (port range) finding 1: budget alternatives and the minimum-floor
// message must use the same table lookupPrice chose. Outside SD = 3 h minimum,
// floor $2,700 (T2P); there is no 2-hour option out there.
const cl = (budget: number | null, format = "mariachi_full", hours = 3) =>
  ({ mode: "evaluation", action: "quote", vagueness: "clear", competition_level: "low", competition_quote_count: 0,
     stealth_premium: false, stealth_premium_signals: [], tier: "standard", rate_card_tier: "T2", lead_source_column: "P",
     price_point: "full_premium", format_requested: "mariachi", format_recommended: format, duration_hours: hours,
     stated_budget: budget, timeline_band: "comfortable", close_type: "soft_hold", cultural_context_active: false,
     cultural_tradition: null, planner_effort_active: false, social_proof_active: false, context_modifiers: [],
     event_date_iso: null, event_energy: null, flagged_concerns: [], venue_name: null, client_first_name: null,
     platform: "yelp" }) as unknown as Classification;
const at = (band: TravelBand, miles: number): TravelFeeData => ({ zip: "92000", miles, band, solo_fee: 0, duo_fee: 0,
  duo_musician_stipend: 0, trio_starting: 0, quartet_starting: 950, custom_quote_required: false });

test("outside-SD budget: no 2-hour alternative that the outside table doesn't offer", () => {
  const c = cl(2500);
  const pricing = lookupPrice(c, at("Near", 40));
  const gap = budgetGapFor(c, pricing);
  assert.equal(gap.tier, "no_viable_scope", JSON.stringify(gap));
});

test("outside-SD budget: the warm-redirect minimum is the outside table's", () => {
  const c = cl(900);
  const pricing = lookupPrice(c, at("Near", 40));
  pricing.budget = budgetGapFor(c, pricing);
  const prompt = buildGeneratePrompt(c, pricing, "ctx");
  assert.ok(prompt.includes("is $2700 for 3hr"), "outside-SD minimum");
  assert.ok(!prompt.includes("$1650"), "not the in-county 2-hour floor");
});

test("outside-SD budget: control, in-county mariachi and solo keep their scoped alternatives", () => {
  const local = cl(2300, "mariachi_full", 3); // floor $2,500: a $200 gap is "large"
  const lp = lookupPrice(local, at("Local", 10));
  const lg = budgetGapFor(local, lp);
  assert.equal(lg.tier, "large");
  assert.equal(lg.tier === "large" ? lg.scoped_alternative.duration_hours : 0, 2, "in-county 2-hour option still offered");
  const solo = cl(560, "solo", 3);
  const sp = lookupPrice(solo);
  assert.equal(budgetGapFor(solo, sp).tier, "large");
});
