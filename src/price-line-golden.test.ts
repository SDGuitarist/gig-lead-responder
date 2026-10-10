import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { buildGeneratePrompt } from "./prompts/generate.js";
import type { Classification, PricingResult } from "./types.js";

// Plan 2026-10-09 app-inserted price block, H6 (Codex plan rounds 1-2): the generate prompt for every non-NP2
// lead must stay byte-identical while the NP2 price line moves into the app. The fixture was captured from the
// code BEFORE that change (its own commit, before any edit to src/prompts/generate.ts) and holds each case's
// inputs, the SHA-256 of the full prompt, and the PRICE LINE section (readable when a case fails). Never
// regenerate it inside that work: a regenerated golden proves nothing.
// EXPIRY (Alex 2026-10-09): the full-prompt checks (length + SHA-256) guard only that work and are deleted in
// its plan step 7, so later unrelated prompt edits (voice, cultural wording) do not fail here. The PRICE LINE
// section check stays: it fails only when the price line itself changes, which should be deliberate.
interface Golden {
  name: string; classification: Classification; pricing: PricingResult;
  promptSha256: string; promptLength: number; priceLineSection: string | null;
}
const golden: Golden[] = JSON.parse(readFileSync(new URL("./fixtures/price-line-golden.json", import.meta.url), "utf8"));
const section = (p: string) => {
  const i = p.indexOf("\n## PRICE LINE");
  if (i < 0) return null;
  const j = p.indexOf("\n## ", i + 1);
  return p.slice(i, j < 0 ? undefined : j);
};

test("price block H6: non-NP2 generate prompts are byte-identical to the pre-change capture", () => {
  assert.deepEqual(golden.map((g) => g.name), ["one-price T2 solo", "two-price large-gap scoped alternative", "duo",
    "no-viable-scope", "one-price with a travel fee"]);
  for (const g of golden) {
    const prompt = buildGeneratePrompt(g.classification, g.pricing, "ctx");
    assert.equal(section(prompt), g.priceLineSection, `${g.name}: PRICE LINE section`);
    assert.equal(prompt.length, g.promptLength, `${g.name}: prompt length`);
    assert.equal(createHash("sha256").update(prompt).digest("hex"), g.promptSha256, `${g.name}: full prompt`);
  }
});
