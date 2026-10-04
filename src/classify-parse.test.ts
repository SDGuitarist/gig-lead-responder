import { test } from "node:test";
import assert from "node:assert/strict";
import { setClaudeRequesterForTests } from "./claude.js";
import { classifyLead } from "./pipeline/classify.js";

// Codex round 1 (port range) finding 2, second instance: the classify validator
// checked a few fields and cast the rest. Fields the code branches on must parse
// into their type, or the result is rejected (retry once, then the lead fails safe).
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
  try { return await classifyLead("lead text", "2026-10-03"); } finally { setClaudeRequesterForTests(); }
}

test("classify parse: malformed branch-driving fields are rejected", async () => {
  for (const [label, over] of [
    ["flagged_concerns as a string", { flagged_concerns: "outdoor" }],
    ["non-string concern", { flagged_concerns: [{ c: 1 }] }],
    ["stealth signals not an array", { stealth_premium_signals: "valet" }],
    ["context_modifiers not an array", { context_modifiers: null }],
    ["lead_source_column X", { lead_source_column: "X" }],
    ["timeline_band soon", { timeline_band: "soon" }],
    ["close_type maybe", { close_type: "maybe" }],
    ["cultural flag as text", { cultural_context_active: "yes" }],
    ["unknown tradition", { cultural_tradition: "celtic" }],
    ["mode", { mode: "shopping" }],
    ["vagueness", { vagueness: "fuzzy" }],
  ] as const) {
    await assert.rejects(run({ ...valid, ...over }), /invalid|Failed to parse/, label);
  }
});

test("classify parse: control, a valid classification comes through", async () => {
  const c = await run(valid);
  assert.equal(c.lead_source_column, "P");
  assert.equal(c.delivery_mode, "alex_performs");
});
