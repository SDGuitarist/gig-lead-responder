import { test } from "node:test";
import assert from "node:assert/strict";
import { buildClassifyPrompt } from "./prompts/classify.js";
import { classifyLead } from "./pipeline/classify.js";
import { setClaudeRequesterForTests } from "./claude.js";
import { budgetGapFor, inKindSentence, lookupPrice, nonprofitPriceNote } from "./pipeline/price.js";
import { buildGeneratePrompt } from "./prompts/generate.js";
import { postCheckDrafts } from "./pipeline/post-check.js";
import { verifyClassificationHeuristics } from "./pipeline/classify-verify.js";
import { withoutHoldNotes, type Classification, type PricingResult } from "./types.js";

// Port manifest R403, NP2 (Alex 2026-10-09). NP2 = established foundation, solo only: 1h $500, 2h $695,
// quoted AT the floor. NP1, NP3, NP2 3-4h and any NP duo: no NP price, held. Alex chose a classifier field
// to tell the NP tiers apart, with these definitions; unsure is null (held, no NP price).
const valid = {
  mode: "evaluation", action: "quote", vagueness: "clear", competition_level: "low", competition_quote_count: 0,
  stealth_premium: false, stealth_premium_signals: [], tier: "standard", rate_card_tier: "T2", lead_source_column: "D",
  price_point: "full_premium", format_requested: "guitarist", format_recommended: "solo", duration_hours: 2,
  stated_budget: null, event_date_iso: null, timeline_band: "comfortable", close_type: "soft_hold", event_energy: null,
  cultural_context_active: false, cultural_tradition: null, planner_effort_active: false, social_proof_active: false,
  context_modifiers: [], flagged_concerns: [], venue_name: null, client_first_name: null,
};
async function classifyAs(out: Record<string, unknown>) {
  setClaudeRequesterForTests((async () => ({ id: "m", type: "message", role: "assistant", model: "t", stop_reason: "end_turn",
    stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 },
    content: [{ type: "text", text: JSON.stringify(out) }] })) as never);
  try { return await classifyLead("lead text", "2026-10-09"); } finally { setClaudeRequesterForTests(); }
}

test("port manifest R403 NP2: the classify prompt defines NP1, NP2 and NP3 (Alex's definitions) and unsure is null", () => {
  const p = buildClassifyPrompt("2026-10-09");
  assert.match(p, /"np_tier": "NP1" \| "NP2" \| "NP3" \| null/);
  assert.match(p, /NP1[^\n]*grassroots[^\n]*volunteer-run[^\n]*PTA/i);
  assert.match(p, /NP2[^\n]*established foundation[^\n]*development team/i);
  assert.match(p, /NP3[^\n]*institutional[^\n]*hospital, university, museum/i);
  assert.match(p, /unsure[^\n]*null/i);
});

test("port manifest R403 NP2: np_tier parses only NP1/NP2/NP3, and only for a nonprofit buyer", async () => {
  for (const t of ["NP1", "NP2", "NP3"]) {
    assert.equal((await classifyAs({ ...valid, nonprofit_buyer: true, np_tier: t })).np_tier, t);
  }
  for (const v of ["np2", "NP4", "T2", 2, true, null, undefined]) {
    assert.equal((await classifyAs({ ...valid, nonprofit_buyer: true, np_tier: v })).np_tier, null, String(v));
  }
  assert.equal((await classifyAs({ ...valid, nonprofit_buyer: false, np_tier: "NP2" })).np_tier, null, "not a nonprofit buyer: no NP tier");
});

// Step 2 (Alex 2026-10-09): NP2 solo 1h $500, 2h $695, quoted AT the floor (anchor = floor). The in-kind
// line needs the price the lead would get WITHOUT the NP track (the normal lookup): it is kept as
// in_kind.standard. Alex: when that standard is not at least $100 above the NP price, no NP price (a $5
// or $50 contribution line is not worth sending); the lead keeps its normal price and stays held. NP1, NP3, unsure, 3-4h, duo, T4, residency: same.
const notes = (text: string, np: boolean) =>
  verifyClassificationHeuristics(text, { ...valid, nonprofit_buyer: np } as unknown as Classification).warnings;
const lead = (over: Partial<Classification> = {}) =>
  ({ ...valid, nonprofit_buyer: true, np_tier: "NP2", ...over }) as unknown as Classification;
test("port manifest R403 NP2: an NP2 solo 1h or 2h is quoted at the NP2 floor with the standard price kept", () => {
  const two = lookupPrice(lead({ rate_card_tier: "T3", lead_source_column: "P" }));
  assert.deepEqual([two.tier_key, two.anchor, two.floor, two.quote_price, two.in_kind?.standard], ["NP2", 695, 695, 695, 795]);
  const one = lookupPrice(lead({ duration_hours: 1, rate_card_tier: "T3", lead_source_column: "D" }));
  assert.deepEqual([one.tier_key, one.quote_price, one.in_kind?.standard], ["NP2", 500, 650]);
  const flex = lookupPrice(lead({ competition_level: "extreme", rate_card_tier: "T3", lead_source_column: "D" }));
  assert.deepEqual([flex.quote_price, flex.in_kind?.standard], [695, 795], "competition never moves NP2 off the floor; standard is the normal quote");
  const halfHour = lookupPrice(lead({ duration_hours: 1.5, rate_card_tier: "T3", lead_source_column: "P" }));
  assert.deepEqual([halfHour.tier_key, halfHour.duration_hours, halfHour.quote_price], ["NP2", 2, 695], "1.5h rounds up to the 2h NP2 price");
});
test("port manifest R403 NP2: no NP price unless the standard price is at least $100 above it", () => {
  // 2h: T1 $500, T2P $595, T2D $700 ($5); 1h: T1 $500, T2P $550 ($50), T2D $595 ($95); 2h T3P under high competition $761 ($66).
  for (const [hours, tier, col, comp] of [[2, "T1", "D", "low"], [2, "T2", "P", "low"], [2, "T2", "D", "low"], [1, "T1", "D", "low"],
    [1, "T2", "P", "low"], [1, "T2", "D", "low"], [2, "T3", "P", "high"]] as const) {
    const p = lookupPrice(lead({ duration_hours: hours, rate_card_tier: tier, lead_source_column: col, competition_level: comp }));
    assert.equal(p.in_kind, undefined, `${hours}h ${tier}${col} ${comp}`);
    assert.notEqual(p.tier_key, "NP2", `${hours}h ${tier}${col} ${comp}`);
  }
  const boundary = lookupPrice(lead({ duration_hours: 1, rate_card_tier: "T3", lead_source_column: "P" }));
  assert.deepEqual([boundary.tier_key, boundary.quote_price, boundary.in_kind?.standard], ["NP2", 500, 600], "exactly $100 above: priced");
});
test("port manifest R403 NP2: NP1, NP3, unsure, 3-4h, duo, T4, residency and a non-nonprofit get no NP price", () => {
  const t3 = { rate_card_tier: "T3", lead_source_column: "D" } as const;
  for (const [label, over] of [
    ["NP1", { np_tier: "NP1" }], ["NP3", { np_tier: "NP3" }], ["unsure", { np_tier: null }],
    ["3h", { duration_hours: 3 }], ["4h", { duration_hours: 4 }], ["duo", { format_recommended: "duo" }],
    ["T4", { rate_card_tier: "T4" }], ["residency", { engagement_type: "residency" }],
    ["not a nonprofit buyer", { nonprofit_buyer: false }],
  ] as const) {
    const p = lookupPrice(lead({ ...t3, ...over } as Partial<Classification>));
    assert.notEqual(p.tier_key, "NP2", label);
    assert.equal(p.in_kind, undefined, label);
  }
});
test("port manifest R403 NP2: a budget below the 2h NP2 price scopes down to the 1h NP2 price", () => {
  const c = lead({ rate_card_tier: "T3", lead_source_column: "D", stated_budget: 550 });
  const p = lookupPrice(c);
  assert.deepEqual(budgetGapFor(c, p), { tier: "large", gap: 145, scoped_alternative: { duration_hours: 1, price: 500 } });
});

// Step 3 (Alex 2026-10-09): a priced NP2 lead is STILL held (Alex reviews before sending); every other
// nonprofit lead says why it has no NP price. Both are hold notes, never shown to the drafter.
test("port manifest R403 NP2: every nonprofit lead stays held, and the note says whether NP2 priced it", () => {
  assert.deepEqual(notes("Donor dinner", true).filter((x) => x.startsWith("nonprofit:")),
    ["nonprofit: NP track (decided by who pays, not the venue); Alex reviews every nonprofit lead before it is sent"]);
  const priced = lead({ rate_card_tier: "T3", lead_source_column: "P" });
  assert.equal(nonprofitPriceNote(priced, lookupPrice(priced)),
    "nonprofit: NP2 solo 2h at $695 (standard $795, in-kind line in the drafts); Alex reviews before sending");
  const low = lead({ rate_card_tier: "T2", lead_source_column: "P" });
  assert.equal(nonprofitPriceNote(low, lookupPrice(low)),
    "nonprofit: no NP price (NP2 solo 2h, standard $595 is not $100 above the NP2 $695); the draft uses the standard price; Alex prices it");
  const np1 = lead({ np_tier: "NP1", rate_card_tier: "T3", lead_source_column: "D" });
  assert.equal(nonprofitPriceNote(np1, lookupPrice(np1)),
    "nonprofit: no NP price (NP1 solo 2h has no NP rate); the draft uses the standard price; Alex prices it");
  const unsure = lead({ np_tier: null, format_recommended: "duo", rate_card_tier: "T3", lead_source_column: "D" });
  assert.equal(nonprofitPriceNote(unsure, lookupPrice(unsure)),
    "nonprofit: no NP price (NP tier unsure duo 2h has no NP rate); the draft uses the standard price; Alex prices it");
  const t4 = lead({ rate_card_tier: "T4" });
  assert.equal(nonprofitPriceNote(t4, lookupPrice(t4)),
    "nonprofit: no NP price (NP2 solo 2h was classified T4); the draft uses the standard price; Alex prices it");
  const res = lead({ engagement_type: "residency", rate_card_tier: "T3", lead_source_column: "D" });
  assert.equal(nonprofitPriceNote(res, lookupPrice(res)),
    "nonprofit: no NP price (NP2 solo 2h is a residency); the draft uses the standard price; Alex prices it");
  const notNp = lead({ nonprofit_buyer: false, rate_card_tier: "T3", lead_source_column: "D" });
  assert.equal(nonprofitPriceNote(notNp, lookupPrice(notNp)), null);
  for (const n of [nonprofitPriceNote(priced, lookupPrice(priced)), nonprofitPriceNote(np1, lookupPrice(np1))]) {
    const c = { ...priced, flagged_concerns: [n as string] } as Classification;
    assert.deepEqual(withoutHoldNotes(c).flagged_concerns, [], "never reaches the drafting prompts");
  }
});

// Step 4: the in-kind line, in Alex's own words (his Sept 28, 2026 sent reply). The app writes the
// amount; the model fills [organization] from the lead (Alex 2026-10-09); [venue] is the venue name when
// known, else the word is dropped. Only on a one-price draft: with a scoped alternative or the minimum-set
// redirect there is no single standard to name, and the hold note says the line was left out.
const priced = (over: Partial<Classification> = {}, budget = 0) => {
  const c = lead({ rate_card_tier: "T3", lead_source_column: "P", ...(budget ? { stated_budget: budget } : {}), ...over });
  const p = lookupPrice(c);
  return { c, p: { ...p, budget: budgetGapFor(c, p) } };
};
test("port manifest R403 NP2: the in-kind sentence is Alex's own, with the venue when known and travel in both numbers", () => {
  const { c, p } = priced({ venue_name: "Example Hotel" });
  assert.equal(inKindSentence(c, p), "My standard Example Hotel rate is $795, so the difference is my in-kind contribution to [organization].");
  const noVenue = priced();
  assert.equal(inKindSentence(noVenue.c, noVenue.p), "My standard rate is $795, so the difference is my in-kind contribution to [organization].");
  const travel = { ...noVenue.p, travel: { fee: 75, band: "Regional", miles: 40, zip: "92000", musician_stipend: 0, custom_quote_required: false } } as PricingResult;
  assert.match(inKindSentence(noVenue.c, travel) ?? "", /rate is \$870,/, "the standard is told with the same travel fee as the NP price");
  const unpriced = priced({ rate_card_tier: "T2" });
  assert.equal(inKindSentence(unpriced.c, unpriced.p), null, "no NP price, no line");
  const scoped = priced({}, 550);
  assert.equal(scoped.p.budget.tier, "large");
  assert.equal(inKindSentence(scoped.c, scoped.p), null, "two prices: no single standard");
  const redirect = priced({}, 200);
  assert.equal(redirect.p.budget.tier, "no_viable_scope");
  assert.equal(inKindSentence(redirect.c, redirect.p), null);
  const small = priced({}, 650);
  assert.equal(small.p.budget.tier, "small");
  assert.ok(inKindSentence(small.c, small.p), "a small gap still states one price: the line stays");
  assert.match(nonprofitPriceNote(scoped.c, scoped.p) ?? "", /two prices in the draft: no in-kind line; Alex adds it/);
});
test("port manifest R403 NP2: the drafting prompt carries the in-kind line word for word, only when it applies", () => {
  const { c, p } = priced({ venue_name: "Example Hotel" });
  const prompt = buildGeneratePrompt(c, p, "ctx");
  assert.match(prompt, /## IN-KIND LINE/);
  assert.ok(prompt.includes("My standard Example Hotel rate is $795, so the difference is my in-kind contribution to [organization]."));
  assert.match(prompt, /replace \[organization\] with the organization's name as the lead gives it/i);
  const unpriced = priced({ rate_card_tier: "T2" });
  assert.doesNotMatch(buildGeneratePrompt(unpriced.c, unpriced.p, "ctx"), /IN-KIND LINE|in-kind contribution/);
});

// Step 5: a one-price NP2 draft without the line, with a changed amount or wording, or with
// [organization] left unfilled, is held (post-check), in either draft.
test("port manifest R403 NP2: the post-check holds a draft whose in-kind line is missing, changed or unfilled", () => {
  const { p } = priced();
  const expected = "My standard rate is $795, so the difference is my in-kind contribution to [organization].";
  const good = "Solo guitar, $695, 2 hours\nMy standard rate is $795, so the difference is my in-kind contribution to the Example Foundation.";
  const v = (full: string, compressed = good, inKind: string | null = expected) =>
    postCheckDrafts(full, compressed, undefined, { pricing: p, askedHours: 2, inKind }).violations.filter((x) => x.startsWith("in_kind_line"));
  assert.deepEqual(v(good), []);
  assert.deepEqual(v(good.replace("the Example Foundation", "St. Mary's Example Foundation")), [], "a period inside the name is fine");
  assert.deepEqual(v("Solo guitar, $695, 2 hours"), ["in_kind_line_full: the NP2 draft must carry Alex's in-kind line word for word"]);
  assert.deepEqual(v(good, "Solo guitar, $695, 2 hours"), ["in_kind_line_compressed: the NP2 draft must carry Alex's in-kind line word for word"]);
  assert.equal(v(good.replace("$795", "$800")).length, 1, "a changed amount");
  assert.equal(v(good.replace("the difference", "the gap")).length, 1, "changed wording");
  assert.equal(v(good.replace("the Example Foundation", "[organization]")).length, 1, "the placeholder left in");
  assert.equal(v(good.replace(" the Example Foundation", "")).length, 1, "no organization at all");
  assert.equal(v(good.replace("the Example Foundation", "...")).length, 1, "punctuation, no name");
  assert.deepEqual(v("Solo guitar, $695, 2 hours", "x", null), [], "no line expected: not checked");
});
