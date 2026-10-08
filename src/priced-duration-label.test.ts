import { test } from "node:test";
import assert from "node:assert/strict";
import { lookupPrice, rateTableFor } from "./pipeline/price.js";
import { RATE_TABLES } from "./data/rates.js";
import type { Classification } from "./types.js";

// Alex 2026-10-03: a 1-hour mariachi request was priced at the 2-hour minimum
// but labelled "1hr" (and 2.5 h solo priced as 2 h, labelled 2.5 h). The hours a
// quote states must be the hours it priced, for every format and request.
const c = (format: string, hours: number) =>
  ({ format_recommended: format, duration_hours: hours, rate_card_tier: "T2", lead_source_column: "P",
     competition_level: "low", stated_budget: null }) as unknown as Classification;

test("quoted hours are the hours priced, for every format", () => {
  const wrong: string[] = [];
  for (const format of Object.keys(RATE_TABLES)) {
    for (const asked of [0.5, 1, 1.5, 2, 2.5, 3, 4, 5]) {
      const p = lookupPrice(c(format, asked));
      const row = rateTableFor(p)[String(p.duration_hours)];
      if (!row || row.T2P.anchor !== p.anchor) wrong.push(`${format} asked ${asked}h: labelled ${p.duration_hours}h, anchor ${p.anchor}`);
    }
  }
  assert.deepEqual(wrong, []);
});

test("quoted hours are the hours priced: control, an exact card duration is unchanged", () => {
  assert.equal(lookupPrice(c("solo", 2)).duration_hours, 2);
  assert.equal(lookupPrice(c("mariachi_full", 3)).duration_hours, 3);
});

test("quoted hours are the hours priced: the draft is told when they differ from the request", async () => {
  const { buildGeneratePrompt } = await import("./prompts/generate.js");
  const full = (hours: number) => ({ ...c("mariachi_full", hours), mode: "evaluation", action: "quote", vagueness: "clear",
    competition_quote_count: 0, stealth_premium: false, stealth_premium_signals: [], tier: "standard", price_point: "full_premium",
    format_requested: "mariachi", timeline_band: "comfortable", close_type: "soft_hold", cultural_context_active: false,
    cultural_tradition: null, planner_effort_active: false, social_proof_active: false, context_modifiers: [],
    event_date_iso: null, event_energy: null, flagged_concerns: [], venue_name: null, client_first_name: null,
    platform: "yelp" }) as unknown as Classification;
  const asked1 = buildGeneratePrompt(full(1), lookupPrice(full(1)), "ctx");
  assert.ok(asked1.includes("The client asked for 1hr; this rate is for 2hr"), "1h mariachi → 2h minimum, said plainly");
  // Codex round 1 (no 1-hour duo) P2: the duos follow the same rule since Alex 2026-10-07.
  for (const format of ["duo", "flamenco_duo"]) {
    const duo = { ...full(1), format_recommended: format, format_requested: format } as Classification;
    assert.ok(buildGeneratePrompt(duo, lookupPrice(duo), "ctx").includes("The client asked for 1hr; this rate is for 2hr"), format);
  }
  for (const format of ["solo", "sourced_cultural_duo"]) {
    const one = { ...full(1), format_recommended: format, format_requested: format } as Classification;
    assert.ok(!buildGeneratePrompt(one, lookupPrice(one), "ctx").includes("this rate is for 2hr"), `${format} keeps 1 hour`);
  }
  assert.ok(!buildGeneratePrompt(full(2), lookupPrice(full(2)), "ctx").includes("The client asked for"), "control: exact match says nothing");
});
