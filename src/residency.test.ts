import { test } from "node:test";
import assert from "node:assert/strict";
import { setClaudeRequesterForTests } from "./claude.js";
import { classifyLead, normalizeEngagement } from "./pipeline/classify.js";
import { buildClassifyPrompt } from "./prompts/classify.js";

// Port manifest R220/R276–R280 (engagement type) and R281–R283 (residency tier):
// is this a private event or a recurring residency? Alex 2026-10-04: residency
// is solo Alex only, R2 when the tier is unclear, and a price only if asked.
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
  try { return await classifyLead("lead text", "2026-10-04"); } finally { setClaudeRequesterForTests(); }
}

test("residency classify: the prompt asks for engagement type, residency tier, cadence and price_asked", () => {
  const p = buildClassifyPrompt("2026-10-04");
  for (const m of ["## ENGAGEMENT TYPE", "\"engagement_type\": \"private\" | \"residency\" | \"wedding_adjacent\"",
    "\"residency_tier\": \"R1\" | \"R2\" | \"R3\" | null", "\"residency_cadence\": \"weekly\" | \"biweekly\" | \"monthly\" | null",
    "\"price_asked\": boolean", "Default when unclear: R2"]) {
    assert.ok(p.includes(m), m);
  }
});

test("residency classify: engagement fields parse, and anything unknown falls back safely", () => {
  assert.deepEqual(normalizeEngagement({}), { engagement_type: "private", residency_tier: null, residency_cadence: null, price_asked: false });
  assert.deepEqual(normalizeEngagement({ engagement_type: "gig" }).engagement_type, "private");
  assert.deepEqual(normalizeEngagement({ engagement_type: "wedding_adjacent", residency_tier: "R3", residency_cadence: "weekly" }),
    { engagement_type: "wedding_adjacent", residency_tier: null, residency_cadence: null, price_asked: false });
  // A residency with no usable tier is R2 (the source's default when ambiguous).
  assert.equal(normalizeEngagement({ engagement_type: "residency", residency_tier: "R9" }).residency_tier, "R2");
  assert.equal(normalizeEngagement({ engagement_type: "residency", residency_tier: "R1" }).residency_tier, "R1");
  assert.equal(normalizeEngagement({ engagement_type: "residency", residency_cadence: "daily" }).residency_cadence, null);
  assert.equal(normalizeEngagement({ engagement_type: "residency", residency_cadence: "biweekly" }).residency_cadence, "biweekly");
  assert.equal(normalizeEngagement({ engagement_type: "residency", price_asked: "yes" }).price_asked, false);
  assert.equal(normalizeEngagement({ engagement_type: "residency", price_asked: true }).price_asked, true);
});

test("residency classify: classifyLead returns the normalized fields", async () => {
  const c = await classifyAs({ ...valid, engagement_type: "residency", residency_tier: "R3", residency_cadence: "monthly", price_asked: true });
  assert.equal(c.engagement_type, "residency");
  assert.equal(c.residency_tier, "R3");
  assert.equal(c.residency_cadence, "monthly");
  assert.equal(c.price_asked, true);
  const plain = await classifyAs(valid);
  assert.equal(plain.engagement_type, "private");
  assert.equal(plain.residency_tier, null);
});
