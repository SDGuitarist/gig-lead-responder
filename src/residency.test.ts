import { test } from "node:test";
import assert from "node:assert/strict";
import { setClaudeRequesterForTests } from "./claude.js";
import { classifyLead, normalizeEngagement } from "./pipeline/classify.js";
import { buildClassifyPrompt } from "./prompts/classify.js";
import { lookupPrice, lookupResidencyRate } from "./pipeline/price.js";
import { verifyClassificationHeuristics } from "./pipeline/classify-verify.js";
import { withoutHoldNotes, type Classification, type ResidencyCadence, type ResidencyTier } from "./types.js";

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

// R221/R108–R111/R116: residency rates per night, solo Alex (Alex approved the
// R2/R3 numbers 2026-10-04). R1, 4+ hours and an unknown cadence have no rate:
// held for Alex, never invented.
test("residency price: R2 and R3 per night, exactly as approved", () => {
  const want: Array<[ResidencyTier, number, ResidencyCadence, number]> = [
    ["R2", 2, "weekly", 350], ["R2", 2, "biweekly", 400], ["R2", 2, "monthly", 450],
    ["R2", 3, "weekly", 450], ["R2", 3, "biweekly", 525], ["R2", 3, "monthly", 600],
    ["R3", 2, "weekly", 500], ["R3", 2, "biweekly", 550], ["R3", 2, "monthly", 600],
    ["R3", 3, "weekly", 600], ["R3", 3, "biweekly", 675], ["R3", 3, "monthly", 750],
  ];
  for (const [tier, hours, cadence, rate] of want) {
    const q = lookupResidencyRate(tier, hours, cadence);
    assert.equal(q.rate, rate, `${tier} ${hours}h ${cadence}`);
    assert.equal(q.hours, hours);
    assert.equal(q.reason, null);
  }
  assert.equal(lookupResidencyRate("R2", 2, "weekly").floor, 350);
  assert.equal(lookupResidencyRate("R3", 2, "weekly").floor, 400);
});

test("residency price: between card lengths rounds up; no rate for R1, 4 hours or an unknown cadence", () => {
  assert.deepEqual([lookupResidencyRate("R2", 2.5, "monthly").hours, lookupResidencyRate("R2", 2.5, "monthly").rate], [3, 600]);
  assert.deepEqual([lookupResidencyRate("R3", 1, "weekly").hours, lookupResidencyRate("R3", 1, "weekly").rate], [2, 500]);
  for (const q of [lookupResidencyRate("R1", 2, "monthly"), lookupResidencyRate("R2", 4, "weekly"), lookupResidencyRate("R3", 2, null)]) {
    assert.equal(q.rate, null);
    assert.equal(q.floor, null);
    assert.ok(q.reason && q.reason.length > 0);
  }
  assert.match(lookupResidencyRate("R1", 2, "monthly").reason ?? "", /R1/);
  assert.match(lookupResidencyRate("R2", 4, "weekly").reason ?? "", /4/);
  assert.match(lookupResidencyRate("R3", 2, null).reason ?? "", /cadence/);
});

// R278/R281/R286: a solo residency carries its residency quote on the pricing
// result; a non-solo recurring request is priced as private events (no discount,
// Alex 2026-10-04). Every residency lead is held for Alex.
const cls = (over: Partial<Classification> = {}) =>
  ({ ...valid, engagement_type: "private", residency_tier: null, residency_cadence: null, price_asked: false, ...over }) as Classification;

test("residency hold: a solo residency's pricing carries its residency quote; private and non-solo do not", () => {
  const solo = lookupPrice(cls({ engagement_type: "residency", residency_tier: "R2", residency_cadence: "weekly" }));
  assert.equal(solo.residency?.rate, 350);
  assert.equal(lookupPrice(cls()).residency, undefined);
  const duo = lookupPrice(cls({ engagement_type: "residency", residency_tier: "R2", residency_cadence: "weekly", format_recommended: "duo" }));
  assert.equal(duo.residency, undefined);
});

test("residency hold: every residency lead is held with a reason; a private lead is not", () => {
  const note = (c: Classification) => verifyClassificationHeuristics("lead text", c).classification.flagged_concerns.filter((f) => f.startsWith("residency:"));
  assert.match(note(cls({ engagement_type: "residency", residency_tier: "R2", residency_cadence: "weekly" }))[0], /residency: R2 weekly/);
  assert.match(note(cls({ engagement_type: "residency", residency_tier: "R1", residency_cadence: "monthly" }))[0], /Alex sets the rate/);
  assert.match(note(cls({ engagement_type: "residency", residency_tier: "R2", format_recommended: "duo" }))[0],
    /recurring duo priced as private events, no discount/);
  assert.deepEqual(note(cls()), []);
  assert.deepEqual(note(cls({ engagement_type: "wedding_adjacent" })), []);
});

test("residency hold: the hold note never reaches the draft or the gate", () => {
  const held = verifyClassificationHeuristics("lead text", cls({ engagement_type: "residency", residency_tier: "R3", residency_cadence: "monthly" })).classification;
  assert.ok(held.flagged_concerns.some((f) => f.startsWith("residency:")));
  assert.ok(!withoutHoldNotes(held).flagged_concerns.some((f) => f.startsWith("residency:")));
});
