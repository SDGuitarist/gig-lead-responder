import { test } from "node:test";
import assert from "node:assert/strict";
import { setClaudeRequesterForTests } from "./claude.js";
import { classifyLead, normalizeCoiRequired } from "./pipeline/classify.js";
import { buildClassifyPrompt } from "./prompts/classify.js";

// COI plan (docs/plans/2026-10-12-feat-coi-sentence-by-request-plan.md), step 1: Classification.coi_required.
// Alex's trigger (2026-10-12): the timeline sentence only when the client SAYS they require a COI. Only a real
// boolean true counts, so an absent or odd value is false (R2-3), like price_asked.
const valid = {
  mode: "evaluation", action: "quote", vagueness: "clear", competition_level: "low", competition_quote_count: 0,
  stealth_premium: false, stealth_premium_signals: [], tier: "standard", rate_card_tier: "T2", lead_source_column: "P",
  price_point: "full_premium", format_requested: "guitarist", format_recommended: "solo", duration_hours: 2,
  stated_budget: null, event_date_iso: null, timeline_band: "comfortable", close_type: "soft_hold", event_energy: null,
  cultural_context_active: false, cultural_tradition: null, planner_effort_active: false, social_proof_active: false,
  context_modifiers: [], flagged_concerns: [], venue_name: null, client_first_name: null,
};
async function run(out: Record<string, unknown>) {
  setClaudeRequesterForTests((async () => ({ id: "m", type: "message", role: "assistant", model: "t", stop_reason: "end_turn",
    stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 },
    content: [{ type: "text", text: JSON.stringify(out) }] })) as never);
  try { return await classifyLead("lead text", "2026-10-12"); } finally { setClaudeRequesterForTests(); }
}

test("COI C11 normalizeCoiRequired: only a real boolean true counts", () => {
  assert.equal(normalizeCoiRequired(true), true);
  for (const v of [false, undefined, null, "true", "yes", 1, 0, {}, []]) assert.equal(normalizeCoiRequired(v), false, String(v));
});

test("COI C11 classify validator: an absent coi_required is false, a string is false, true stays true", async () => {
  assert.equal((await run({ ...valid })).coi_required, false);
  assert.equal((await run({ ...valid, coi_required: "yes" })).coi_required, false);
  assert.equal((await run({ ...valid, coi_required: 1 })).coi_required, false);
  assert.equal((await run({ ...valid, coi_required: true })).coi_required, true);
  assert.equal((await run({ ...valid, coi_required: false })).coi_required, false);
});

// C12: the definition is pinned as literal lines (deterministic; the real-model runs are observation).
const prompt = buildClassifyPrompt("2026-10-12");

test("COI C12 classify prompt: the coi_required field is in the JSON shape", () => {
  assert.ok(prompt.includes(`"coi_required": boolean,`), "JSON shape line missing");
});

test("COI C12 classify prompt: a requirement or a request for proof of insurance is true", () => {
  assert.ok(
    prompt.includes("coi_required = true only when the lead text says the client or the venue requires or needs a certificate of insurance or proof of insurance, or asks for one."),
    "definition line missing",
  );
});

test("COI C12 classify prompt: a question about whether Alex carries insurance is false", () => {
  assert.ok(
    prompt.includes("A question about whether Alex carries insurance is NOT enough: false. A venue's name alone is not a signal. Otherwise false."),
    "boundary line missing",
  );
});
