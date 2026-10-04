import { test } from "node:test";
import assert from "node:assert/strict";
import { lookupPrice, budgetGapFor } from "./pipeline/price.js";
import { RATE_TABLES } from "./data/rates.js";
import type { Classification } from "./types.js";

// Alex 2026-10-03: a request between card lengths rounds UP to the next card length
// (2.5 h → 3 h), never down to a shorter set than they asked for. Above the longest
// card length it stays at the longest (the draft is told the hours differ).
const c = (format: string, hours: number, budget: number | null = null) =>
  ({ format_recommended: format, duration_hours: hours, rate_card_tier: "T2", lead_source_column: "P",
     competition_level: "low", stated_budget: budget }) as unknown as Classification;

test("duration rounds up: every format, every request lands on the next card length", () => {
  const wrong: string[] = [];
  for (const [format, table] of Object.entries(RATE_TABLES)) {
    const lengths = Object.keys(table).map(Number).sort((a, b) => a - b);
    for (const asked of [0.5, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 3.5, 4, 4.5, 5]) {
      const want = lengths.find((d) => d >= asked) ?? lengths[lengths.length - 1];
      const got = lookupPrice(c(format, asked)).duration_hours;
      if (got !== want) wrong.push(`${format} asked ${asked}h: got ${got}h, want ${want}h`);
    }
  }
  assert.deepEqual(wrong, []);
});

test("duration rounds up: 2.5 h solo is priced as 3 h, exact lengths unchanged", () => {
  assert.equal(lookupPrice(c("solo", 2.5)).duration_hours, 3);
  assert.equal(lookupPrice(c("solo", 2)).duration_hours, 2);
  assert.equal(lookupPrice(c("mariachi_full", 1)).duration_hours, 2, "below the shortest: the minimum length");
});

test("duration rounds up: a budget gap still offers the next shorter card length", () => {
  const cl = c("solo", 2.5, 560);
  const p = lookupPrice(cl);
  const gap = budgetGapFor(cl, p);
  assert.equal(p.duration_hours, 3);
  assert.equal(gap.tier, "large", JSON.stringify(gap));
  assert.equal(gap.tier === "large" ? gap.scoped_alternative.duration_hours : 0, 2);
});
