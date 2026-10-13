import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { setClaudeRequesterForTests } from "./claude.js";
import { runPipeline, runEditPipeline } from "./run-pipeline.js";
import { lookupPrice } from "./pipeline/price.js";
import { COI_SENTENCES } from "./pipeline/coi.js";
import { PAYMENT_SENTENCES } from "./pipeline/payment-terms.js";
import { GUT_CHECK_KEYS, type Classification } from "./types.js";

// COI plan Revision 3c, step 4 (C10): the app's COI sentence is chosen once per run and confirmed on BOTH drafting
// paths. The model is stubbed; every run injects `today`.
const DEFAULT = COI_SENTENCES.default;
const REQUIRED = COI_SENTENCES.required;
const { full } = PAYMENT_SENTENCES;

const LEAD: Partial<Classification> = {
  mode: "evaluation", action: "quote", vagueness: "clear", competition_level: "medium", competition_quote_count: 3,
  stealth_premium: false, stealth_premium_signals: [], tier: "standard", rate_card_tier: "T2", lead_source_column: "D",
  price_point: "slight_premium", format_requested: "guitarist", format_recommended: "solo", duration_hours: 2,
  stated_budget: null, event_date_iso: "2026-10-25", timeline_band: "short", close_type: "soft_hold",
  cultural_context_active: false, cultural_tradition: null, planner_effort_active: false, social_proof_active: false,
  context_modifiers: [], event_energy: null, flagged_concerns: [], venue_name: null, client_first_name: "Sarah",
};
const gen = (coi: string) => ({
  reasoning: { details_present: ["date"], absences: [], emotional_core: "a good night", cinematic_opening: "A good night.",
    validation_line: "Good call." },
  full_draft: `Hi Sarah, a good night. Solo guitar, $650, 2 hours. ${full} ${coi}\nAlex Guillen`,
  compressed_draft: `Hi Sarah. Solo guitar, $650, 2 hours. ${full} ${coi}\nAlex Guillen`,
});
const gate = {
  scene_quote: "a good night", scene_type: "cinematic", competitor_test: false,
  gut_checks: Object.fromEntries(GUT_CHECK_KEYS.map((k) => [k, true])), gate_status: "pass",
  fail_reasons: [], concern_traceability: [], best_line: "a good night", validation_line: "Good call.",
};
let systems: string[] = [];
function stub(responses: unknown[]) {
  let n = 0;
  systems = [];
  setClaudeRequesterForTests(async (request) => {
    systems.push(String((request as { system?: unknown }).system ?? ""));
    const text = JSON.stringify(responses[n++ % responses.length]);
    return { id: "m", type: "message" as const, role: "assistant" as const, content: [{ type: "text" as const, text, citations: null }],
      model: "stub", stop_reason: "end_turn" as const, stop_sequence: null,
      usage: { input_tokens: 1, output_tokens: 1, cache_creation_input_tokens: null, cache_read_input_tokens: null } };
  });
}
const generatePrompts = () => systems.filter((s) => s.includes("**Quote Terms"));
const coiFlags = (reasons: string[]) => reasons.filter((r) => r.startsWith("coi_")).map((r) => r.split(":")[0]);
const BOTH_MISSING = ["coi_sentence_missing_full", "coi_sentence_missing_compressed"];

describe("COI C10: the sentence is chosen once and confirmed on both paths", () => {
  after(() => setClaudeRequesterForTests());

  it("COI C10 runPipeline: a draft with no COI sentence is flagged in both drafts and not verified", async () => {
    stub([LEAD, gen(""), gate]);
    const out = await runPipeline("lead", undefined, undefined, undefined, "2026-10-11");
    assert.deepEqual(coiFlags(out.gate.fail_reasons), BOTH_MISSING);
    assert.equal(out.verified, false);
    assert.ok(generatePrompts()[0].includes(`"${DEFAULT}"`), "the prompt carries the default sentence");
  });

  it("COI C10 runPipeline positive control: the default sentence once in each draft raises no COI flag", async () => {
    stub([LEAD, gen(DEFAULT), gate]);
    const out = await runPipeline("lead", undefined, undefined, undefined, "2026-10-11");
    assert.deepEqual(coiFlags(out.gate.fail_reasons), []);
  });

  it("COI C10 runPipeline: a lead that says the client requires a COI is asked for, and held to, the required sentence", async () => {
    stub([{ ...LEAD, coi_required: true }, gen(DEFAULT), gate]);
    const out = await runPipeline("lead", undefined, undefined, undefined, "2026-10-11");
    assert.ok(generatePrompts()[0].includes(`"${REQUIRED}"`), "the prompt carries the required sentence");
    assert.deepEqual(coiFlags(out.gate.fail_reasons), BOTH_MISSING, "the default sentence is not the required one");
    stub([{ ...LEAD, coi_required: true }, gen(REQUIRED), gate]);
    const ok = await runPipeline("lead", undefined, undefined, undefined, "2026-10-11");
    assert.deepEqual(coiFlags(ok.gate.fail_reasons), [], "the required sentence once, though it holds COI and liability insurance");
  });

  it("COI C10 runEditPipeline: the same flags, from the same function", async () => {
    const c = LEAD as Classification;
    stub([gen(""), gate]);
    const bad = await runEditPipeline({ ...c }, lookupPrice(c), "shorter", "2026-10-11");
    assert.deepEqual(coiFlags(bad.gate.fail_reasons), BOTH_MISSING);
    assert.ok(generatePrompts()[0].includes(`"${DEFAULT}"`));
    stub([gen(DEFAULT), gate]);
    const ok = await runEditPipeline({ ...c }, lookupPrice(c), "shorter", "2026-10-11");
    assert.deepEqual(coiFlags(ok.gate.fail_reasons), []);
  });

  it("COI C10 runEditPipeline: a stored classification that never had coi_required is the default sentence", async () => {
    const c = { ...LEAD } as Classification;
    delete (c as { coi_required?: boolean }).coi_required;
    stub([gen(DEFAULT), gate]);
    const out = await runEditPipeline(c, lookupPrice(c), "shorter", "2026-10-11");
    assert.ok(generatePrompts()[0].includes(`"${DEFAULT}"`));
    assert.deepEqual(coiFlags(out.gate.fail_reasons), []);
  });

  it("COI C10 a graceful decline has no COI line and no COI flag, even with no sentence in the drafts", async () => {
    stub([{ ...LEAD, graceful_decline: true }, gen(""), gate]);
    const out = await runPipeline("lead", undefined, undefined, undefined, "2026-10-11");
    assert.ok(!generatePrompts()[0].includes("- COI: use this sentence"), "no COI line in the prompt");
    assert.deepEqual(coiFlags(out.gate.fail_reasons), []);
  });
});
