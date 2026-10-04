import { test } from "node:test";
import assert from "node:assert/strict";
import { buildGeneratePrompt } from "./prompts/generate.js";
import type { Classification, PricingResult } from "./types.js";

// Port manifest R341: qualification-tier leads get the Project's response shape.
const c = (tier: string, competition = "low") => ({ mode: "evaluation", action: "quote", vagueness: "clear",
  competition_level: competition, competition_quote_count: 0, stealth_premium: false, stealth_premium_signals: [], tier,
  rate_card_tier: "T2", lead_source_column: "D", price_point: "full_premium", format_requested: "band",
  format_recommended: "solo", duration_hours: 2, stated_budget: null, timeline_band: "comfortable", close_type: "hesitant",
  cultural_context_active: false, cultural_tradition: null, planner_effort_active: false, social_proof_active: false,
  context_modifiers: [], event_date_iso: null, event_energy: null, flagged_concerns: [], venue_name: null,
  client_first_name: null }) as unknown as Classification;
const p = { format: "solo", duration_hours: 2, tier_key: "T2D", anchor: 700, floor: 650, quote_price: 700,
  competition_position: "at anchor", budget: { tier: "none" } } as PricingResult;

test("qualification tier gets the reframe-not-cheaper shape", () => {
  const q = buildGeneratePrompt(c("qualification"), p, "ctx");
  for (const m of ["QUALIFICATION RESPONSE", "BETTER, not cheaper", "ONE strategic binary question"]) assert.ok(q.includes(m), m);
  assert.ok(!buildGeneratePrompt(c("qualification", "high"), p, "ctx").includes("ONE strategic binary question"), "no question at high competition");
  assert.ok(!buildGeneratePrompt(c("standard"), p, "ctx").includes("QUALIFICATION RESPONSE"));
});
