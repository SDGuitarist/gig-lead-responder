import { test } from "node:test";
import assert from "node:assert/strict";
import { buildClassifyPrompt } from "./prompts/classify.js";
import { matchTierB } from "./data/venues.js";
import { setClaudeRequesterForTests } from "./claude.js";
import { classifyLead } from "./pipeline/classify.js";

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
