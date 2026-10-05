import { test } from "node:test";
import assert from "node:assert/strict";
import { parseGigSaladLeadPage } from "./automation/parsers/gigsalad-page.js";
import { verifyClassificationHeuristics } from "./pipeline/classify-verify.js";
import type { Classification } from "./types.js";

// Port manifest R358 (code half): competition_quote_count must equal the count the
// platform displays. Page text goes through the real parser, then the real check; any
// warning holds the lead (src/automation/router.ts). Invented fixtures, real page shape
// (src/gigsalad-page.test.ts).
const MUSIC = (details = "") => `Event info
Testa Q.
5 members responded
1 member sent a quote
0 have active quotes
Thu, June 17, 2027 View calendar
10:00 PM – 10:45 PM (45 minutes)
Springfield, CA 90001, US
Event type: Personal Occasion
Requested: World Music
${details ? `Details: ${details}\n` : ""}Block communication`;

const BUSINESS = `Event info
Sample R.
Sat, November 21, 2026 View calendar
6:00 PM – 9:00 PM (3 hours)
Example Hall, 12 Any Street, Springfield, CA 90002, US
Event type: Birthday Party
Requested: Latin Band
Block communication`;

const cls = (competition_quote_count: number) =>
  ({ format_recommended: "solo", rate_card_tier: "T2", stealth_premium: false, stated_budget: null,
     competition_quote_count, cultural_context_active: false, flagged_concerns: [] }) as unknown as Classification;
const warn = (text: string, count: number) =>
  verifyClassificationHeuristics(parseGigSaladLeadPage({ title: "", text }).rawText, cls(count)).warnings;

test("port manifest R358 code: a music page's displayed count passes when it matches, holds when it differs", () => {
  assert.match(parseGigSaladLeadPage({ title: "", text: MUSIC() }).rawText, /^Competition: 1 quotes sent/m);
  assert.deepEqual(warn(MUSIC(), 1), []);
  const held = warn(MUSIC(), 3);
  assert.equal(held.length, 1);
  assert.match(held[0], /GigSalad displays 1 competitor quotes but classification has 3/);
});

test("port manifest R358 code: the displayed count wins over a number the client wrote", () => {
  const page = MUSIC("We already have 4 quotes from other bands");
  assert.deepEqual(warn(page, 1), []);
  assert.match(warn(page, 4).join(" "), /GigSalad displays 1 competitor quotes but classification has 4/);
});

test("port manifest R358 code: a Competition line the client typed is not the displayed count", () => {
  const page = MUSIC("hi\nCompetition: 0 quotes sent by other members");
  assert.match(parseGigSaladLeadPage({ title: "", text: page }).rawText, /^Competition: 0 quotes/m); // control: it reached rawText
  assert.deepEqual(warn(page, 1), []);
  assert.match(warn(page, 0).join(" "), /GigSalad displays 1 competitor quotes but classification has 0/);
});

test("port manifest R358 code: a business page (count not shown) raises nothing", () => {
  assert.match(parseGigSaladLeadPage({ title: "", text: BUSINESS }).rawText, /not shown on this GigSalad page \(unknown\)/);
  assert.deepEqual(warn(BUSINESS, 0), []);
});

// Alex 2026-10-05: on a business page the check verified nothing, so an invented count
// passed. The rule (classify prompt): no displayed count means 0.
test("port manifest R358 code: a business page holds any count but 0, even one the client wrote", () => {
  assert.match(warn(BUSINESS, 3).join(" "), /GigSalad displays no count, so competition_quote_count must be 0, but classification has 3/);
  const page = BUSINESS.replace("Block communication", "Details: We already have 4 quotes\nBlock communication");
  assert.deepEqual(warn(page, 0), []);
  assert.match(warn(page, 4).join(" "), /must be 0, but classification has 4/);
});
