import { test } from "node:test";
import assert from "node:assert/strict";
import { selectContext } from "./pipeline/context.js";
import type { Classification } from "./types.js";

// Port manifest F9: the Project's bolero/trova patterns reach Spanish/Latin
// leads through CULTURAL_SPANISH_LATIN.md, and only those leads.
const lead = (active: boolean) =>
  ({ format_recommended: "solo", cultural_context_active: active, cultural_tradition: active ? "spanish_latin" : null }) as unknown as Classification;

test("port manifest F9: spanish/latin lead gets the bolero and trova patterns", async () => {
  const ctx = await selectContext(lead(true));
  for (const marker of ["Bolero Signals (Any 2+)", "Trova (Intimate Proposal)", '"Background Latin Music" → Trova']) {
    assert.ok(ctx.includes(marker), marker);
  }
});

test("port manifest F9: a non-cultural lead does not", async () => {
  assert.ok(!(await selectContext(lead(false))).includes("Bolero Signals (Any 2+)"));
});
