import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildGeneratePrompt } from "./prompts/generate.js";
import type { Classification, PricingResult } from "./types.js";

// Plan 2026-10-09 app-inserted price block, H6 (Codex plan rounds 1-2): the generate prompt for every non-NP2
// lead must stay byte-identical while the NP2 price line moves into the app. The fixture was captured from the
// code BEFORE that change (commit 9c78924, before every edit to src/prompts/generate.ts in that work; checked
// from git history in plan step 7). During the work it also pinned the full prompt (SHA-256 + length); those
// checks expired in step 7 (Alex 2026-10-09) so later unrelated prompt edits (voice, cultural wording) do not
// fail here. What stays: the PRICE LINE section of each non-NP2 case, which should change only deliberately.
interface Golden {
  name: string; classification: Classification; pricing: PricingResult;
  priceLineSection: string | null;
}
const golden: Golden[] = JSON.parse(readFileSync(new URL("./fixtures/price-line-golden.json", import.meta.url), "utf8"));
const section = (p: string) => {
  const i = p.indexOf("\n## PRICE LINE");
  if (i < 0) return null;
  const j = p.indexOf("\n## ", i + 1);
  return p.slice(i, j < 0 ? undefined : j);
};

test("price block H6: non-NP2 PRICE LINE sections are unchanged from the pre-change capture", () => {
  assert.deepEqual(golden.map((g) => g.name), ["one-price T2 solo", "two-price large-gap scoped alternative", "duo",
    "no-viable-scope", "one-price with a travel fee"]);
  for (const g of golden) {
    const prompt = buildGeneratePrompt(g.classification, g.pricing, "ctx");
    assert.equal(section(prompt), g.priceLineSection, `${g.name}: PRICE LINE section`);
  }
});
