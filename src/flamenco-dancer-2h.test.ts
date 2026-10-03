import { test } from "node:test";
import assert from "node:assert/strict";
import { lookupPrice } from "./pipeline/price.js";
import { buildClassifyPrompt } from "./prompts/classify.js";
import { normalizeExtendedDancer } from "./pipeline/classify.js";
import type { Classification } from "./types.js";

// Port manifest R048 (Alex 2026-10-03): a 3-hour Flamenco Trio is quoted with
// the dancer for 2 hours (card: T2P $2,100/$1,900, T3D $2,800/$2,600) only when
// the lead asks for the dancer for more than an hour. Default stays dancer 1 hour.
const c = (hours: number, extended: boolean, tier: "T2" | "T3" = "T2", col: "P" | "D" = "P") =>
  ({ format_recommended: "flamenco_trio", duration_hours: hours, rate_card_tier: tier, lead_source_column: col,
     competition_level: "low", stated_budget: null, extended_dancer: extended }) as unknown as Classification;

test("flamenco dancer 2h: 3 hours with the lead asking uses the dancer-2-hours row", () => {
  assert.deepEqual([lookupPrice(c(3, true)).anchor, lookupPrice(c(3, true)).floor], [2100, 1900]);
  assert.deepEqual([lookupPrice(c(3, true, "T3", "D")).anchor, lookupPrice(c(3, true, "T3", "D")).floor], [2800, 2600]);
});

test("flamenco dancer 2h: default and other durations are unchanged", () => {
  assert.deepEqual([lookupPrice(c(3, false)).anchor, lookupPrice(c(3, false)).floor], [1800, 1650]);
  assert.equal(lookupPrice(c(2, true)).anchor, lookupPrice(c(2, false)).anchor, "the option exists only at 3 hours");
});

test("flamenco dancer 2h: classify asks, and only a real true counts", () => {
  assert.ok(buildClassifyPrompt("2026-10-03").includes('"extended_dancer": boolean'));
  assert.equal(normalizeExtendedDancer(true), true);
  for (const v of [false, "true", 1, undefined, null]) assert.equal(normalizeExtendedDancer(v), false);
});

test("flamenco dancer 2h: the draft is told the dancer performs 2 of the 3 hours", async () => {
  const { buildGeneratePrompt } = await import("./prompts/generate.js");
  const cl = { ...c(3, true), action: "quote", flagged_concerns: [], cultural_context_active: false, tier: "standard",
    platform: "yelp", format_requested: "flamenco", venue_name: null, client_first_name: null, stealth_premium_signals: [],
    context_modifiers: [], close_type: "soft_hold", timeline_band: "comfortable" } as unknown as Classification;
  assert.ok(buildGeneratePrompt(cl, lookupPrice(cl), "ctx").includes("the dancer performs 2 of the 3 hours"));
  const plain = { ...cl, extended_dancer: false } as Classification;
  assert.ok(!buildGeneratePrompt(plain, lookupPrice(plain), "ctx").includes("the dancer performs 2 of the 3 hours"));
});
