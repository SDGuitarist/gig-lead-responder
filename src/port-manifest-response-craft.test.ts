import { test } from "node:test";
import assert from "node:assert/strict";
import { selectContext } from "./pipeline/context.js";
import type { Classification } from "./types.js";

// Port manifest F14: the Project's Step 7/8 additions reach every lead through
// RESPONSE_CRAFT.md. The chat-only "load DRAFT_METHOD.md next" banners must NOT,
// because the app does not load that file (the generate prompt would be told to wait for it).
const lead = { format_recommended: "solo", cultural_context_active: false, cultural_tradition: null } as unknown as Classification;

test("port manifest F14: graceful decline, category vs format and ambiguity wedge reach every lead", async () => {
  const ctx = await selectContext(lead);
  for (const marker of ["Graceful Decline Pattern (Format/Fit Mismatch)", "Category vs. Format Rule", "Ambiguity as Expertise", "Never treat a sparse lead as permission to go generic"]) {
    assert.ok(ctx.includes(marker), marker);
  }
});

test("port manifest F14: chat-only sequence banners are left out", async () => {
  const ctx = await selectContext(lead);
  assert.ok(!ctx.includes("YOU ARE HERE: FILE 1 OF 3"));
  assert.ok(!ctx.includes("PROCEED TO DRAFT_METHOD.md"));
});
