import { test } from "node:test";
import assert from "node:assert/strict";
import { buildGeneratePrompt } from "./prompts/generate.js";
import type { Classification, PricingResult } from "./types.js";

// Port manifest M5 (booking-terms) and M9 (quote-setup-rules): every quote
// states the 50% deposit that holds the date and the setup needs (one 110V
// outlet within ~25 ft, one armless chair). A clarifying-question reply has no
// quote, so neither appears there. Calls the real prompt builder.
const c = (over: Partial<Classification> = {}) =>
  ({
    mode: "evaluation", action: "quote", vagueness: "clear", competition_level: "medium",
    competition_quote_count: 5, stealth_premium: false, stealth_premium_signals: [], tier: "standard",
    rate_card_tier: "T2", lead_source_column: "D", price_point: "slight_premium", format_requested: "guitarist",
    format_recommended: "solo", duration_hours: 2, stated_budget: null, timeline_band: "comfortable",
    close_type: "soft_hold", cultural_context_active: false, cultural_tradition: null, planner_effort_active: false,
    social_proof_active: false, context_modifiers: [], event_date_iso: null, event_energy: null,
    flagged_concerns: [], venue_name: null, client_first_name: null, ...over,
  }) as Classification;
const p = { format: "solo", duration_hours: 2, tier_key: "T2D", anchor: 700, floor: 650, quote_price: 700,
  competition_position: "at anchor", budget: { tier: "none" } } as PricingResult;

test("port manifest M5 M9: a quote states the deposit and setup needs", () => {
  const prompt = buildGeneratePrompt(c(), p, "ctx");
  assert.ok(prompt.includes("50% deposit holds the date"));
  assert.ok(prompt.includes("one standard 110V outlet"));
  assert.ok(prompt.includes("one armless chair"));
});

test("port manifest M5 M9: a clarifying-question reply does not", () => {
  const prompt = buildGeneratePrompt(c({ action: "one_question", format_recommended: "unresolved" }), p, "ctx");
  assert.ok(!prompt.includes("50% deposit holds the date"));
  assert.ok(!prompt.includes("one armless chair"));
});
