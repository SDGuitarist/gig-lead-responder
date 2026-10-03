import { test } from "node:test";
import assert from "node:assert/strict";
import { selectContext } from "./pipeline/context.js";
import type { Classification } from "./types.js";

// Port manifest F8: the Project's Vehicle sections reach cultural leads through
// CULTURAL_CORE.md; the cultural flow table stays on the app's 5-step sequence.
const lead = (active: boolean) =>
  ({ format_recommended: "solo", cultural_context_active: active, cultural_tradition: active ? "spanish_latin" : null }) as unknown as Classification;

test("port manifest F8: cultural lead gets the vehicle framework on the 5-step flow", async () => {
  const ctx = await selectContext(lead(true));
  for (const m of ["The Vehicle (Why You)", "Vehicle Placement", "The vehicle is essential.", "**1. Cinematic hook + validation**"]) {
    assert.ok(ctx.includes(m), m);
  }
});

test("port manifest F8: a non-cultural lead does not", async () => {
  assert.ok(!(await selectContext(lead(false))).includes("The Vehicle (Why You)"));
});
