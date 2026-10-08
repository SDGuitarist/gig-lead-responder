import { test } from "node:test";
import assert from "node:assert/strict";
import { postCheckDrafts } from "./pipeline/post-check.js";
import type { PricingResult } from "./types.js";

// Codex round 1 (no 1-hour duo) P1: the generate prompt says "The client asked for 1hr; this rate is
// for 2hr", but nothing checked the draft said so: "1-hour duo for $1,100" passed. When the priced
// hours exceed the hours asked (1h -> 2h duo/mariachi, 2.5h -> 3h anything), both drafts must state
// the priced hours, or the lead is held. Same hours asked and priced: not checked.
const duo2h = { format: "duo", duration_hours: 2, tier_key: "T2P", anchor: 1100, floor: 1000, quote_price: 1100,
  competition_position: "at anchor", budget: { tier: "none" }, travel: null } as PricingResult;
const hours = (full: string, compressed: string, askedHours: number, pricing: PricingResult = duo2h) =>
  postCheckDrafts(full, compressed, undefined, { pricing, askedHours }).violations.filter((v) => v.startsWith("priced_hours_"));

test("priced hours stated: a 1-hour duo ask priced at 2 hours must say 2 hours in both drafts", () => {
  assert.deepEqual(hours("A 1-hour duo set is $1,100.", "1 hour, $1,100.", 1), [
    "priced_hours_full: the client asked for 1h but the price is for 2h; the draft must say 2 hours",
    "priced_hours_compressed: the client asked for 1h but the price is for 2h; the draft must say 2 hours"]);
  for (const ok of ["two hours", "2 hours", "2-hour", "2 hr", "2hr", "Two-hour"]) {
    assert.deepEqual(hours(`You asked for one hour; duo bookings start at ${ok}, $1,100.`, `${ok}, $1,100.`, 1), [], ok);
  }
  assert.equal(hours("Two hours, $1,100.", "1 hour, $1,100.", 1).length, 1, "the compressed draft alone is caught");
});

test("priced hours stated: 2.5 asked priced at 3 needs 3 hours; same hours asked and priced is not checked", () => {
  const solo3h = { ...duo2h, format: "solo", duration_hours: 3, quote_price: 750 } as PricingResult;
  assert.equal(hours("Two and a half hours, $750.", "$750.", 2.5, solo3h).length, 2);
  assert.deepEqual(hours("Three hours, $750.", "3 hours, $750.", 2.5, solo3h), []);
  assert.deepEqual(hours("A great set, $1,100.", "$1,100.", 2), [], "asked 2, priced 2");
  assert.deepEqual(hours("A great set, $1,100.", "$1,100.", 1, { ...duo2h, quote_price: 0 }), [], "placeholder pricing");
  assert.deepEqual(postCheckDrafts("1 hour", "1 hour", undefined, { pricing: duo2h }).violations
    .filter((v) => v.startsWith("priced_hours_")), [], "no askedHours given: not checked");
});
