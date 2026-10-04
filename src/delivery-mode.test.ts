import { test } from "node:test";
import assert from "node:assert/strict";
import { deliveryModeFor } from "./pipeline/classify.js";

// Port manifest R349-R353, R397: delivery mode follows the Instrument Rule.
// Alex performs guitar (any style) and ukulele; sourcing only for instruments he
// doesn't play or 3+ musicians; style never decides it. Every quoted format
// already encodes that, so code derives the mode from the format.
test("delivery mode follows the format", () => {
  for (const f of ["solo", "duo", "flamenco_duo"]) assert.equal(deliveryModeFor(f), "alex_performs", f);
  for (const f of ["mariachi_4piece", "mariachi_full", "bolero_trio", "sourced_cultural_solo", "sourced_cultural_duo",
    "sourced_cultural_trio", "sourced_cultural_quartet", "sourced_cultural_5piece"]) assert.equal(deliveryModeFor(f), "alex_sources", f);
  for (const f of ["flamenco_trio", "flamenco_trio_full"]) assert.equal(deliveryModeFor(f), "hybrid", f);
  assert.equal(deliveryModeFor("unresolved"), null);
  assert.equal(deliveryModeFor("kazoo_band"), null, "unknown format: no guess");
});

test("delivery mode follows the format: enrich keeps it in step when it switches formats", async () => {
  const { enrichClassification } = await import("./pipeline/enrich.js");
  // A weekday mariachi lead: enrich routes between the two mariachi formats.
  const c = { format_recommended: "mariachi_full", delivery_mode: "hybrid", event_date_iso: "2026-11-11",
    flagged_concerns: [], context_modifiers: [], competition_level: "low", stated_budget: null } as never;
  const out = enrichClassification(c, { budget: { tier: "none" } } as never, "2026-10-03");
  assert.equal(out.delivery_mode, deliveryModeFor(out.format_recommended));
});
