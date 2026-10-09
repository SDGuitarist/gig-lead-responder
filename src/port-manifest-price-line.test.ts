import { test } from "node:test";
import assert from "node:assert/strict";
import { buildGeneratePrompt } from "./prompts/generate.js";
import { lookupPrice } from "./pipeline/price.js";
import type { Classification, PricingResult } from "./types.js";

// Port manifest R300-R302 (quote formatting by tier). Alex's own sent replies (Patterson, Starikov,
// Miranda in src/data/voice-references.ts) state the price as ONE structured line whatever the tier,
// so Alex 2026-10-09 chose that over the Project's T2 "typically runs around $X" (hedging, against
// the single-number rule). The "what's included" clause only on formats Alex performs; no extension
// price (no rate exists). A prompt rule the model applies: UNEXECUTED until a real lead.
const cls = (format: string, extra: Record<string, unknown> = {}) =>
  ({ format_recommended: format, format_requested: format, duration_hours: 2, rate_card_tier: "T2", lead_source_column: "P",
     competition_level: "low", stated_budget: null, mode: "evaluation", action: "quote", vagueness: "clear",
     competition_quote_count: 0, stealth_premium: false, stealth_premium_signals: [], tier: "standard",
     price_point: "full_premium", timeline_band: "comfortable", close_type: "soft_hold", cultural_context_active: false,
     cultural_tradition: null, planner_effort_active: false, social_proof_active: false, context_modifiers: [],
     event_date_iso: null, event_energy: null, flagged_concerns: [], venue_name: null, client_first_name: null,
     platform: "yelp", ...extra }) as unknown as Classification;
const prompt = (c: Classification, p: PricingResult = lookupPrice(c)) => buildGeneratePrompt(c, p, "ctx");

test("port manifest R300: an ordinary quote gets one structured price line, for every tier", () => {
  for (const tier of ["T1", "T2", "T3"]) {
    const p = prompt(cls("solo", { rate_card_tier: tier, tier: tier === "T3" ? "premium" : "standard" }));
    assert.ok(p.includes("## PRICE LINE"), tier);
    assert.match(p, /\[Format name\], \$\d+, 2 hours/, tier);
    assert.match(p, /never "around", "typically", "starting at"/i, tier);
  }
  assert.doesNotMatch(prompt(cls("solo")), /Extension available/i, "no extension price: no rate exists");
});

test("port manifest R301: the what's-included clause is only on formats Alex performs", () => {
  for (const f of ["solo", "duo", "flamenco_duo", "flamenco_trio", "flamenco_trio_full"]) {
    assert.ok(prompt(cls(f)).includes("| Professional sound, setup and breakdown, repertoire shaped to their event"), f);
  }
  for (const f of ["mariachi_full", "bolero_trio", "sourced_cultural_duo"]) {
    const p = prompt(cls(f));
    assert.ok(p.includes("## PRICE LINE"), `${f}: still a price line`);
    assert.ok(!p.includes("Professional sound, setup and breakdown"), `${f}: no included clause`);
  }
});

test("port manifest R302: residency, clarification and no-viable-scope keep their own price rules", () => {
  const residency = cls("solo", { engagement_type: "residency", residency_tier: "R2", residency_cadence: "weekly" });
  assert.ok(!prompt(residency).includes("## PRICE LINE"), "residency");
  const clarify = cls("unresolved", { action: "one_question" });
  const clarifyPricing = { format: "unresolved", duration_hours: 2, tier_key: "clarify", anchor: 0, floor: 0, quote_price: 0,
    competition_position: "clarify before quoting", budget: { tier: "none" } } as PricingResult; // as run-pipeline.ts builds it
  assert.ok(!prompt(clarify, clarifyPricing).includes("## PRICE LINE"), "clarification");
  const c = cls("duo", { stated_budget: 250 });
  const noScope = { ...lookupPrice(c), budget: { tier: "no_viable_scope", gap: 750 } } as PricingResult;
  assert.ok(!prompt(c, noScope).includes("## PRICE LINE"), "no-viable-scope");
});

test("port manifest R300: with a travel fee the price line states the total", () => {
  const c = cls("solo");
  const travel = { ...lookupPrice(c), travel: { fee: 150, band: "Near", miles: 40, zip: "92025", musician_stipend: 0, custom_quote_required: false } } as PricingResult;
  assert.match(prompt(c, travel), /\[Format name\], \$745, 2 hours/);
});

// Codex round 1 (price line). P1: with travel, the budget sections stated the base price while the
// travel and price-line sections stated the total: two totals to one client. Every client-facing
// price is now clientTotal() (base + the fee the travel section adds). P1: a large gap needs TWO
// prices (the scoped set, then the full set); the price line now names exactly the prices each
// budget mode states, in order.
const near = { fee: 150, band: "Near", miles: 40, zip: "92025", musician_stipend: 0, custom_quote_required: false };
test("port manifest R300: a small budget gap with travel states one total everywhere", () => {
  const c = cls("solo", { stated_budget: 700 });
  const p = { ...lookupPrice(c), travel: near, budget: { tier: "small", gap: 50 } } as PricingResult;
  const out = prompt(c, p);
  assert.match(out, /my rate for a 2hr solo set is \$745/);
  assert.match(out, /\[Format name\], \$745, 2 hours/);
  assert.doesNotMatch(out, /Your rate is \$595/);
});

test("port manifest R300: a large budget gap states the scoped set then the full set, both as totals", () => {
  const c = cls("solo", { stated_budget: 450 });
  const p = { ...lookupPrice(c), travel: near, budget: { tier: "large", gap: 100, scoped_alternative: { duration_hours: 1, price: 500 } } } as PricingResult;
  const out = prompt(c, p);
  const line = out.slice(out.indexOf("## PRICE LINE"));
  assert.ok(line.indexOf("$650, 1 hour") > 0 && line.indexOf("$745, 2 hours") > line.indexOf("$650, 1 hour"), line);
  assert.match(out, /A 1hr set starts at \$650/);
  assert.match(out, /that's \$745\./);
  const noTravel = prompt(c, { ...p, travel: null });
  assert.match(noTravel.slice(noTravel.indexOf("## PRICE LINE")), /\$500, 1 hour[\s\S]*\$595, 2 hours/);
});

// Codex round 2 (price line, both runs) P1: the PRICING header showed raw quote/anchor/floor beside
// the travel-inclusive total. It now names the price the client is told (clientTotal) and labels
// the raw numbers internal.
test("port manifest R300: the PRICING header names the client price and marks raw numbers internal", () => {
  const c = cls("solo");
  const withFee = prompt(c, { ...lookupPrice(c), travel: near } as PricingResult);
  assert.match(withFee, /Price the client is told: \$745/);
  assert.match(withFee, /Internal only, never state these numbers: quote \$595/);
  assert.doesNotMatch(withFee, /^Quote price: \$595$/m);
  const plain = prompt(c);
  assert.match(plain, /Price the client is told: \$595/);
  for (const t of [{ ...near, custom_quote_required: true, fee: 0 }, { ...near, included_in_price: true }, { ...near, band: "Local", fee: 0 }]) {
    assert.match(prompt(c, { ...lookupPrice(c), travel: t } as PricingResult), /Price the client is told: \$595/, JSON.stringify(t));
  }
});
