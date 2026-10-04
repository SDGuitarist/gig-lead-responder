import { test } from "node:test";
import assert from "node:assert/strict";
import { buildGeneratePrompt } from "./prompts/generate.js";
import type { Classification, PricingResult } from "./types.js";

// Port manifest R340: the compressed draft keeps at least one fear resolution,
// and for sourced or hybrid leads one sentence of curation credibility.
const c = (mode: string) =>
  ({ mode: "evaluation", action: "quote", vagueness: "clear", competition_level: "high", competition_quote_count: 7,
     stealth_premium: false, stealth_premium_signals: [], tier: "standard", rate_card_tier: "T2", lead_source_column: "D",
     price_point: "at_market", format_requested: "mariachi", format_recommended: "mariachi_full", duration_hours: 2,
     stated_budget: null, timeline_band: "comfortable", close_type: "soft_hold", cultural_context_active: false,
     cultural_tradition: null, planner_effort_active: false, social_proof_active: false, context_modifiers: [],
     event_date_iso: null, event_energy: null, flagged_concerns: [], venue_name: null, client_first_name: null,
     delivery_mode: mode }) as unknown as Classification;
const p = { format: "mariachi_full", duration_hours: 2, tier_key: "T2D", anchor: 1900, floor: 1750, quote_price: 1800,
  competition_position: "near floor", budget: { tier: "none" } } as PricingResult;
const retain = (prompt: string) => prompt.split("\n").find((l) => l.startsWith("- Must retain:")) ?? "";

test("compressed draft retains a fear resolution, plus curation credibility when sourced", () => {
  assert.match(retain(buildGeneratePrompt(c("alex_sources"), p, "ctx")), /fear resolution.*curation credibility/);
  const performs = retain(buildGeneratePrompt(c("alex_performs"), p, "ctx"));
  assert.match(performs, /fear resolution/);
  assert.doesNotMatch(performs, /curation credibility/);
});
