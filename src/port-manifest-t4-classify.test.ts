import { test } from "node:test";
import assert from "node:assert/strict";
import { buildClassifyPrompt } from "./prompts/classify.js";
import { classifyLead } from "./pipeline/classify.js";
import { verifyClassificationHeuristics } from "./pipeline/classify-verify.js";
import { setClaudeRequesterForTests } from "./claude.js";
import type { Classification } from "./types.js";

// Commit 2: the classifier emits T4 for a company, DMC or planner paying at a five-star venue, never for a
// nonprofit buyer (NP beats T4, Alex 2026-10-09); the Tier A check accepts T3 or T4.
test("port manifest R403 T4: the classify prompt defines T4 and keeps nonprofit buyers out of it", () => {
  const p = buildClassifyPrompt("2026-10-09");
  assert.match(p, /- T4: Luxury corporate: a company, DMC, events firm or meeting planner paying, at a five-star or Tier A venue/);
  assert.match(p, /T4[^\n]*Never a nonprofit buyer/);
  assert.match(p, /"rate_card_tier": "T1" \| "T2" \| "T3" \| "T4"/);
});

const valid = {
  mode: "evaluation", action: "quote", vagueness: "clear", competition_level: "low", competition_quote_count: 0,
  stealth_premium: true, stealth_premium_signals: [], tier: "premium", rate_card_tier: "T4", lead_source_column: "D",
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
test("port manifest R403 T4: classify accepts T4 and still rejects an unknown tier", async () => {
  assert.equal((await classifyAs(valid)).rate_card_tier, "T4");
  // The validator rejects it; callClaude retries once, then fails with its generic parse error.
  await assert.rejects(classifyAs({ ...valid, rate_card_tier: "T5" }), /invalid rate_card_tier|Failed to parse Claude JSON/);
});
test("port manifest R403 T4: the Tier A check accepts T4 (and still demands at least T3)", () => {
  const w = (tier: string) => verifyClassificationHeuristics("Corporate dinner at Hotel del Coronado",
    { ...valid, rate_card_tier: tier, flagged_concerns: [] } as unknown as Classification).warnings.filter((x) => x.includes("Tier A venue"));
  assert.deepEqual(w("T4"), []);
  assert.deepEqual(w("T3"), []);
  assert.equal(w("T2").length, 1, "control: T2 at a Tier A venue is still held");
});

// Alex 2026-10-09 (option a): never T4 for a platform lead (GigSalad, The Bash, Yelp; the P column) or a
// wedding ceremony. If the model still says T4, the lead is held rather than repriced in code.
test("port manifest R403 T4: a platform lead or a wedding ceremony at T4 is held", () => {
  const t4 = (text: string, extra: Record<string, unknown> = {}) => verifyClassificationHeuristics(text,
    { ...valid, flagged_concerns: [], ...extra } as unknown as Classification).warnings.filter((w) => w.startsWith("t4:"));
  const msg = "t4: T4 is for direct luxury-corporate leads only (never a platform lead or a wedding ceremony); Alex prices it";
  assert.deepEqual(t4("Corporate reception, 120 guests", { lead_source_column: "P" }), [msg]);
  assert.deepEqual(t4("Corporate reception, 120 guests", { platform: "gigsalad" }), [msg]);
  assert.deepEqual(t4("Wedding ceremony on the lawn, then cocktails"), [msg]);
  assert.deepEqual(t4("Corporate reception, 120 guests"), [], "control: a direct corporate T4 lead is not held for this");
  assert.deepEqual(t4("Wedding ceremony", { rate_card_tier: "T3" }), [], "control: not T4");
});
