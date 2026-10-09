import { test } from "node:test";
import assert from "node:assert/strict";
import { setClaudeRequesterForTests } from "./claude.js";
import { classifyLead, normalizeEngagement } from "./pipeline/classify.js";
import { buildClassifyPrompt } from "./prompts/classify.js";
import { buildGeneratePrompt } from "./prompts/generate.js";
import { buildVerifyPrompt } from "./prompts/verify.js";
import { lookupPrice, lookupResidencyRate } from "./pipeline/price.js";
import { postCheckDrafts } from "./pipeline/post-check.js";
import { verifyClassificationHeuristics } from "./pipeline/classify-verify.js";
import { enrichClassification } from "./pipeline/enrich.js";
import { withoutHoldNotes, type Classification, type PricingResult, type ResidencyCadence, type ResidencyTier } from "./types.js";

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
  // A non-solo residency is a series of private events: its normal price, no discount (Codex round 1 P1).
  const duo = lookupPrice(cls({ engagement_type: "residency", residency_tier: "R2", residency_cadence: "weekly", format_recommended: "duo" }));
  assert.equal(duo.residency?.series, true);
  assert.equal(duo.residency?.rate, duo.quote_price);
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

// R284/R303: residency drafting. A price only when the venue asked and a rate
// exists; never the private-event price, never as a discount; otherwise the
// programming idea and no number (Alex 2026-10-04).
const res = (over: Partial<Classification> = {}) =>
  cls({ engagement_type: "residency", residency_tier: "R2", residency_cadence: "weekly", ...over });

test("residency draft: price asked and a rate exists, the draft states the per-night rate only", () => {
  const c = res({ price_asked: true });
  const prompt = buildGeneratePrompt(c, lookupPrice(c), "ctx");
  assert.ok(prompt.includes("## PRICING: RESIDENCY (B2B)"));
  assert.ok(prompt.includes("$350 per night"));
  assert.ok(prompt.includes("not a discount off private-event prices"));
  assert.ok(!prompt.includes("Price the client is told: $"));
  assert.ok(!prompt.includes("50% deposit holds the date"));
});

test("residency draft: not asked, or no rate, means no number at all", () => {
  for (const c of [res(), res({ price_asked: true, residency_tier: "R1" }), res({ price_asked: true, residency_cadence: null })]) {
    const prompt = buildGeneratePrompt(c, lookupPrice(c), "ctx");
    assert.ok(prompt.includes("Do NOT state any price"), c.residency_tier ?? "");
    assert.ok(!prompt.includes("per night"));
    assert.ok(!prompt.includes("Price the client is told: $"));
    assert.ok(!/Must retain: [^\n]*\bprice\b/.test(prompt));
  }
  const v = buildVerifyPrompt(res(), lookupPrice(res()));
  assert.ok(v.includes("Residency: no price is stated"));
});

test("residency draft: a private lead keeps the private-event price block", () => {
  const prompt = buildGeneratePrompt(cls(), lookupPrice(cls()), "ctx");
  assert.ok(prompt.includes("Price the client is told: $"));
  assert.ok(!prompt.includes("RESIDENCY (B2B)"));
});

// Codex round 1 P1: a NON-solo residency fell back to the private PRICING block
// and showed "Quote price: $..." (now "Price the client is told: $...") although the venue never asked. Every residency
// drafts in residency mode; a series states its private price only if asked.
const series = (over: Partial<Classification> = {}) => res({ format_recommended: "duo", ...over });

test("residency series: a non-solo residency that did not ask states no price", () => {
  const c = series();
  const prompt = buildGeneratePrompt(c, lookupPrice(c), "ctx");
  assert.ok(prompt.includes("## PRICING: RESIDENCY (B2B)"));
  assert.ok(prompt.includes("Do NOT state any price"));
  assert.ok(!prompt.includes("Price the client is told: $"));
  assert.ok(!/\$\d/.test(prompt.split("## PRICING: RESIDENCY (B2B)")[1].split("##")[0]));
  assert.ok(buildVerifyPrompt(c, lookupPrice(c)).includes("Residency: no price is stated"));
});

test("residency series: asked, it states the normal private price per night as a series, no discount", () => {
  const c = series({ price_asked: true });
  const pricing = lookupPrice(c);
  const prompt = buildGeneratePrompt(c, pricing, "ctx");
  assert.ok(prompt.includes("series of private events"));
  assert.ok(prompt.includes(`$${pricing.quote_price} per night`));
  assert.ok(!prompt.includes("Price the client is told: $"));
  assert.ok(!prompt.includes("50% deposit holds the date"));
  // Verify must accept that price: for a series it IS the private-event price.
  const v = buildVerifyPrompt(c, pricing);
  assert.ok(v.includes(`$${pricing.quote_price} per night as a series of private events`));
  assert.ok(!v.includes("never a private-event price"));
});

test("residency series: re-pricing after enrichment changes the format stays in residency mode", () => {
  // A Saturday: the 4-piece is weekday-only, so enrichment switches to the full ensemble.
  const c = res({ format_recommended: "mariachi_4piece", format_requested: "mariachi", duration_hours: 2, event_date_iso: "2026-10-10" });
  const first = lookupPrice(c);
  const enriched = enrichClassification(c, first, "2026-10-04");
  assert.equal(enriched.format_recommended, "mariachi_full");
  const repriced = lookupPrice(enriched);
  assert.notEqual(repriced.quote_price, first.quote_price);
  assert.equal(repriced.residency?.series, true);
  assert.equal(repriced.residency?.rate, repriced.quote_price);
  const prompt = buildGeneratePrompt(enriched, repriced, "ctx");
  assert.ok(prompt.includes("Do NOT state any price"));
  assert.ok(!prompt.includes("Price the client is told: $"));
});

// Price line review round 3 (both runs; hard cap, Alex chose to fix and ship): a residency SERIES with a
// travel fee said "$1100 per night" while its travel block said "present ONE total, $1250". The series
// price is now clientTotal(pricing, q.rate), the same total the travel block states; the written-price
// check accepts it and its deposit. Custom-quote and no travel keep the base.
test("residency series: with a travel fee, the per-night price is the one client total", () => {
  const c = series({ price_asked: true });
  const near = { fee: 150, band: "Near", miles: 40, zip: "92025", musician_stipend: 50, custom_quote_required: false };
  const p = { ...lookupPrice(c), travel: near } as PricingResult;
  const total = p.quote_price + 150;
  const block = buildGeneratePrompt(c, p, "ctx").split("## PRICING: RESIDENCY (B2B)")[1];
  assert.ok(block.includes(`series at $${total} per night`), block.slice(0, 400));
  assert.ok(!block.includes(`series at $${p.quote_price} per night`));
  assert.ok(block.includes(`Present ONE total number ($${total})`), "the travel block states the same total");
  const draft = `Weekly duo programming, $${total} per night for 2 hours. $${Math.round(total / 2)} holds the first date.`;
  assert.deepEqual(postCheckDrafts(draft, draft, undefined, { pricing: p }).violations.filter((v) => v.startsWith("price_")), []);
  const custom = buildGeneratePrompt(c, { ...p, travel: { ...near, fee: 0, custom_quote_required: true } } as PricingResult, "ctx");
  assert.ok(custom.includes(`series at $${p.quote_price} per night`), "custom-quote travel: the base");
});
