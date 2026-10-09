import { test } from "node:test";
import assert from "node:assert/strict";
import { RATE_TABLES } from "./data/rates.js";
import { lookupPrice, t4FallbackHold } from "./pipeline/price.js";
import { withoutHoldNotes, type Classification } from "./types.js";

// Port manifest R403 (T4 luxury corporate: a company, DMC or planner paying at a five-star venue).
// Alex 2026-10-02/09: solo 2h $1,350/$1,200, 3h $1,800/$1,600, 4h $2,200/$2,000 (Project memory, confirmed);
// solo 1h $975/$875 (1.5x T3D, Alex 2026-10-09); duo and flamenco duo 1.5x T3D, rounded to the nearest
// $5 ending in 5 where 1.5x gives a half dollar (Alex 2026-10-09). One price per duration, like T1.
const AGREED: Record<string, Record<string, [number, number]>> = {
  solo: { "1": [975, 875], "2": [1350, 1200], "3": [1800, 1600], "4": [2200, 2000] },
  duo: { "2": [2550, 2250], "3": [3300, 2850], "4": [4200, 3675] },
  flamenco_duo: { "2": [2845, 2550], "3": [3600, 3150], "4": [4495, 3975] },
  // Sourced (Alex 2026-10-09): T4 only for a luxury-corporate lead, like solo and duo; 1.5x T3D, half dollars
  // to the nearest amount ending in 5. Higher margin on hired players is why he quotes them T4.
  sourced_cultural_solo: { "1": [1050, 935], "2": [1345, 1195], "3": [1800, 1650] },
  sourced_cultural_duo: { "1": [1345, 1200], "2": [2400, 2175], "3": [3445, 3150] },
  sourced_cultural_trio: { "1": [1650, 1500], "2": [3000, 2775], "3": [4345, 3975] },
  sourced_cultural_quartet: { "1": [2250, 2065], "2": [4345, 3975], "3": [6150, 5625] },
  sourced_cultural_5piece: { "1": [2700, 2475], "2": [5245, 4800], "3": [7495, 6825] },
};
test("port manifest R403 T4: every T4 cell is the price Alex approved", () => {
  for (const [format, rows] of Object.entries(AGREED)) {
    const table = RATE_TABLES[format as "solo"];
    for (const [h, [anchor, floor]] of Object.entries(rows)) assert.deepEqual(table[h].T4, { anchor, floor }, `${format} ${h}h`);
    const t4Rows = Object.keys(table).filter((h) => table[h].T4);
    assert.deepEqual(t4Rows.sort(), Object.keys(rows).sort(), `${format}: no T4 row Alex did not approve`);
  }
  for (const f of Object.keys(RATE_TABLES)) {
    if (f in AGREED) continue;
    assert.ok(Object.values(RATE_TABLES[f as "solo"]).every((r) => !r.T4), `${f}: no T4 rows`);
  }
});

const c = (format: string, hours: number, competition = "low") =>
  ({ format_recommended: format, duration_hours: hours, rate_card_tier: "T4", lead_source_column: "D",
     competition_level: competition, stated_budget: null, flagged_concerns: [] }) as unknown as Classification;
// The lookup is one T4 price per duration. WHO may get T4 (never a platform lead or a wedding ceremony,
// Alex 2026-10-09) is enforced in classify and classify-verify (src/port-manifest-t4-classify.test.ts).
test("port manifest R403 T4: lookup uses one T4 price per duration", () => {
  const p = lookupPrice(c("solo", 2));
  assert.equal(p.tier_key, "T4");
  assert.equal(p.quote_price, 1350);
  assert.equal(lookupPrice(c("solo", 3, "extreme")).quote_price, 1600, "extreme competition: the T4 floor");
  const duo1h = lookupPrice(c("duo", 1));
  assert.deepEqual([duo1h.duration_hours, duo1h.quote_price], [2, 2550], "no 1-hour duo: booked as 2 hours at T4");
  assert.equal(t4FallbackHold(c("solo", 2), p), null);
});

test("port manifest R403 T4: a format with no T4 price is priced at its T3 reference and held for Alex", () => {
  const cl = c("mariachi_full", 2);
  const p = lookupPrice(cl);
  assert.equal(p.tier_key, "T3D", "T3 reference price");
  const note = t4FallbackHold(cl, p);
  assert.equal(note, "t4: no T4 price for mariachi_full 2h; the draft uses the T3 price as a reference; Alex prices it");
  assert.deepEqual(withoutHoldNotes({ flagged_concerns: [note!] }).flagged_concerns, [], "kept out of the drafting prompts");
});

