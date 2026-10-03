import { test } from "node:test";
import assert from "node:assert/strict";
import { selectContext } from "./pipeline/context.js";
import type { Classification } from "./types.js";

// Port manifest F7: EVENT_STRUCTURE_THEORY.md loads when classify names an
// event arc, and not otherwise. Calls the real selectContext.
const lead = (arc: string | null) =>
  ({ format_recommended: "solo", cultural_context_active: false, cultural_tradition: null, event_arc: arc }) as unknown as Classification;

test("port manifest F7: a lead with an event arc gets the arc theory", async () => {
  for (const arc of ["wedding", "corporate", "private_celebration", "memorial"]) {
    const ctx = await selectContext(lead(arc));
    assert.ok(ctx.includes("## EVENT ARCS"), arc);
    assert.ok(ctx.includes("The Repertoire-to-Phase Mapping"), arc);
  }
});

test("port manifest F7: no arc, no theory", async () => {
  assert.ok(!(await selectContext(lead(null))).includes("## EVENT ARCS"));
});
