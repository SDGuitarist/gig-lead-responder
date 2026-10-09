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
  event_arc: "corporate", engagement_type: "private", // a T4 lead that clears every condition
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

// T4 rounds 1-2 kept finding one more way a non-luxury-corporate lead slipped through (a private party, a
// wedding-adjacent event). Alex 2026-10-09: flip the rule. T4 is cleared only when EVERY condition holds:
// direct (not a platform), a corporate event, a private engagement (not wedding-adjacent, not residency),
// not a nonprofit (classifier or text backup), no ceremony. Anything else is held with the reasons named.
const t4Notes = (text: string, extra: Record<string, unknown> = {}) => verifyClassificationHeuristics(text,
  { ...valid, flagged_concerns: [], ...extra } as unknown as Classification).classification.flagged_concerns.filter((w) => w.startsWith("t4:"));
test("port manifest R403 T4: a lead that clears every condition is not held; each failure is held and named", () => {
  assert.deepEqual(t4Notes("Corporate reception, 120 guests"), [], "all clear");
  const cases: [string, Record<string, unknown>, string][] = [
    ["Corporate reception", { lead_source_column: "P" }, "a platform lead"],
    ["Corporate reception", { platform: "gigsalad" }, "a platform lead"],
    // T4 round 3 P1: "direct" is a positive requirement (lead_source_column D), not "not P".
    ["Corporate reception", { lead_source_column: undefined }, "not a direct lead"],
    ["Corporate reception", { lead_source_column: "X" }, "not a direct lead"],
    ["Birthday party", { event_arc: "private_celebration" }, "not a corporate event"],
    ["Reception", { event_arc: null }, "not a corporate event"],
    ["Rehearsal dinner", { engagement_type: "wedding_adjacent" }, "not a private engagement (wedding_adjacent)"],
    ["Weekly lounge", { engagement_type: "residency" }, "not a private engagement (residency)"],
    ["Reception", { nonprofit_buyer: true }, "a nonprofit buyer"],
    ["Annual dinner for the Example Foundation", {}, "a nonprofit buyer"],
    ["Corporate wedding ceremony on the lawn", {}, "mentions a ceremony"],
  ];
  for (const [text, extra, reason] of cases) {
    const n = t4Notes(text, extra);
    assert.equal(n.length, 1, `${reason}: ${JSON.stringify(extra)}`);
    assert.ok(n[0].startsWith("t4: T4 is cleared only for a direct, private, corporate, non-nonprofit, non-ceremony lead; this one is "), n[0]);
    assert.ok(n[0].includes(reason), `${reason} named: ${n[0]}`);
  }
  assert.deepEqual(t4Notes("Birthday party", { rate_card_tier: "T3", event_arc: "private_celebration" }), [], "control: not T4");
});

test("port manifest R403 T4: the router holds a T4 lead that fails a condition and auto-sends one that clears all", async () => {
  const { routeLead } = await import("./automation/router.js");
  const route = (extra: Record<string, unknown>) => routeLead(
    { platform: "direct", rawText: "Reception", parseConfidence: "high", parseWarnings: [] } as never,
    { classification: verifyClassificationHeuristics("Reception, 120 guests",
      { ...valid, flagged_concerns: [], ...extra } as unknown as Classification).classification,
      pricing: { quote_price: 1350 }, verified: true } as never);
  assert.equal(route({ engagement_type: "wedding_adjacent" }).action, "hold", "round 2 P1: wedding-adjacent corporate T4");
  assert.equal(route({ event_arc: "private_celebration" }).action, "hold");
  assert.equal(route({ lead_source_column: undefined }).action, "hold", "round 3 P1: a missing source column");
  assert.equal(route({ lead_source_column: "X" }).action, "hold", "round 3 P1: an unexpected source column");
  assert.equal(route({}).action, "auto-send", "control: a clean corporate T4 lead");
});
