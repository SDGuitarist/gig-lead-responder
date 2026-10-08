import { GUT_CHECK_KEYS } from "./types.js";
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { setClaudeRequesterForTests } from "./claude.js";
import { runPipeline, runEditPipeline } from "./run-pipeline.js";
import type { Classification, PricingResult } from "./types.js";

// Mock Claude to return valid classification + generation + verification
const MOCK_CLASSIFICATION = {
  mode: "evaluation",
  action: "quote",
  vagueness: "clear",
  competition_level: "medium",
  competition_quote_count: 3,
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
  event_date_iso: null,
  timeline_band: "comfortable",
  close_type: "soft_hold",
  cultural_context_active: false,
  cultural_tradition: null,
  planner_effort_active: false,
  social_proof_active: false,
  context_modifiers: [],
  event_energy: null,
  flagged_concerns: [],
  venue_name: null,
  client_first_name: "Sarah",
};

const MOCK_GENERATION = {
  reasoning: {
    details_present: ["date", "duration"],
    absences: [],
    emotional_core: "excitement about their event",
    cinematic_opening: "What a wonderful celebration",
    validation_line: "You've got a great eye for what this evening needs",
  },
  full_draft: "Hi Sarah, your evening is going to be something special. I'm available and ready to hold the date. Alex Guillen",
  compressed_draft: "Hi Sarah, I'm available for your event. Want me to hold the date? Alex Guillen",
};

const MOCK_GATE_PASS = {
  scene_quote: "your evening is going to be something special",
  scene_type: "cinematic",
  competitor_test: false,
  gut_checks: Object.fromEntries(GUT_CHECK_KEYS.map((k) => [k, true])),
  gate_status: "pass",
  fail_reasons: [],
  concern_traceability: [],
  best_line: "your evening is going to be something special",
  validation_line: "You've got a great eye for what this evening needs",
};

const MOCK_GATE_FAIL = {
  scene_quote: "your evening is going to be something special",
  scene_type: "cinematic",
  competitor_test: false,
  gut_checks: Object.fromEntries(GUT_CHECK_KEYS.map((k) => [k, true])),
  gate_status: "fail",
  fail_reasons: ["Missing pricing mention"],
  concern_traceability: [],
  best_line: "your evening is going to be something special",
  validation_line: "You've got a great eye for what this evening needs",
};

let callCount = 0;

function mockClaudeForPipeline(responses: unknown[]) {
  callCount = 0;
  setClaudeRequesterForTests(async () => {
    const response = responses[callCount % responses.length];
    callCount++;
    return {
      id: "msg-test",
      type: "message" as const,
      role: "assistant" as const,
      content: [{ type: "text" as const, text: JSON.stringify(response), citations: null }],
      model: "claude-sonnet-4-6",
      stop_reason: "end_turn" as const,
      stop_sequence: null,
      usage: {
        input_tokens: 100,
        output_tokens: 100,
        cache_creation_input_tokens: null,
        cache_read_input_tokens: null,
      },
    };
  });
}

describe("runPipeline", () => {
  after(() => {
    setClaudeRequesterForTests(); // restore default
  });

  it("truncates raw text over 50k characters", async () => {
    mockClaudeForPipeline([MOCK_CLASSIFICATION, MOCK_GENERATION, MOCK_GATE_PASS]);
    const longText = "A".repeat(60_000);
    const result = await runPipeline(longText);
    // Should complete without error (truncation happened internally)
    assert.ok(result.classification);
  });

  it("returns all pipeline output fields", async () => {
    mockClaudeForPipeline([MOCK_CLASSIFICATION, MOCK_GENERATION, MOCK_GATE_PASS]);
    const result = await runPipeline("I need a guitarist for my wedding on June 15");
    assert.ok(result.classification);
    assert.ok(result.pricing);
    assert.ok(result.drafts);
    assert.ok(result.gate);
    assert.ok(typeof result.verified === "boolean");
    assert.ok(typeof result.confidence_score === "number");
    assert.ok(result.timing);
  });

  it("confidence score is 0-100", async () => {
    mockClaudeForPipeline([MOCK_CLASSIFICATION, MOCK_GENERATION, MOCK_GATE_PASS]);
    const result = await runPipeline("I need a guitarist for my wedding");
    assert.ok(result.confidence_score >= 0);
    assert.ok(result.confidence_score <= 100);
  });

  // R358 (Codex round 1): the strict competition rule needs the caller's platform; if
  // runPipeline stopped passing it, the check would switch off with every unit test green.
  // Round 2: "gigsalad" alone (the Mailgun webhook's call, email text) must NOT turn it on.
  it("port manifest R358 wiring: runPipeline hands the parsed-page flag to the competition check", async () => {
    const text = "Platform: GigSalad\nEvent type: Wedding\nCompetition: not shown on this GigSalad page (unknown)";
    const concerns = async (page?: boolean) => {
      mockClaudeForPipeline([MOCK_CLASSIFICATION, MOCK_GENERATION, MOCK_GATE_PASS]); // model says 3
      return (await runPipeline(text, undefined, "gigsalad", page)).classification.flagged_concerns.join(" ");
    };
    assert.match(await concerns(true), /GigSalad displays no count, so competition_quote_count must be 0, but classification has 3/);
    assert.doesNotMatch(await concerns(undefined), /GigSalad displays/);
  });

  // R058 (Alex option a): the written-price check runs on BOTH drafting paths. If a call site
  // stopped passing pricing, the check would switch off with every unit test green.
  it("port manifest R058 wiring: a draft priced below the floor is not verified, on both paths", async () => {
    const cheap = { ...MOCK_GENERATION, full_draft: "Hi Sarah, two hours is $100. Alex Guillen" };
    mockClaudeForPipeline([MOCK_CLASSIFICATION, cheap, MOCK_GATE_PASS]); // solo T2P 2h: floor $550
    const out = await runPipeline("I need a guitarist for two hours");
    assert.equal(out.verified, false);
    assert.ok(out.gate.fail_reasons.some((r) => r.startsWith("price_below_quote_full: $100")), out.gate.fail_reasons.join(" | "));
    mockClaudeForPipeline([MOCK_CLASSIFICATION, MOCK_GENERATION, MOCK_GATE_PASS]);
    assert.equal((await runPipeline("I need a guitarist for two hours")).verified, true, "control: the same run without the bad price");

    mockClaudeForPipeline([cheap, MOCK_GATE_PASS]);
    const edit = await runEditPipeline(MOCK_CLASSIFICATION as unknown as Classification, out.pricing, "Make it shorter");
    assert.equal(edit.gate.gate_status, "fail");
    assert.ok(edit.gate.fail_reasons.some((r) => r.startsWith("price_below_quote_full: $100")));
  });

  // R295 (Alex 2026-10-07): the minimum-profit note is attached on the FINAL price, so the router
  // holds the lead; a T1 duo at 3h is the case that breaks the $150 floor today.
  it("port manifest R295 wiring: a T1 duo at 3h comes out of runPipeline with the hold note", async () => {
    const t1Duo = { ...MOCK_CLASSIFICATION, format_recommended: "duo", rate_card_tier: "T1", duration_hours: 3, tier: "standard" };
    mockClaudeForPipeline([t1Duo, MOCK_GENERATION, MOCK_GATE_PASS]);
    const out = await runPipeline("Duo for three hours");
    assert.equal(out.pricing.tier_key, "T1", "control: priced at T1");
    assert.ok(out.classification.flagged_concerns.some((f) => f.startsWith("minimum_profit: T1 duo 3h")), out.classification.flagged_concerns.join(" | "));
    mockClaudeForPipeline([MOCK_CLASSIFICATION, MOCK_GENERATION, MOCK_GATE_PASS]);
    assert.ok(!(await runPipeline("Solo for two hours")).classification.flagged_concerns.some((f) => f.startsWith("minimum_profit:")));
  });

  it("returns verified: true when gate passes", async () => {
    mockClaudeForPipeline([MOCK_CLASSIFICATION, MOCK_GENERATION, MOCK_GATE_PASS]);
    const result = await runPipeline("I need a guitarist");
    assert.equal(result.verified, true);
  });

  it("returns verified: false when gate fails after retries", async () => {
    mockClaudeForPipeline([
      MOCK_CLASSIFICATION,
      MOCK_GENERATION, MOCK_GATE_FAIL,  // attempt 1
      MOCK_GENERATION, MOCK_GATE_FAIL,  // retry 1
      MOCK_GENERATION, MOCK_GATE_FAIL,  // retry 2
    ]);
    const result = await runPipeline("I need a guitarist");
    assert.equal(result.verified, false);
  });

  it("timing includes total and classify keys", async () => {
    mockClaudeForPipeline([MOCK_CLASSIFICATION, MOCK_GENERATION, MOCK_GATE_PASS]);
    const result = await runPipeline("I need a guitarist");
    assert.ok(typeof result.timing.total === "number");
    assert.ok(typeof result.timing.classify === "number");
  });

  it("stamps platform when provided", async () => {
    mockClaudeForPipeline([MOCK_CLASSIFICATION, MOCK_GENERATION, MOCK_GATE_PASS]);
    const result = await runPipeline("GigSalad lead", undefined, "gigsalad");
    assert.equal(result.classification.platform, "gigsalad");
  });

  it("onStage callback receives stage events", async () => {
    mockClaudeForPipeline([MOCK_CLASSIFICATION, MOCK_GENERATION, MOCK_GATE_PASS]);
    const events: any[] = [];
    await runPipeline("I need a guitarist", (event) => events.push(event));
    // Should have events for stages 1-5
    const stages = new Set(events.map((e) => e.stage));
    assert.ok(stages.has(1), "Should have classify stage");
    assert.ok(stages.has(2), "Should have price stage");
  });

  it("sanitizes invalid event_date_iso from LLM", async () => {
    const classWithBadDate = { ...MOCK_CLASSIFICATION, event_date_iso: "March 22" };
    mockClaudeForPipeline([classWithBadDate, MOCK_GENERATION, MOCK_GATE_PASS]);
    const result = await runPipeline("Wedding on March 22");
    assert.equal(result.classification.event_date_iso, null);
  });

  it("sanitizes empty venue_name to null", async () => {
    const classWithEmpty = { ...MOCK_CLASSIFICATION, venue_name: "" };
    mockClaudeForPipeline([classWithEmpty, MOCK_GENERATION, MOCK_GATE_PASS]);
    const result = await runPipeline("Lead text");
    assert.equal(result.classification.venue_name, null);
  });

  it("adds classification verification warnings for obvious raw-text mismatches", async () => {
    const mismatch = { ...MOCK_CLASSIFICATION, format_recommended: "solo", flagged_concerns: [] };
    mockClaudeForPipeline([mismatch, MOCK_GENERATION, MOCK_GATE_PASS]);
    const result = await runPipeline("Need a mariachi band for Saturday.");
    assert.ok(
      result.classification.flagged_concerns.some((warning) => warning.includes("mentions mariachi")),
    );
  });

  it("supports clarification-first leads with unresolved format", async () => {
    const clarificationClassification = {
      ...MOCK_CLASSIFICATION,
      action: "one_question",
      vagueness: "vague",
      format_recommended: "unresolved",
    };
    const clarificationGeneration = {
      reasoning: {
        details_present: ["Latin band", "birthday"],
        absences: ["No clear format yet"],
        emotional_core: "They want the right energy without boxing themselves into the wrong setup",
        cinematic_opening: "A birthday changes the second the music shifts the room from polite to alive.",
        validation_line: "You knew this needed more than a generic playlist.",
      },
      full_draft: "Hi Sarah, a birthday changes the second the music shifts the room from polite to alive. You knew this needed more than a generic playlist. Before I point you toward the right setup, are you picturing something intimate and in the background, or more of a featured moment people stop to watch? Alex Guillen",
      compressed_draft: "Hi Sarah, before I point you toward the right setup, are you picturing something intimate and in the background, or more of a featured moment people stop to watch? Alex Guillen",
    };
    mockClaudeForPipeline([clarificationClassification, clarificationGeneration, MOCK_GATE_PASS]);
    const result = await runPipeline("Looking for a Latin band for a birthday.");
    assert.equal(result.classification.format_recommended, "unresolved");
    assert.equal(result.pricing.quote_price, 0);
    assert.equal(result.pricing.competition_position, "clarify before quoting");
  });
});
