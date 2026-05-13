import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildVerifyPrompt } from "./prompts/verify.js";
import type { Classification } from "./types.js";

function makeClassification(): Classification {
  return {
    mode: "evaluation",
    action: "quote",
    vagueness: "clear",
    competition_level: "medium",
    competition_quote_count: 2,
    stealth_premium: false,
    stealth_premium_signals: [],
    tier: "standard",
    rate_card_tier: "T2",
    lead_source_column: "P",
    price_point: "slight_premium",
    format_requested: "solo guitar",
    format_recommended: "solo",
    duration_hours: 2,
    stated_budget: null,
    event_date_iso: null,
    timeline_band: "comfortable",
    close_type: "soft_hold",
    event_energy: null,
    cultural_context_active: false,
    cultural_tradition: null,
    planner_effort_active: false,
    social_proof_active: false,
    context_modifiers: [],
    flagged_concerns: [],
    venue_name: null,
    client_first_name: "Sam",
  };
}

describe("buildVerifyPrompt", () => {
  it("includes voice calibration references for sounds_like_alex", () => {
    const prompt = buildVerifyPrompt(makeClassification(), { budget: { tier: "none" } });
    assert.match(prompt, /VOICE CALIBRATION REFERENCES/);
    assert.match(prompt, /Patterson/);
    assert.match(prompt, /Sparse Cocktail/);
  });
});
