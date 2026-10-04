import { test } from "node:test";
import assert from "node:assert/strict";
import { selectContext } from "./pipeline/context.js";
import type { Classification } from "./types.js";

// Port manifest F2: Alex's voice spec (LEAD_RESPONSE_VOICE.md) reaches every
// lead. Its navigation-only parts (Cross-References, "When in Doubt" pointing
// to a doc the app doesn't have) are left out.
const lead = { format_recommended: "solo", cultural_context_active: false, cultural_tradition: null } as unknown as Classification;

test("port manifest F2: voice spec reaches every lead", async () => {
  const ctx = await selectContext(lead);
  for (const m of ["## LEAD RESPONSE VOICE", "Voice by Audience", "Core Voice Constants", "Banned structural patterns",
    "Who Alex Is", "Voice DNA", "Drafting Principles", "Quality Checklist", "What NOT to Sound Like", "Hard Language Rules"]) {
    assert.ok(ctx.includes(m), m);
  }
  assert.ok(!ctx.includes("Writing Samples: Voice Calibration Reference"));
});
