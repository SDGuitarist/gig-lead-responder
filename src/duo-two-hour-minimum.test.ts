import { test } from "node:test";
import assert from "node:assert/strict";
import { detectBudgetGap, lookupPrice } from "./pipeline/price.js";
import { RATE_TABLES } from "./data/rates.js";
import type { Classification } from "./types.js";

// Alex 2026-10-07: no 1-hour duo or flamenco duo. Like mariachi, a 1-hour request becomes a 2-hour
// booking at the 2-hour price, and the draft says so ("The client asked for 1hr; this rate is for
// 2hr", pinned for every format in src/priced-duration-label.test.ts). Sourced duo is unchanged.
const c = (format: string, hours: number, tier = "T2", column = "P", competition = "low") =>
  ({ format_recommended: format, duration_hours: hours, rate_card_tier: tier, lead_source_column: column,
     competition_level: competition, stated_budget: null }) as unknown as Classification;

test("duo two-hour minimum: a 1-hour duo or flamenco duo request is priced as 2 hours", () => {
  for (const format of ["duo", "flamenco_duo"]) {
    assert.equal(RATE_TABLES[format as "duo"]["1"], undefined, `${format}: no 1-hour row`);
    for (const [tier, column] of [["T1", "P"], ["T2", "P"], ["T2", "D"], ["T3", "P"], ["T3", "D"]]) {
      const one = lookupPrice(c(format, 1, tier, column));
      const two = lookupPrice(c(format, 2, tier, column));
      assert.equal(one.duration_hours, 2, `${format} ${tier}${column}`);
      assert.equal(one.quote_price, two.quote_price, `${format} ${tier}${column}: the 2-hour price`);
    }
  }
  assert.equal(lookupPrice(c("duo", 1)).quote_price, 1100, "duo T2P at anchor: $1,100");
  assert.equal(lookupPrice(c("flamenco_duo", 1, "T3", "D")).quote_price, 1895, "flamenco duo T3D at anchor: $1,895");
});

test("duo two-hour minimum: a 2-hour duo is never offered a 1-hour set as the cheaper option", () => {
  for (const format of ["duo", "flamenco_duo"] as const) {
    for (let budget = 100; budget < 1000; budget += 25) {
      const g = detectBudgetGap(budget, 1000, format, 2, "T2P");
      assert.notEqual(g.tier, "large", `${format} budget ${budget}: no scoped 1-hour alternative`);
    }
  }
});

test("duo two-hour minimum: sourced duo and solo keep their 1-hour prices (control)", () => {
  assert.ok(RATE_TABLES.sourced_cultural_duo["1"], "sourced duo keeps 1 hour");
  assert.equal(lookupPrice(c("sourced_cultural_duo", 1)).duration_hours, 1);
  assert.equal(lookupPrice(c("solo", 1)).duration_hours, 1);
});
