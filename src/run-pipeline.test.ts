import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { setClaudeRequesterForTests } from "./claude.js";
import { runPipeline } from "./run-pipeline.js";
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
    validation_line: "I'd love to be part of your special day",
  },
  full_draft: "Hi Sarah, I'd love to perform at your event. Alex Guillen",
  compressed_draft: "Hi Sarah, let's make it happen. Alex Guillen",
};

const MOCK_GATE_PASS = {
  gate_status: "pass",
  fail_reasons: [],
  concern_traceability: [],
  best_line: "I'd love to perform",
  validation_line: "your special day",
};

const MOCK_GATE_FAIL = {
  gate_status: "fail",
  fail_reasons: ["Missing pricing mention"],
  concern_traceability: [],
  best_line: "I'd love to perform",
  validation_line: "your special day",
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
      content: [{ type: "text" as const, text: JSON.stringify(response) }],
      model: "claude-sonnet-4-6",
      stop_reason: "end_turn" as const,
      stop_sequence: null,
      usage: { input_tokens: 100, output_tokens: 100 },
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
});
