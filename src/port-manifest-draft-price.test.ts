import { test } from "node:test";
import assert from "node:assert/strict";
import { postCheckDrafts } from "./pipeline/post-check.js";
import type { PricingResult } from "./types.js";

// Port manifest R058/R072/R104 (Alex 2026-10-06, option a): the computed price never goes below
// floor, but nothing checked the price the model WRITES. A draft stating a dollar figure below
// the floor is now a post-check violation (verified = false, so the lead is held), unless the
// app itself supplied that figure to the model. Solo T2P 2h: anchor $595, floor $550.
// Alex 2026-10-07: the client's stated budget is NOT exempt ("$400 works for me" is the likeliest
// too-low price); a draft that echoes a below-floor budget is held too, by design.
const base: PricingResult = { format: "solo", duration_hours: 2, tier_key: "T2P", anchor: 595, floor: 550, quote_price: 595,
  competition_position: "at anchor", budget: { tier: "none" }, travel: null };
const check = (draft: string, pricing: PricingResult = base) =>
  postCheckDrafts(draft, "Alex Guillen", undefined, { pricing }).violations.filter((v) => v.startsWith("price_below_"));

test("port manifest R058: a written price below the floor is held; the quote itself passes", () => {
  assert.deepEqual(check("Two hours of solo guitar is $595. A 50% deposit holds the date."), []);
  const v = check("Two hours of solo guitar is $450.");
  assert.equal(v.length, 1);
  assert.equal(v[0], "price_below_quote_full: $450 is below the $595 quote and is not a figure the app supplied");
  assert.deepEqual(postCheckDrafts("Hi", "It's $1,200 or $400 for less.", undefined, { pricing: base })
    .violations.filter((x) => x.startsWith("price_below_")), ["price_below_quote_compressed: $400 is below the $595 quote and is not a figure the app supplied"]);
});

test("port manifest R058: every figure the app supplies is allowed, even below the floor", () => {
  const travel = { ...base, travel: { fee: 150, band: "Near", miles: 40, zip: "92025", musician_stipend: 0, custom_quote_required: false } } as PricingResult;
  assert.deepEqual(check("All in, $745 including travel; the $150 travel is built in. $373 holds the date.", travel), []);
  assert.deepEqual(check("A $298 deposit holds the date."), [], "half of the quote, rounded either way");
  assert.deepEqual(check("A $297 deposit holds the date."), []);
  const scoped = { ...base, budget: { tier: "large", gap: 195, scoped_alternative: { duration_hours: 1, price: 500 } } } as PricingResult;
  assert.deepEqual(check("For one hour, $500 works.", scoped), []);
  const residency = { ...base, residency: { tier: "R2", cadence: "weekly", hours: 2, rate: 350, floor: 350, reason: null } } as PricingResult;
  assert.deepEqual(check("Weekly, $350 per night.", residency), []);
  const noScope = { ...base, budget: { tier: "no_viable_scope", gap: 300 } } as PricingResult;
  assert.deepEqual(check("The shortest set I offer is $500.", noScope), [], "solo T2P minimum floor across durations");
  assert.deepEqual(check("Insurance: $1M / $2M coverage, $2,000,000 aggregate."), [], "large figures are not below the floor");
});

test("port manifest R058: no pricing given, or a zero placeholder price, checks nothing", () => {
  assert.deepEqual(postCheckDrafts("It is $100.", "x").violations.filter((v) => v.startsWith("price_below_")), []);
  assert.deepEqual(check("It is $100.", { ...base, floor: 0, quote_price: 0, anchor: 0 }), []);
  assert.ok(!check("It is $100.").every((v) => !v.includes("$100")), "control: the same text IS caught with real pricing");
});

test("port manifest R058: a reply that accepts (or echoes) a below-floor budget is held", () => {
  const lowBudget = { ...base, budget: { tier: "large", gap: 150, scoped_alternative: { duration_hours: 1, price: 500 } } } as PricingResult;
  assert.match(check("$400 works for me, see you there!", lowBudget).join(" "), /\$400 is below the \$595 quote/);
  assert.match(check("I hear you on the $400 budget. For one hour, $500 works.", lowBudget).join(" "), /\$400 is below/);
});

// Codex round 1 (written price) P1s: the small-gap amount the prompt supplies was held, and the
// amount reader missed "400 dollars" and misread "$1.5k" as $1.
test("port manifest R058: the supplied budget gap passes; the stated budget still does not", () => {
  const small = { ...base, budget: { tier: "small", gap: 50 } } as PricingResult;
  assert.deepEqual(check("It's just $50 over what you planned; two hours is $595.", small), []);
  assert.match(check("$545 works for me.", small).join(" "), /\$545 is below/);
});

test("port manifest R058: amount shapes are read as the amounts they are", () => {
  for (const held of ["400 dollars", "400 USD", "US$400", "$ 450", "$450.00", "$400-ish", "a flat 400 bucks"]) {
    assert.equal(check(`Two hours is ${held}.`).length, 1, held);
  }
  for (const fine of ["$1.5k", "$1.5K", "$2k", "$600.00", "$1,200", "1,500 dollars", "$1M", "$2 million"]) {
    assert.deepEqual(check(`Two hours is ${fine}.`), [], fine);
  }
});

// Alex 2026-10-07 (option c, his catch): the floor alone let a draft undercut the quote ($560 vs
// $595) and still go out. The threshold is now the QUOTE; figures above it are not checked.
test("port manifest R058: a written price that undercuts the quote is held, even above the floor", () => {
  assert.match(check("Two hours is $560.").join(" "), /^price_below_quote_full: \$560 is below the \$595 quote/);
  assert.deepEqual(check("Two hours is $595; the full evening is $800."), [], "above the quote is not checked");
});

// Codex round 2 (written price) P1: "$1,2345" was read as $1,234. A malformed amount is now HELD
// as unreadable (a typo costs a review, never money); sentence punctuation after a number is fine.
test("port manifest R058: a malformed amount is held as unreadable; trailing punctuation is not malformed", () => {
  assert.deepEqual(postCheckDrafts("Two hours is $1,2345.", "x", undefined, { pricing: base }).violations
    .filter((v) => v.startsWith("price_")), ["price_unreadable_full: $1,2345 is not a readable amount"]);
  assert.deepEqual(check("Two hours is $595, and a 50% deposit holds it."), []);
  assert.deepEqual(check("It is $1,200, plus travel."), []);
  assert.equal(check("$400/hr").length, 1);
  assert.equal(check("$400 per hour").length, 1);
});

test("port manifest R058: with a travel fee the threshold is the total the client is told", () => {
  const travel = { ...base, travel: { fee: 150, band: "Near", miles: 40, zip: "92025", musician_stipend: 0, custom_quote_required: false } } as PricingResult;
  assert.match(check("All in, $700.", travel).join(" "), /\$700 is below the \$745 quote/);
  assert.deepEqual(check("All in, $745.", travel), []);
});
