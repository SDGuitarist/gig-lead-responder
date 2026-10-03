import { test } from "node:test";
import assert from "node:assert/strict";
import { selectContext } from "./pipeline/context.js";
import type { Classification } from "./types.js";

// Port manifest R008 (and the F19 rows): the Bolero negotiation playbook
// loads for bolero leads only. Calls the real selectContext.
const MARKER = "## BOLERO TRIO NEGOTIATION PLAYBOOK";
const lead = (format: string) =>
  ({ format_recommended: format, cultural_context_active: false, cultural_tradition: null }) as unknown as Classification;

test("port manifest R008: bolero lead loads the negotiation playbook", async () => {
  const ctx = await selectContext(lead("bolero_trio"));
  assert.ok(ctx.includes(MARKER));
  assert.ok(ctx.includes("Negotiation Playbook"));
});

test("port manifest R008: a non-bolero lead does not", async () => {
  assert.ok(!(await selectContext(lead("solo"))).includes(MARKER));
});
