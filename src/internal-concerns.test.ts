import { test } from "node:test";
import assert from "node:assert/strict";
import { buildGeneratePrompt } from "./prompts/generate.js";
import { buildVerifyPrompt } from "./prompts/verify.js";
import { lookupPrice } from "./pipeline/price.js";
import type { Classification } from "./types.js";

// Hold notes (classification_verify: ..., graceful_decline: ...) ride in flagged_concerns
// so the router holds the lead (any flagged concern holds). They are notes for Alex,
// not concerns the draft must answer: generate and verify never see them.
const INTERNAL = ["classification_verify: Tier A venue Hotel del Coronado but priced at T2",
  "graceful_decline: format/fit or sensitivity trigger; Alex reviews before it goes out"];
const cl = { mode: "evaluation", action: "quote", vagueness: "clear", competition_level: "low", competition_quote_count: 0,
  stealth_premium: false, stealth_premium_signals: [], tier: "standard", rate_card_tier: "T2", lead_source_column: "P",
  price_point: "full_premium", format_requested: "guitarist", format_recommended: "solo", duration_hours: 2,
  stated_budget: null, timeline_band: "comfortable", close_type: "soft_hold", cultural_context_active: false,
  cultural_tradition: null, planner_effort_active: false, social_proof_active: false, context_modifiers: [],
  event_date_iso: null, event_energy: null, flagged_concerns: [...INTERNAL, "Outdoor venue, no power listed"],
  venue_name: null, client_first_name: null, platform: "yelp" } as unknown as Classification;

test("internal hold notes never reach the draft or the gate", () => {
  const pricing = lookupPrice(cl);
  for (const [name, prompt] of [["generate", buildGeneratePrompt(cl, pricing, "ctx")], ["verify", buildVerifyPrompt(cl, pricing)]]) {
    assert.ok(prompt.includes("Outdoor venue, no power listed"), `${name}: control, a real concern still reaches it`);
    for (const note of INTERNAL) assert.ok(!prompt.includes(note), `${name}: ${note.slice(0, 30)}`);
  }
});
