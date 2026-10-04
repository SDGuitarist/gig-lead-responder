import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Alex 2026-10-03: PRICING_TABLES.md (loaded into every draft) held stale prices
// (duo $600-700 vs $1,100 today, mariachi 2h $1,600 vs $1,800). Prices now come
// only from src/data/rates.ts via lookupPrice. The only dollar figure left is the
// $500 minimum rule.
test("pricing reference holds no prices except the $500 minimum rule", () => {
  const doc = readFileSync("docs/PRICING_TABLES.md", "utf-8");
  const amounts = [...new Set(doc.match(/\$[\d,]+/g) ?? [])];
  assert.deepEqual(amounts, ["$500"]);
  for (const kept of ["$500 minimum booking floor", "When to Recommend Which", "Zone Definitions"]) {
    assert.ok(doc.includes(kept), `control: kept ${kept}`);
  }
});
