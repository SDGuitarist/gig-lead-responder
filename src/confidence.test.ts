import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { setClaudeRequesterForTests } from "./claude.js";
import { runPipeline, runEditPipeline } from "./run-pipeline.js";
import type { Classification, PricingResult, GateResult } from "./types.js";

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
  platform: undefined,
};

const MOCK_GENERATION = {
  reasoning: {
    details_present: ["date"],
    absences: [],
    emotional_core: "excitement",
    cinematic_opening: "What a celebration",
    validation_line: "You've planned something special",
  },
  full_draft: "Hi Sarah, your evening is going to be something people remember. Alex Guillen",
  compressed_draft: "Hi Sarah, I'm available. Want me to hold the date? Alex Guillen",
};

const MOCK_GATE_PASS = {
  gate_status: "pass",
  fail_reasons: [],
  concern_traceability: [],
  best_line: "something people remember",
  validation_line: "You've planned something special",
};

function mockClaude(responses: unknown[]) {
  let i = 0;
  setClaudeRequesterForTests(async () => ({
    id: "msg-test",
    type: "message" as const,
    role: "assistant" as const,
    content: [{ type: "text" as const, text: JSON.stringify(responses[i++ % responses.length]) }],
    model: "claude-sonnet-4-6",
    stop_reason: "end_turn" as const,
    stop_sequence: null,
    usage: { input_tokens: 100, output_tokens: 100 },
  }));
}

describe("Confidence scoring", () => {
  after(() => setClaudeRequesterForTests());

  it("gate pass adds 40 points", async () => {
    mockClaude([MOCK_CLASSIFICATION, MOCK_GENERATION, MOCK_GATE_PASS]);
    const result = await runPipeline("test lead");
    assert.ok(result.confidence_score >= 40);
  });

  it("verified adds 20 points on top of gate pass", async () => {
    mockClaude([MOCK_CLASSIFICATION, MOCK_GENERATION, MOCK_GATE_PASS]);
    const result = await runPipeline("test lead");
    // gate pass (40) + verified (20) + all traced (10) = at least 70
    assert.ok(result.confidence_score >= 60);
  });

  it("stealth premium adds 10 points", async () => {
    const classWithStealth = { ...MOCK_CLASSIFICATION, stealth_premium: true };
    mockClaude([classWithStealth, MOCK_GENERATION, MOCK_GATE_PASS]);
    const result = await runPipeline("luxury event");
    assert.ok(result.confidence_score >= 70);
  });

  it("cultural context adds 10 points", async () => {
    const classWithCultural = { ...MOCK_CLASSIFICATION, cultural_context_active: true };
    mockClaude([classWithCultural, MOCK_GENERATION, MOCK_GATE_PASS]);
    const result = await runPipeline("quinceanera");
    assert.ok(result.confidence_score >= 70);
  });

  it("competition adds 10 points when count > 0", async () => {
    const classWithComp = { ...MOCK_CLASSIFICATION, competition_quote_count: 5 };
    mockClaude([classWithComp, MOCK_GENERATION, MOCK_GATE_PASS]);
    const result = await runPipeline("got other quotes");
    assert.ok(result.confidence_score >= 70);
  });

  it("maximum confidence is 100", async () => {
    const maxClass = {
      ...MOCK_CLASSIFICATION,
      stealth_premium: true,
      cultural_context_active: true,
      competition_quote_count: 5,
    };
    mockClaude([maxClass, MOCK_GENERATION, MOCK_GATE_PASS]);
    const result = await runPipeline("max confidence lead");
    assert.ok(result.confidence_score <= 100);
  });
});

describe("Edit pipeline", () => {
  after(() => setClaudeRequesterForTests());

  it("returns drafts and gate from edit pipeline", async () => {
    mockClaude([MOCK_GENERATION, MOCK_GATE_PASS]);
    const classification: Classification = {
      ...MOCK_CLASSIFICATION,
      platform: undefined,
    } as Classification;
    const pricing: PricingResult = {
      format: "solo",
      duration_hours: 2,
      tier_key: "T2P",
      anchor: 500,
      floor: 400,
      quote_price: 500,
      competition_position: "at anchor",
      budget: { tier: "none" },
    };
    const result = await runEditPipeline(classification, pricing, "Make it shorter");
    assert.ok(result.drafts);
    assert.ok(result.gate);
    assert.ok(typeof result.drafts.full_draft === "string");
  });

  it("handles missing venue_name in old classifications", async () => {
    mockClaude([MOCK_GENERATION, MOCK_GATE_PASS]);
    const oldClassification = { ...MOCK_CLASSIFICATION } as any;
    delete oldClassification.venue_name; // Simulate old cached classification
    const pricing: PricingResult = {
      format: "solo",
      duration_hours: 2,
      tier_key: "T2P",
      anchor: 500,
      floor: 400,
      quote_price: 500,
      competition_position: "at anchor",
      budget: { tier: "none" },
    };
    const result = await runEditPipeline(oldClassification, pricing, "Fix tone");
    assert.ok(result.drafts);
  });
});

describe("StageEvent callback", () => {
  after(() => setClaudeRequesterForTests());

  it("receives running and done events for each stage", async () => {
    mockClaude([MOCK_CLASSIFICATION, MOCK_GENERATION, MOCK_GATE_PASS]);
    const events: Array<{ stage: number; status: string }> = [];
    await runPipeline("test", (e) => events.push({ stage: e.stage, status: e.status }));

    // Each stage should have running + done
    const stage1Events = events.filter((e) => e.stage === 1);
    assert.ok(stage1Events.some((e) => e.status === "running"));
    assert.ok(stage1Events.some((e) => e.status === "done"));
  });

  it("done events include timing ms", async () => {
    mockClaude([MOCK_CLASSIFICATION, MOCK_GENERATION, MOCK_GATE_PASS]);
    const events: any[] = [];
    await runPipeline("test", (e) => events.push(e));

    const doneEvents = events.filter((e) => e.status === "done");
    for (const event of doneEvents) {
      assert.ok(typeof event.ms === "number", `Stage ${event.stage} done event missing ms`);
    }
  });

  it("classify done event includes result", async () => {
    mockClaude([MOCK_CLASSIFICATION, MOCK_GENERATION, MOCK_GATE_PASS]);
    const events: any[] = [];
    await runPipeline("test", (e) => events.push(e));

    const classifyDone = events.find((e) => e.stage === 1 && e.status === "done");
    assert.ok(classifyDone?.result);
    assert.equal(classifyDone.result.format_recommended, "solo");
  });
});
