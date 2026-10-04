import { test } from "node:test";
import assert from "node:assert/strict";
import { selectContext } from "./pipeline/context.js";
import type { Classification } from "./types.js";

// Alex 2026-10-03: RESPONSE_CRAFT.md (loaded for every lead) named duo/trio/quartet/
// 5-piece prices that were right only for T2P. Prices come from src/data/rates.ts via
// lookupPrice. A lead that triggers no conditional doc gets only the always-loaded docs.
const plain = { format_recommended: "solo", cultural_context_active: false, cultural_tradition: null, event_arc: null,
  delivery_mode: "alex_performs", venue_name: null } as unknown as Classification;

// Reviewed figures that are not quotes. Anything else fails until someone reviews it.
const ALLOWED: Record<string, string> = {
  "$500": "the minimum booking rule",
  "$1M": "insurance coverage (COI line)",
  "$2M": "insurance coverage (COI line)",
  "$4,000": "LEAD_RESPONSE_VOICE: the size of a lead the voice must hold for, not a quote",
};

test("always-loaded docs state no prices except reviewed non-quote figures", async () => {
  const ctx = await selectContext(plain);
  assert.ok(ctx.includes("$500"), "control: the minimum rule is still loaded");
  const found = [...new Set(ctx.match(/\$[\d,]+(?:\.\d+)?[MK]?/g) ?? [])];
  assert.deepEqual(found.filter((f) => !ALLOWED[f]), []);
});
