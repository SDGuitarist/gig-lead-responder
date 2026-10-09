import { test } from "node:test";
import assert from "node:assert/strict";
import { buildClassifyPrompt } from "./prompts/classify.js";
import { classifyLead } from "./pipeline/classify.js";
import { setClaudeRequesterForTests } from "./claude.js";

// Port manifest R403, NP2 (Alex 2026-10-09). NP2 = established foundation, solo only: 1h $500, 2h $695,
// quoted AT the floor. NP1, NP3, NP2 3-4h and any NP duo: no NP price, held. Alex chose a classifier field
// to tell the NP tiers apart, with these definitions; unsure is null (held, no NP price).
const valid = {
  mode: "evaluation", action: "quote", vagueness: "clear", competition_level: "low", competition_quote_count: 0,
  stealth_premium: false, stealth_premium_signals: [], tier: "standard", rate_card_tier: "T2", lead_source_column: "D",
  price_point: "full_premium", format_requested: "guitarist", format_recommended: "solo", duration_hours: 2,
  stated_budget: null, event_date_iso: null, timeline_band: "comfortable", close_type: "soft_hold", event_energy: null,
  cultural_context_active: false, cultural_tradition: null, planner_effort_active: false, social_proof_active: false,
  context_modifiers: [], flagged_concerns: [], venue_name: null, client_first_name: null,
};
async function classifyAs(out: Record<string, unknown>) {
  setClaudeRequesterForTests((async () => ({ id: "m", type: "message", role: "assistant", model: "t", stop_reason: "end_turn",
    stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 },
    content: [{ type: "text", text: JSON.stringify(out) }] })) as never);
  try { return await classifyLead("lead text", "2026-10-09"); } finally { setClaudeRequesterForTests(); }
}

test("port manifest R403 NP2: the classify prompt defines NP1, NP2 and NP3 (Alex's definitions) and unsure is null", () => {
  const p = buildClassifyPrompt("2026-10-09");
  assert.match(p, /"np_tier": "NP1" \| "NP2" \| "NP3" \| null/);
  assert.match(p, /NP1[^\n]*grassroots[^\n]*volunteer-run[^\n]*PTA/i);
  assert.match(p, /NP2[^\n]*established foundation[^\n]*development team/i);
  assert.match(p, /NP3[^\n]*institutional[^\n]*hospital, university, museum/i);
  assert.match(p, /unsure[^\n]*null/i);
});

test("port manifest R403 NP2: np_tier parses only NP1/NP2/NP3, and only for a nonprofit buyer", async () => {
  for (const t of ["NP1", "NP2", "NP3"]) {
    assert.equal((await classifyAs({ ...valid, nonprofit_buyer: true, np_tier: t })).np_tier, t);
  }
  for (const v of ["np2", "NP4", "T2", 2, true, null, undefined]) {
    assert.equal((await classifyAs({ ...valid, nonprofit_buyer: true, np_tier: v })).np_tier, null, String(v));
  }
  assert.equal((await classifyAs({ ...valid, nonprofit_buyer: false, np_tier: "NP2" })).np_tier, null, "not a nonprofit buyer: no NP tier");
});
