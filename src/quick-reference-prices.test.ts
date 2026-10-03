import { test } from "node:test";
import assert from "node:assert/strict";
import { selectContext } from "./pipeline/context.js";
import type { Classification } from "./types.js";

// Alex 2026-10-03 (q-f): the stale "Pricing Shorthand" table (solo $400-500,
// below the $500 minimum in src/data/rates.ts) must not reach any draft.
// Drafts see only the price lookupPrice() computes.
const lead = { format_recommended: "solo", cultural_context_active: false, cultural_tradition: null } as unknown as Classification;

test("stale price shorthand never reaches a draft", async () => {
  const ctx = await selectContext(lead);
  assert.ok(ctx.includes("## QUICK REFERENCE"), "control: QUICK_REFERENCE.md still loads");
  assert.ok(!ctx.includes("Pricing Shorthand"));
  assert.ok(!ctx.includes("$400-500"));
});
