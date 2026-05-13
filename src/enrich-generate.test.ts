import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { enrichClassification } from "./pipeline/enrich.js";
import { setClaudeRequesterForTests } from "./claude.js";
import { generateResponse } from "./pipeline/generate.js";
import { buildGeneratePrompt } from "./prompts/generate.js";
import type { Classification, PricingResult } from "./types.js";

afterEach(() => {
  setClaudeRequesterForTests();
});

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
    event_date_iso: null,
    event_energy: null,
    flagged_concerns: [],
    venue_name: null,
    client_first_name: null,
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
    const result = enrichClassification(c, p, "2026-02-21");
    assert.deepStrictEqual(result, c);
    assert.equal(result.tier, "standard");
    assert.equal(result.close_type, "soft_hold");
  });

  it("returns original when budget.tier is small", () => {
    const c = makeClassification({ tier: "standard" });
    const p = makePricing({ budget: { tier: "small", gap: 50 } });
    const result = enrichClassification(c, p, "2026-02-21");
    assert.deepStrictEqual(result, c);
    assert.equal(result.tier, "standard");
  });

  it("overrides to qualification + hesitant for large tier", () => {
    const c = makeClassification({ tier: "standard", close_type: "soft_hold" });
    const p = makePricing({
      budget: { tier: "large", gap: 150, scoped_alternative: { duration_hours: 1, price: 400 } },
    });
    const result = enrichClassification(c, p, "2026-02-21");
    assert.notEqual(result, c); // New object
    assert.equal(result.tier, "qualification");
    assert.equal(result.close_type, "hesitant");
  });

  it("overrides to qualification + hesitant for no_viable_scope", () => {
    const c = makeClassification({ tier: "premium", close_type: "direct" });
    const p = makePricing({ budget: { tier: "no_viable_scope", gap: 300 } });
    const result = enrichClassification(c, p, "2026-02-21");
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
    const result = enrichClassification(c, p, "2026-02-21");
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
    // Min floor for duo T2P is 850 (1hr)
    assert.ok(prompt.includes("$850"));
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
    const classIdx = prompt.indexOf("<lead_classification>");
    assert.ok(budgetIdx < classIdx, "Budget block must appear before classification");
  });

  it("clarification mode says not to quote and asks for one binary question", () => {
    const c = makeClassification({
      action: "one_question",
      vagueness: "vague",
      format_recommended: "unresolved",
    });
    const p = makePricing({
      format: "unresolved",
      quote_price: 0,
      anchor: 0,
      floor: 0,
      competition_position: "clarify before quoting",
      tier_key: "clarify",
    });
    const prompt = buildGeneratePrompt(c, p, "some context");
    assert.ok(prompt.includes("No quote yet. The format is unresolved."));
    assert.ok(prompt.includes("Ask exactly ONE binary clarifying question."));
    assert.ok(prompt.includes("Do NOT state a price, rate, anchor, floor, or package."));
  });
});

describe("generateResponse — clarification mode", () => {
  const vagueLatinBandLead = "Looking for a Latin band for a birthday party, not sure if I want background music or something more lively.";

  function makeClarificationClassification(): Classification {
    return makeClassification({
      action: "one_question",
      vagueness: "vague",
      format_requested: "Latin band",
      format_recommended: "unresolved",
      flagged_concerns: ["vague format request"],
      client_first_name: "Alondra",
    });
  }

  function makeClarificationPricing(): PricingResult {
    return makePricing({
      format: "unresolved",
      anchor: 0,
      floor: 0,
      quote_price: 0,
      competition_position: "clarify before quoting",
      tier_key: "clarify",
    });
  }

  it("accepts a single-question clarification draft with no pricing", async () => {
    setClaudeRequesterForTests(async () => ({
      id: "msg-test",
      type: "message" as const,
      role: "assistant" as const,
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          reasoning: {
            details_present: [vagueLatinBandLead],
            absences: ["No clear format yet"],
            emotional_core: "They want the right energy without overcommitting",
            cinematic_opening: "A birthday party changes completely once the music locks the room in.",
            validation_line: "You knew this needed more than a generic playlist.",
          },
          full_draft: "Hi Alondra,\n\nA birthday party changes completely once the music locks the room in. You knew this needed more than a generic playlist. Before I point you toward the right setup, are you picturing something intimate and in the background, or more of a featured moment people stop to watch?\n\nAlex Guillen",
          compressed_draft: "Hi Alondra, before I point you toward the right setup, are you picturing something intimate and in the background, or more of a featured moment people stop to watch?\n\nAlex Guillen",
        }),
      }],
      model: "claude-sonnet-4-6",
      stop_reason: "end_turn" as const,
      stop_sequence: null,
      usage: { input_tokens: 10, output_tokens: 10 },
    }) as any);

    const drafts = await generateResponse(
      makeClarificationClassification(),
      makeClarificationPricing(),
      "some context",
    );
    assert.equal((drafts.full_draft.match(/\?/g) ?? []).length, 1);
    assert.equal((drafts.compressed_draft.match(/\?/g) ?? []).length, 1);
    assert.ok(!/\$\s?\d|\brate\b/i.test(drafts.full_draft));
    assert.ok(!/\$\s?\d|\brate\b/i.test(drafts.compressed_draft));
  });

  it("rejects clarification drafts that include pricing", async () => {
    setClaudeRequesterForTests(async () => ({
      id: "msg-test",
      type: "message" as const,
      role: "assistant" as const,
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          reasoning: {
            details_present: [vagueLatinBandLead],
            absences: ["No clear format yet"],
            emotional_core: "They want the right energy without overcommitting",
            cinematic_opening: "A birthday party changes completely once the music locks the room in.",
            validation_line: "You knew this needed more than a generic playlist.",
          },
          full_draft: "Hi Alondra,\n\nA birthday party changes completely once the music locks the room in. My rate starts at $1200. Are you picturing something intimate and in the background, or more of a featured moment people stop to watch?\n\nAlex Guillen",
          compressed_draft: "Hi Alondra, my rate starts at $1200. Are you picturing something intimate and in the background, or more of a featured moment people stop to watch?\n\nAlex Guillen",
        }),
      }],
      model: "claude-sonnet-4-6",
      stop_reason: "end_turn" as const,
      stop_sequence: null,
      usage: { input_tokens: 10, output_tokens: 10 },
    }) as any);

    await assert.rejects(
      () => generateResponse(
        makeClarificationClassification(),
        makeClarificationPricing(),
        "some context",
      ),
      /must not include pricing language/,
    );
  });

  it("rejects clarification drafts that do not contain exactly one question", async () => {
    setClaudeRequesterForTests(async () => ({
      id: "msg-test",
      type: "message" as const,
      role: "assistant" as const,
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          reasoning: {
            details_present: [vagueLatinBandLead],
            absences: ["No clear format yet"],
            emotional_core: "They want the right energy without overcommitting",
            cinematic_opening: "A birthday party changes completely once the music locks the room in.",
            validation_line: "You knew this needed more than a generic playlist.",
          },
          full_draft: "Hi Alondra,\n\nA birthday party changes completely once the music locks the room in. You knew this needed more than a generic playlist. Tell me more about what you want.\n\nAlex Guillen",
          compressed_draft: "Hi Alondra, tell me more about what you want.\n\nAlex Guillen",
        }),
      }],
      model: "claude-sonnet-4-6",
      stop_reason: "end_turn" as const,
      stop_sequence: null,
      usage: { input_tokens: 10, output_tokens: 10 },
    }) as any);

    await assert.rejects(
      () => generateResponse(
        makeClarificationClassification(),
        makeClarificationPricing(),
        "some context",
      ),
      /must contain exactly one question/,
    );
  });
});
