import { test } from "node:test";
import assert from "node:assert/strict";
import { buildClassifyPrompt } from "./prompts/classify.js";

// Port manifest R358 (prompt half): the competition count comes only from the
// platform's displayed number, else 0. Calls the real prompt builder.
test("port manifest R358: classify prompt forbids estimating competition", () => {
  const p = buildClassifyPrompt("2026-10-03");
  assert.ok(p.includes("COMPETITION EXTRACTION RULE"));
  assert.match(p, /no displayed count.*competition_quote_count = 0/is);
  assert.match(p, /never estimate/i);
});
