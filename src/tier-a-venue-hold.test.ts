import { test } from "node:test";
import assert from "node:assert/strict";
import { verifyClassificationHeuristics } from "./pipeline/classify-verify.js";
import { buildClassifyPrompt } from "./prompts/classify.js";
import type { Classification } from "./types.js";

// Alex 2026-10-03: a Tier A venue is auto-premium (classify Step 2.75), and any
// premium signal means T3 (Step 4). That was the model's judgment alone: the code
// guard checked stealth_premium, not the tier pricing reads, and its venue list had
// drifted from the prompt's. Now a Tier A venue priced below T3 is held for Alex
// (any flagged concern holds the lead, src/automation/router.ts).
const c = (rate_card_tier: string, stealth_premium = true) =>
  ({ format_recommended: "solo", rate_card_tier, stealth_premium, stated_budget: null, competition_quote_count: 0,
     cultural_context_active: false, flagged_concerns: [] }) as unknown as Classification;
const held = (text: string, cl: Classification) =>
  verifyClassificationHeuristics(text, cl).warnings.some((w) => w.includes("Tier A venue"));

const TIER_A = ["Hotel del Coronado", "Fairmont Grand Del Mar", "Lodge at Torrey Pines", "La Valencia Hotel",
  "Rancho Valencia", "L'Auberge Del Mar", "Estancia La Jolla", "The Prado at Balboa Park", "San Diego Museum of Art"];

test("tier A venue hold: every Tier A venue priced below T3 is held, naming the venue", () => {
  for (const v of TIER_A) {
    assert.ok(held(`Wedding reception at ${v}, 120 guests.`, c("T2")), `${v} at T2`);
    assert.ok(held(`Dinner at ${v.toLowerCase()}`, c("T3", false)), `${v}: stealth_premium false`);
  }
  const w = verifyClassificationHeuristics("Ceremony at L'Auberge Del Mar", c("T2")).warnings.join(" ");
  assert.match(w, /L'Auberge Del Mar.*T2/);
});

test("tier A venue hold: control, T3 with the premium flag is not held, and near-names are not Tier A", () => {
  for (const v of TIER_A) assert.ok(!held(`Wedding at ${v}`, c("T3")), `${v} at T3`);
  for (const text of ["Backyard party in Chula Vista", "Round of golf at Torrey Pines Golf Course, then lunch",
    "Valencia Park community center", "Dinner at the Westgate"]) {
    assert.ok(!held(text, c("T2", false)), text);
  }
});

test("tier A venue hold: the classify prompt lists exactly the venues the check knows", () => {
  const line = buildClassifyPrompt("2026-10-03").split("\n").find((l) => l.includes("Tier A venues (auto-premium"));
  assert.ok(line, "control: Tier A line is in the prompt");
  const listed = line!.split("): ")[1].split(", ").flatMap((n) => n.split(" / "));
  for (const v of listed) assert.ok(held(`Event at ${v}`, c("T2")), `prompt lists "${v}" but the check misses it`);
});
