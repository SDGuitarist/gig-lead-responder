import { test } from "node:test";
import assert from "node:assert/strict";
import { selectContext } from "./pipeline/context.js";
import type { Classification } from "./types.js";

// Alex 2026-10-03 (q-i): drafts quote one confident number (post-check fails
// ranges), so the loaded PRICING_TABLES.md must not model range quotes or the
// banned word "investment". The price tables themselves stay.
const lead = { format_recommended: "solo", cultural_context_active: false, cultural_tradition: null } as unknown as Classification;

test("pricing reference models single-number quotes only", async () => {
  const ctx = await selectContext(lead);
  assert.ok(ctx.includes("## PRICING REFERENCE"), "control: PRICING_TABLES.md still loads");
  assert.ok(ctx.includes("$500 minimum booking floor"), "control: the rules section is still there");
  assert.ok(!ctx.includes("Standard leads can receive ranges"));
  assert.ok(!ctx.includes("Does that range work"));
  assert.ok(!/budgeting around \$[\d,]+-[\d,]+/.test(ctx));
  assert.doesNotMatch(ctx, /\binvestment\b/i);
});
