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

test("port manifest R295: T1 duo and flamenco duo at 3h or more are held; shorter or higher tiers are not", () => {
  assert.equal(minimumProfitHold(pr("duo", 3, 700, "T1")),
    "minimum_profit: T1 duo 3h at the flat T1 price; the second musician's hours may leave under $150; Alex prices it");
  assert.ok(minimumProfitHold(pr("flamenco_duo", 4, 750, "T1"))?.startsWith("minimum_profit: T1 flamenco_duo 4h"));
  assert.equal(minimumProfitHold(pr("duo", 2, 700, "T1")), null);
  assert.equal(minimumProfitHold(pr("duo", 3, 1275, "T2P")), null);
  assert.equal(minimumProfitHold(pr("solo", 4, 500, "T1")), null, "solo has no musician cost");
  assert.equal(minimumProfitHold(pr("mariachi_full", 4, 500, "T1")), null, "no cost data: not checked (known gap)");
});

test("port manifest R295: the note holds the lead but never reaches the drafting prompts", () => {
  const note = minimumProfitHold(pr("duo", 3, 700, "T1"))!;
  assert.deepEqual(withoutHoldNotes({ flagged_concerns: [note, "real concern"] }).flagged_concerns, ["real concern"]);
});
