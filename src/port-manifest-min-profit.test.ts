import { test } from "node:test";
import assert from "node:assert/strict";
import { minimumProfitHold } from "./pipeline/price.js";
import { RATE_TABLES } from "./data/rates.js";
import { withoutHoldNotes, type Format, type PricingResult } from "./types.js";

// Port manifest R295/R362: "$150 minimum profit on every booking, no exceptions" (Project).
// Alex 2026-10-07 (Claude's recommendations): check the formats with a real cost number, i.e.
// sourced ($200/hr per musician, the Project's rate); hold T1 duo / flamenco duo at 3h+ (a flat
// T1 price cannot carry a second musician's hours); no check for trio/mariachi/bolero (no cost
// data: known gap). Any flagged note holds the lead.
const travel = (fee: number, musician_stipend: number, extra: Record<string, unknown> = {}) =>
  ({ fee, band: "Near", miles: 40, zip: "92025", musician_stipend, custom_quote_required: fee === 0, ...extra });
const pr = (format: Format, duration_hours: number, quote_price: number, tier_key = "T2P") =>
  ({ format, duration_hours, tier_key, anchor: quote_price, floor: quote_price, quote_price, competition_position: "",
     budget: { tier: "none" }, travel: null }) as PricingResult;

test("port manifest R295: a sourced booking under $150 profit is held, naming the numbers", () => {
  assert.equal(minimumProfitHold(pr("sourced_cultural_trio", 2, 1300)),
    "minimum_profit: sourced_cultural_trio 2h at $1300 leaves $100 after $1200 for 3 musicians (under $150); Alex prices it");
  assert.equal(minimumProfitHold(pr("sourced_cultural_solo", 2, 549))?.startsWith("minimum_profit:"), true);
  assert.equal(minimumProfitHold(pr("sourced_cultural_solo", 2, 550)), null, "exactly $150 profit passes");
});

test("port manifest R295: every sourced rate cell clears $150 at its floor today", () => {
  const players: Record<string, number> = { sourced_cultural_solo: 1, sourced_cultural_duo: 2, sourced_cultural_trio: 3,
    sourced_cultural_quartet: 4, sourced_cultural_5piece: 5 };
  let cells = 0;
  for (const f of Object.keys(players) as Format[]) {
    for (const [h, tiers] of Object.entries(RATE_TABLES[f])) {
      for (const [tier, r] of Object.entries(tiers)) {
        if (!r) continue;
        cells++;
        assert.equal(minimumProfitHold(pr(f, Number(h), r.floor, tier)), null, `${f} ${h}h ${tier}`);
      }
    }
  }
  assert.ok(cells >= 60, `control: checked ${cells} cells`);
});

// Alex 2026-10-07: he pays the second musician $400-$600 for a 2-3h gig; the check uses $600 (never
// assumes he paid less). At 2-3h: profit = price + travel fee - $600 - stipend. 4h+ is outside his
// range: T1 stays held at the flat price. 1h: not checked.
test("port manifest R295: a 2-3h duo is checked against Alex's $600 payout", () => {
  assert.equal(minimumProfitHold(pr("duo", 2, 700, "T1")),
    "minimum_profit: duo 2h at $700 leaves $100 after $600 for the second musician (under $150); Alex prices it");
  assert.ok(minimumProfitHold(pr("duo", 3, 700, "T1"))?.startsWith("minimum_profit: duo 3h at $700 leaves $100"));
  assert.equal(minimumProfitHold(pr("flamenco_duo", 2, 750, "T1")), null, "exactly $150 passes");
  assert.equal(minimumProfitHold(pr("flamenco_duo", 3, 750, "T1")), null, "relaxed from the old 3h hold");
  assert.equal(minimumProfitHold(pr("duo", 2, 1000, "T2P")), null);
  assert.equal(minimumProfitHold({ ...pr("duo", 2, 700, "T1"), travel: travel(150, 50) } as PricingResult), null,
    "700 + 150 fee - 600 - 50 stipend = 200");
});

test("port manifest R295: T1 duos at 4h+ stay held; 1h, solo and uncosted formats are not checked", () => {
  assert.equal(minimumProfitHold(pr("duo", 4, 700, "T1")),
    "minimum_profit: T1 duo 4h at the flat T1 price; the second musician's hours may leave under $150; Alex prices it");
  assert.ok(minimumProfitHold(pr("flamenco_duo", 4, 750, "T1"))?.startsWith("minimum_profit: T1 flamenco_duo 4h"));
  assert.equal(minimumProfitHold(pr("duo", 4, 1575, "T2P")), null);
  assert.equal(minimumProfitHold(pr("duo", 1, 700, "T1")), null, "1h is outside Alex's range");
  assert.equal(minimumProfitHold(pr("solo", 4, 500, "T1")), null, "solo has no musician cost");
  assert.equal(minimumProfitHold(pr("mariachi_full", 4, 500, "T1")), null, "no cost data: not checked (known gap)");
});

test("port manifest R295: the note holds the lead but never reaches the drafting prompts", () => {
  const note = minimumProfitHold(pr("duo", 2, 700, "T1"))!;
  assert.deepEqual(withoutHoldNotes({ flagged_concerns: [note, "real concern"] }).flagged_concerns, ["real concern"]);
});

// Codex round 1 (minimum profit): travel was ignored, and the scoped alternative (a second price
// the client sees) was never checked. Per docs/TRAVEL_FEES.md the client pays the travel fee and
// the musician's stipend comes out of it, so: income = quote + fee (unless included), cost +=
// stipend.
test("port manifest R295: travel counts both ways (fee as income, stipend as cost)", () => {
  const custom = { ...pr("sourced_cultural_duo", 1, 550), travel: travel(0, 50) } as PricingResult;
  assert.equal(minimumProfitHold(custom),
    "minimum_profit: sourced_cultural_duo 1h at $550 leaves $100 after $400 for 2 musicians and a $50 travel stipend (under $150); Alex prices it");
  assert.equal(minimumProfitHold({ ...pr("sourced_cultural_duo", 1, 550), travel: travel(150, 50) } as PricingResult), null,
    "the client's travel fee covers the stipend");
  assert.ok(minimumProfitHold({ ...pr("sourced_cultural_duo", 1, 550), travel: travel(150, 50, { included_in_price: true }) } as PricingResult)
    ?.startsWith("minimum_profit:"), "a fee already inside the quote is not extra income");
});

test("port manifest R295: a scoped alternative under $150 profit is held too", () => {
  const scoped = { ...pr("sourced_cultural_trio", 2, 1450), budget: { tier: "large", gap: 500, scoped_alternative: { duration_hours: 1, price: 700 } } } as PricingResult;
  assert.equal(minimumProfitHold(scoped),
    "minimum_profit: sourced_cultural_trio scoped alternative 1h at $700 leaves $100 after $600 for 3 musicians (under $150); Alex prices it");
  const fine = { ...scoped, budget: { tier: "large", gap: 500, scoped_alternative: { duration_hours: 1, price: 775 } } } as PricingResult;
  assert.equal(minimumProfitHold(fine), null);
});
