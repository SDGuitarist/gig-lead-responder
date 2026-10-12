import { test } from "node:test";
import assert from "node:assert/strict";
import { buildClassifyPrompt } from "./prompts/classify.js";
import { matchTierB } from "./data/venues.js";
import { setClaudeRequesterForTests } from "./claude.js";
import { classifyLead } from "./pipeline/classify.js";
import { readFileSync } from "node:fs";
import { tierBHold, lookupPrice, clientTotal } from "./pipeline/price.js";
import { buildGeneratePrompt } from "./prompts/generate.js";
import { buildVerifyPrompt } from "./prompts/verify.js";
import { routeLead } from "./automation/router.js";
import { runEditPipeline, runPipeline } from "./run-pipeline.js";
import { NO_DATE_TERMS } from "./pipeline/payment-terms.js";
import { GUT_CHECK_KEYS, type Classification, type TravelFeeData } from "./types.js";

// Plan docs/plans/2026-10-12-fix-tier-b-venue-rule-conflict-hold-plan.md (Revisions 1-3; Alex's rules 2026-10-12).
// The app decides Tier B from plain facts and holds with both rate-card prices when a rule is undecidable or rules
// disagree. Made-up leads only; no model.

const TIER_B_LINE = "- Tier B venues (premium only with their own signal): Coasterra (100+ guests, corporate, or any Saturday), Tom Ham's Lighthouse (100+ guests and starting 5 PM or later), Marina Village (corporate or 75+), Brick (rule not defined yet: Alex reviews). Scripps Seaside Forum and Martin Johnson House are premium for any booking";
const OLD_LINE = "- Tier B venues (premium only with another signal: 100+ guests, corporate, Saturday evening)";

test("B1: the classify prompt carries Alex's Tier B rules exactly once, and not the old line", () => {
  const p = buildClassifyPrompt("2026-10-12");
  assert.equal(p.split(TIER_B_LINE).length - 1, 1);
  assert.ok(!p.includes(OLD_LINE));
});

test("B8: venue names and aliases match their Tier B entry; near-misses do not", () => {
  const cases: Array<[string, string | null]> = [
    ["Tom Hams Lighthouse", "Tom Ham's Lighthouse"], ["Tom Ham's", "Tom Ham's Lighthouse"],
    ["Tom Ham’s", "Tom Ham's Lighthouse"], ["TOM HAM'S LIGHTHOUSE", "Tom Ham's Lighthouse"],
    ["Coasterra", "Coasterra"], ["Scripps Forum", "Scripps Seaside Forum"], ["Scripps Seaside Forum", "Scripps Seaside Forum"],
    ["Marina Village", "Marina Village"], ["Martin Johnson House", "Martin Johnson House"], ["Brick", "Brick"],
    ["Tom Hanks", null], ["Scripps Ranch", null], ["Coaster", null], ["Example Harbor Grill", null],
  ];
  for (const [venue, want] of cases) assert.equal(matchTierB(venue, "")?.name ?? null, want, venue);
});

test("B8/B9: venue_name wins when present; the lead text is read only when venue_name is null, and never for Brick", () => {
  assert.equal(matchTierB("Example Harbor Grill", "we considered Tom Ham's but chose the Grill"), null);
  assert.equal(matchTierB(null, "dinner at Tom Hams Lighthouse for 50")?.name, "Tom Ham's Lighthouse");
  assert.equal(matchTierB(null, "a brick patio at our home"), null);
  assert.equal(matchTierB(null, "Brick walls and a garden: our backyard party for 30"), null, "Brick is never read from the lead text");
  assert.equal(matchTierB("Example Harbor Grill", "the brick courtyard"), null);
});

// --- Step 2: two extracted facts (D2). Normalized before validation: an odd value is null, never a failed lead. ---
const VALID = {
  mode: "evaluation", action: "quote", vagueness: "clear", competition_level: "low", competition_quote_count: 0,
  stealth_premium: false, stealth_premium_signals: [], tier: "standard", rate_card_tier: "T2", lead_source_column: "D",
  price_point: "full_premium", format_requested: "guitarist", format_recommended: "solo", duration_hours: 2,
  stated_budget: null, event_date_iso: null, timeline_band: "comfortable", close_type: "soft_hold", event_energy: null,
  cultural_context_active: false, cultural_tradition: null, planner_effort_active: false, social_proof_active: false,
  context_modifiers: [], flagged_concerns: [], venue_name: null, client_first_name: null,
};
async function classifyWith(over: Record<string, unknown>) {
  const out: Record<string, unknown> = { ...VALID, ...over };
  for (const k of Object.keys(over)) if (over[k] === "__missing__") delete out[k];
  setClaudeRequesterForTests((async () => ({ id: "m", type: "message", role: "assistant", model: "t", stop_reason: "end_turn",
    stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 },
    content: [{ type: "text", text: JSON.stringify(out) }] })) as never);
  try { return await classifyLead("lead text", "2026-10-12"); } finally { setClaudeRequesterForTests(); }
}

test("B2: guest_count and event_start_hour are normalized before validation; classification never fails on them", async () => {
  const rows: Array<[unknown, number | null, unknown, number | null]> = [
    [50, 50, 17, 17], ["50", 50, "17", 17], ["__missing__", null, "__missing__", null], [null, null, null, null],
    ["50+", null, "5pm", null], [50.5, null, 17.5, null], [-3, null, -1, null], [0, null, 0, 0], [5001, null, 24, null],
    ["evening", null, "evening", null],
  ];
  for (const [g, wantG, h, wantH] of rows) {
    const c = await classifyWith({ guest_count: g, event_start_hour: h });
    assert.equal(c.guest_count, wantG, `guest_count ${JSON.stringify(g)}`);
    assert.equal(c.event_start_hour, wantH, `event_start_hour ${JSON.stringify(h)}`);
  }
});

test("B3: the classify prompt asks for both facts as numbers, with the edge rules", () => {
  const p = buildClassifyPrompt("2026-10-12");
  for (const x of ['"guest_count": number | null', '"event_start_hour": number | null', '"50+"', '"5-8 PM"', '"noon"', '"under 60"']) {
    assert.ok(p.includes(x), x);
  }
});

// --- Step 3: tierBHold (D3). The app reads plain facts, never writes the tier, and every note names both prices. ---
const lead = (over: Partial<Classification> & Record<string, unknown> = {}) => ({
  ...VALID, format_recommended: "solo", duration_hours: 3, lead_source_column: "D", rate_card_tier: "T2",
  stealth_premium_signals: [], event_arc: "private_celebration", nonprofit_buyer: false, flagged_concerns: [],
  venue_name: "Tom Ham's Lighthouse", guest_count: 50, event_start_hour: 17, event_date_iso: "2027-04-18", ...over,
}) as unknown as Classification;
const priceAt = (c: Classification, tier: "T2" | "T3", travel: TravelFeeData | null = null) => {
  const p = lookupPrice({ ...c, rate_card_tier: tier }, travel);
  return clientTotal(p, p.quote_price);
};
const both = (c: Classification, travel: TravelFeeData | null = null) => `T2 $${priceAt(c, "T2", travel)} / T3 $${priceAt(c, "T3", travel)}`;
function hold(over: Partial<Classification> & Record<string, unknown>, raw = "", travel: TravelFeeData | null = null): string | null {
  const c = lead(over);
  const before = JSON.stringify(c);
  const note = tierBHold(c, raw, travel);
  assert.equal(JSON.stringify(c), before, "the check never writes the classification (tier, price inputs)");
  if (note !== null) {
    assert.ok(note.startsWith("tier_b: "), note);
    assert.ok(note.endsWith(both(c, travel)), `both prices: ${note}`);
  }
  return note;
}
const held = (over: Partial<Classification> & Record<string, unknown>, has: string, raw = "") => {
  const n = hold(over, raw);
  assert.ok(n && n.includes(has), `${JSON.stringify(over)} -> ${n}`);
};
const none = (over: Partial<Classification> & Record<string, unknown>, raw = "") =>
  assert.equal(hold(over, raw), null, JSON.stringify(over));
const SUN = "2027-04-18", SAT = "2027-07-17";

test("B4: Tom Ham's needs BOTH 100+ guests AND a 5 PM+ start; otherwise the waterfront 50+ rule or a missing fact holds", () => {
  none({ guest_count: 120, event_start_hour: 18, rate_card_tier: "T3" });                                  // B4a
  held({ guest_count: 120, event_start_hour: 18 }, "own rule says premium (100+ guests and starts 5 PM or later)"); // B4b
  none({ guest_count: 40, event_start_hour: 18 }); none({ guest_count: 49, event_start_hour: 16 });          // B4c
  for (const t of ["T2", "T3"] as const) held({ guest_count: 50, event_start_hour: 17, rate_card_tier: t },
    "own rule says standard; waterfront 50+ buyout rule may apply");                                         // B4d
  held({ guest_count: 120, event_start_hour: 12 }, "waterfront 50+ buyout rule may apply");
  held({ guest_count: 120, event_start_hour: null }, "start hour not stated");                               // B4e
  held({ guest_count: null, event_start_hour: 18 }, "guests not stated");
  held({ guest_count: null, event_start_hour: 12 }, "guests not stated; waterfront 50+ buyout rule may apply"); // B4f
  held({ guest_count: 40, event_start_hour: 12, rate_card_tier: "T3", stealth_premium_signals: ["plated dinner"] },
    "own rule says standard; priced premium (plated dinner)");                                               // B7
});

test("B5: Coasterra is premium with 100+ guests, corporate, or any Saturday; an unknown or impossible date holds", () => {
  const c = { venue_name: "Coasterra", event_start_hour: 12 };
  held({ ...c, event_date_iso: SAT, guest_count: 30 }, "own rule says premium (any Saturday)");
  none({ ...c, event_date_iso: SUN, guest_count: 30, event_arc: "corporate", rate_card_tier: "T3" });
  none({ ...c, event_date_iso: SUN, guest_count: 30 });
  held({ ...c, event_date_iso: null, guest_count: 30 }, "date not stated");
  held({ ...c, event_date_iso: "2026-02-31", guest_count: 30 }, "date not stated");
  held({ ...c, event_date_iso: SUN, guest_count: 55 }, "waterfront 50+ buyout rule may apply");
  held({ ...c, event_date_iso: SUN, guest_count: 120 }, "own rule says premium (100+ guests)");
});

test("B6: Marina Village, Scripps, Martin Johnson House and Brick", () => {
  held({ venue_name: "Marina Village", guest_count: 75 }, "own rule says premium (75+ guests)");
  held({ venue_name: "Marina Village", guest_count: null, event_arc: "corporate" }, "own rule says premium (corporate)");
  none({ venue_name: "Marina Village", guest_count: 74 });
  held({ venue_name: "Marina Village", guest_count: null }, "guests not stated");
  for (const v of ["Scripps Seaside Forum", "Scripps Forum", "Martin Johnson House"]) {
    held({ venue_name: v }, "own rule says premium (premium for any booking)");
    none({ venue_name: v, rate_card_tier: "T3" });
  }
  for (const t of ["T2", "T3"] as const) held({ venue_name: "Brick", rate_card_tier: t }, "Brick (rule not defined)");
});

test("B9: not applied to another venue mentioned in prose, a nonprofit, a clarification lead, no Tier B venue, Tier A", () => {
  none({ venue_name: "Example Harbor Grill", guest_count: 80 }, "we considered Tom Ham's but chose the Grill");
  none({ nonprofit_buyer: true });
  none({ format_recommended: "unresolved", action: "one_question" });
  none({ venue_name: null }, "a backyard party for 60");
  none({ venue_name: "Example Harbor Grill" }, "the brick courtyard");
  none({ venue_name: "Hotel del Coronado", guest_count: 200 });                                              // B12
});

test("B10: both prices are lookupPrice at T2 and T3 with the same inputs, travel fee included", () => {
  const travel: TravelFeeData = { zip: "92028", miles: 45, band: "Regional", solo_fee: 75, duo_fee: 150,
    duo_musician_stipend: 0, trio_starting: 0, quartet_starting: 0, custom_quote_required: false };
  const n = hold({ guest_count: 50, event_start_hour: 17 }, "", travel)!;
  assert.ok(n.endsWith(both(lead({ guest_count: 50, event_start_hour: 17 }), travel)));
  const plain = both(lead({ guest_count: 50, event_start_hour: 17 }));
  assert.notEqual(both(lead({ guest_count: 50, event_start_hour: 17 }), travel), plain, "the travel fee changes both prices");
});

// --- B11: the note is for Alex, never for the drafter or the checker; edits keep it. ---
const NOTE = "tier_b: Tom Ham's Lighthouse own rule says standard; waterfront 50+ buyout rule may apply; T2 $895 / T3 $1200";
test("B11: generate and verify prompts carry no tier_b: text; the router holds the lead", () => {
  const c = lead({ flagged_concerns: [NOTE] });
  const pricing = lookupPrice(c);
  assert.ok(!buildGeneratePrompt(c, pricing, "ctx", NO_DATE_TERMS).includes("tier_b:"));
  assert.ok(!buildVerifyPrompt(c, pricing).includes("tier_b:"));
  const r = routeLead({ platform: "direct", rawText: "x", parseConfidence: "high", parseWarnings: [] } as never,
    { classification: c, pricing, verified: true } as never);
  assert.equal(r.action, "hold");
});

test("B11: runEditPipeline sends no tier_b: text to the model, keeps the stored note, returns { drafts, gate }", async () => {
  const stored = lead({ flagged_concerns: [NOTE], venue_name: null });
  const pricing = lookupPrice(stored);
  const prompts: string[] = [];
  const reply = (body: unknown) => ({ id: "m", type: "message", role: "assistant", model: "t", stop_reason: "end_turn",
    stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 }, content: [{ type: "text", text: JSON.stringify(body) }] });
  let n = 0;
  setClaudeRequesterForTests((async (req: { system?: unknown; messages?: unknown }) => {
    prompts.push(JSON.stringify(req));
    return reply(n++ === 0
      ? { reasoning: { details_present: [], absences: [], emotional_core: "x", cinematic_opening: "x", validation_line: "x" },
          full_draft: "Hi.\nAlex Guillen", compressed_draft: "Hi.\nAlex Guillen" }
      : { scene_quote: "x", scene_type: "cinematic", competitor_test: false,
          gut_checks: Object.fromEntries(GUT_CHECK_KEYS.map((k) => [k, true])), gate_status: "pass", fail_reasons: [],
          concern_traceability: [], best_line: "x", validation_line: "x" });
  }) as never);
  try {
    const out = await runEditPipeline(stored, pricing, "shorter", "2026-10-12");
    assert.deepEqual(Object.keys(out).sort(), ["drafts", "gate"]);
  } finally { setClaudeRequesterForTests(); }
  assert.ok(prompts.length >= 2, `the model was called: ${prompts.length}`);
  for (const p of prompts) assert.ok(!p.includes("tier_b:"), "no tier_b: text sent to the model");
  assert.deepEqual(stored.flagged_concerns, [NOTE], "the stored classification keeps the note");
});

test("B14: the dashboard lead detail prints every flagged concern, so Alex sees the note and both prices", () => {
  const html = readFileSync("public/dashboard.html", "utf-8");
  assert.equal(html.split("['Concerns', c.flagged_concerns.join(', ')]").length - 1, 1);
});

test("B4/B5/B6 boundaries: exactly 100 guests, a 5 PM start, 75 and 50 guests count; one below does not", () => {
  held({ guest_count: 100, event_start_hour: 17 }, "own rule says premium (100+ guests and starts 5 PM or later)");
  held({ guest_count: 99, event_start_hour: 17 }, "waterfront 50+ buyout rule may apply");
  held({ guest_count: 100, event_start_hour: 16 }, "waterfront 50+ buyout rule may apply");
  held({ venue_name: "Coasterra", event_date_iso: SUN, guest_count: 100 }, "own rule says premium (100+ guests)");
  held({ venue_name: "Coasterra", event_date_iso: SUN, guest_count: 50 }, "waterfront 50+ buyout rule may apply");
  none({ venue_name: "Coasterra", event_date_iso: SUN, guest_count: 49 });
});

test("B10: runPipeline puts the note in the classification it returns (the object the intake stores)", async () => {
  const classified = { ...VALID, format_recommended: "solo", duration_hours: 3, rate_card_tier: "T2",
    venue_name: "Tom Hams Lighthouse", guest_count: 50, event_start_hour: 17, event_date_iso: "2027-04-18",
    event_arc: "private_celebration" };
  const draft = { reasoning: { details_present: [], absences: [], emotional_core: "x", cinematic_opening: "x", validation_line: "x" },
    full_draft: "Hi.\nAlex Guillen", compressed_draft: "Hi.\nAlex Guillen" };
  const gate = { scene_quote: "x", scene_type: "cinematic", competitor_test: false,
    gut_checks: Object.fromEntries(GUT_CHECK_KEYS.map((k) => [k, true])), gate_status: "pass", fail_reasons: [],
    concern_traceability: [], best_line: "x", validation_line: "x" };
  const replies = [classified, draft, gate];
  let n = 0;
  setClaudeRequesterForTests((async () => ({ id: "m", type: "message", role: "assistant", model: "t", stop_reason: "end_turn",
    stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 },
    content: [{ type: "text", text: JSON.stringify(replies[Math.min(n++, 2)]) }] })) as never);
  try {
    const out = await runPipeline("Dinner at Tom Hams Lighthouse, 50 guests, 5-8pm", undefined, "direct", undefined, "2026-10-12");
    const notes = out.classification.flagged_concerns.filter((f) => f.startsWith("tier_b:"));
    assert.equal(notes.length, 1, JSON.stringify(out.classification.flagged_concerns));
    assert.ok(notes[0].includes("waterfront 50+ buyout rule may apply"), notes[0]);
  } finally { setClaudeRequesterForTests(); }
});
