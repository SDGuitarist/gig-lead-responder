import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { enrichClassification } from "./pipeline/enrich.js";
import { buildGeneratePrompt } from "./prompts/generate.js";
import type { Classification, PricingResult } from "./types.js";

// Minimal classification fixture for testing
function makeClassification(overrides: Partial<Classification> = {}): Classification {
  return {
    mode: "evaluation",
    action: "quote",
    vagueness: "clear",
    competition_level: "medium",
    competition_quote_count: 5,
    stealth_premium: false,
    stealth_premium_signals: [],
    tier: "standard",
    rate_card_tier: "T2",
    lead_source_column: "P",
    price_point: "slight_premium",
    format_requested: "guitarist",
    format_recommended: "solo",
    duration_hours: 2,
    stated_budget: null,
    timeline_band: "comfortable",
    close_type: "soft_hold",
    cultural_context_active: false,
    cultural_tradition: null,
    planner_effort_active: false,
    social_proof_active: false,
    context_modifiers: [],
    flagged_concerns: [],
    ...overrides,
  };
}

function makePricing(overrides: Partial<PricingResult> = {}): PricingResult {
  return {
    format: "solo",
    duration_hours: 2,
    tier_key: "T2P",
    anchor: 500,
    floor: 400,
    quote_price: 500,
    competition_position: "at anchor, willing to flex",
    budget: { tier: "none" },
    ...overrides,
  };
}

// --- enrichClassification ---

describe("enrichClassification", () => {
  it("returns original when budget.tier is none", () => {
    const c = makeClassification({ tier: "standard", close_type: "soft_hold" });
    const p = makePricing({ budget: { tier: "none" } });
    const result = enrichClassification(c, p);
    assert.equal(result, c); // Same reference — no copy
    assert.equal(result.tier, "standard");
    assert.equal(result.close_type, "soft_hold");
  });

  it("returns original when budget.tier is small", () => {
    const c = makeClassification({ tier: "standard" });
    const p = makePricing({ budget: { tier: "small", gap: 50 } });
    const result = enrichClassification(c, p);
    assert.equal(result, c); // Same reference
    assert.equal(result.tier, "standard");
  });

  it("overrides to qualification + hesitant for large tier", () => {
    const c = makeClassification({ tier: "standard", close_type: "soft_hold" });
    const p = makePricing({
      budget: { tier: "large", gap: 150, scoped_alternative: { duration_hours: 1, price: 400 } },
    });
    const result = enrichClassification(c, p);
    assert.notEqual(result, c); // New object
    assert.equal(result.tier, "qualification");
    assert.equal(result.close_type, "hesitant");
  });

  it("overrides to qualification + hesitant for no_viable_scope", () => {
    const c = makeClassification({ tier: "premium", close_type: "direct" });
    const p = makePricing({ budget: { tier: "no_viable_scope", gap: 300 } });
    const result = enrichClassification(c, p);
    assert.notEqual(result, c);
    assert.equal(result.tier, "qualification");
    assert.equal(result.close_type, "hesitant");
  });

  it("preserves all other classification fields when overriding", () => {
    const c = makeClassification({
      tier: "standard",
      format_recommended: "duo",
      stealth_premium: true,
    });
    const p = makePricing({ budget: { tier: "no_viable_scope", gap: 300 } });
    const result = enrichClassification(c, p);
    assert.equal(result.format_recommended, "duo");
    assert.equal(result.stealth_premium, true);
  });
});

// --- buildGeneratePrompt budget mode injection ---

describe("buildGeneratePrompt — budget mode", () => {
  it("no budget block when tier is none", () => {
    const c = makeClassification();
    const p = makePricing();
    const prompt = buildGeneratePrompt(c, p, "some context");
    assert.ok(!prompt.includes("BUDGET MODE"));
  });

  it("small gap block present with correct values", () => {
    const c = makeClassification({ stated_budget: 475 });
    const p = makePricing({
      quote_price: 500,
      budget: { tier: "small", gap: 25 },
    });
    const prompt = buildGeneratePrompt(c, p, "some context");
    assert.ok(prompt.includes("BUDGET MODE: SMALL GAP"));
    assert.ok(prompt.includes("$475"));
    assert.ok(prompt.includes("$500"));
    assert.ok(prompt.includes("$25"));
  });

  it("large gap block includes scoped alternative", () => {
    const c = makeClassification({ stated_budget: 400 });
    const p = makePricing({
      floor: 500,
      quote_price: 550,
      duration_hours: 2,
      budget: {
        tier: "large",
        gap: 100,
        scoped_alternative: { duration_hours: 1, price: 400 },
      },
    });
    const prompt = buildGeneratePrompt(c, p, "some context");
    assert.ok(prompt.includes("BUDGET MODE: LARGE GAP"));
    assert.ok(prompt.includes("1hr set starts at $400"));
    assert.ok(prompt.includes("full 2hr set"));
  });

  it("no_viable_scope block includes min floor and warm redirect", () => {
    const c = makeClassification({ stated_budget: 250, format_recommended: "duo" });
    const p = makePricing({
      format: "duo",
      tier_key: "T2P",
      budget: { tier: "no_viable_scope", gap: 350 },
    });
    const prompt = buildGeneratePrompt(c, p, "some context");
    assert.ok(prompt.includes("BUDGET MODE: NO VIABLE SCOPE"));
    assert.ok(prompt.includes("warm redirect"));
    assert.ok(prompt.includes("50-75 words"));
    // Min floor for duo T2P is 600 (2hr)
    assert.ok(prompt.includes("$600"));
  });

  it("no_viable_scope on GigSalad includes platform-safe close", () => {
    const c = makeClassification({
      stated_budget: 250,
      format_recommended: "duo",
      platform: "gigsalad",
    });
    const p = makePricing({
      format: "duo",
      tier_key: "T2P",
      budget: { tier: "no_viable_scope", gap: 350 },
    });
    const prompt = buildGeneratePrompt(c, p, "some context");
    assert.ok(prompt.includes("find me here on GigSalad"));
  });

  it("budget mode overrides stealth premium (block appears at top)", () => {
    const c = makeClassification({ stated_budget: 400, stealth_premium: true });
    const p = makePricing({ budget: { tier: "small", gap: 50 } });
    const prompt = buildGeneratePrompt(c, p, "some context");
    assert.ok(prompt.includes("OVERRIDES STEALTH PREMIUM"));
    // Budget block appears before the classification section
    const budgetIdx = prompt.indexOf("BUDGET MODE");
    const classIdx = prompt.indexOf("## CLASSIFICATION");
    assert.ok(budgetIdx < classIdx, "Budget block must appear before classification");
  });
});
