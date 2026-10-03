import { test } from "node:test";
import assert from "node:assert/strict";
import { selectContext } from "./pipeline/context.js";
import type { Classification } from "./types.js";

// Port manifest F10 (R211, R216, R217): the Project's "read the absences"
// additions reach every lead through PRINCIPLES.md. Calls the real selectContext.
const lead = { format_recommended: "solo", cultural_context_active: false, cultural_tradition: null } as unknown as Classification;

test("port manifest F10: absences-as-signals principle reaches every lead", async () => {
  const ctx = await selectContext(lead);
  assert.ok(ctx.includes("Absences as Signals"));
  assert.ok(ctx.includes("First-Time Event Host"));
  assert.ok(ctx.includes("Read the absences?"));
});
