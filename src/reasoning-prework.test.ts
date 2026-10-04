import { test } from "node:test";
import assert from "node:assert/strict";
import { buildGeneratePrompt } from "./prompts/generate.js";
import type { Classification, PricingResult } from "./types.js";

// Port manifest R244/R249/R268 (request type) and R334 (fears, each with the
// sentence that answers it): both are pre-work in the reasoning block.
const c = { mode: "evaluation", action: "quote", vagueness: "clear", competition_level: "low", competition_quote_count: 0,
  stealth_premium: false, stealth_premium_signals: [], tier: "standard", rate_card_tier: "T2", lead_source_column: "D",
  price_point: "full_premium", format_requested: "guitarist", format_recommended: "solo", duration_hours: 2,
  stated_budget: null, timeline_band: "comfortable", close_type: "soft_hold", cultural_context_active: false,
  cultural_tradition: null, planner_effort_active: false, social_proof_active: false, context_modifiers: [],
  event_date_iso: null, event_energy: null, flagged_concerns: [], venue_name: null, client_first_name: null } as unknown as Classification;
const p = { format: "solo", duration_hours: 2, tier_key: "T2D", anchor: 700, floor: 650, quote_price: 700,
  competition_position: "at anchor", budget: { tier: "none" } } as PricingResult;

test("reasoning pre-work asks for request type and fears with their answers", () => {
  const prompt = buildGeneratePrompt(c, p, "ctx");
  assert.ok(prompt.includes("- **request_type**"));
  assert.ok(prompt.includes("- **fears_to_address**"));
  assert.ok(prompt.includes('"request_type": "format" | "category"'));
  assert.ok(prompt.includes('"fears_to_address": [{"fear": '));
});
