import { test } from "node:test";
import assert from "node:assert/strict";
import { selectContext } from "./pipeline/context.js";
import type { Classification } from "./types.js";

// Port manifest R335 (+ sourced notes in R334, R336, R342): sourced and hybrid
// leads get the curator-voice drafting rules; Alex-performs leads do not.
const lead = (format: string, mode: string | null) =>
  ({ format_recommended: format, delivery_mode: mode, cultural_context_active: false, cultural_tradition: null }) as unknown as Classification;

test("sourced drafting rules reach sourced and hybrid leads only", async () => {
  for (const [f, m] of [["mariachi_full", "alex_sources"], ["flamenco_trio", "hybrid"]]) {
    const ctx = await selectContext(lead(f, m));
    for (const marker of ["## SOURCED LEAD DRAFTING", "Sourced Transparency Placement", "Sourced Pricing Presentation", "Sourced close note"]) {
      assert.ok(ctx.includes(marker), `${f}: ${marker}`);
    }
  }
  assert.ok(!(await selectContext(lead("solo", "alex_performs"))).includes("## SOURCED LEAD DRAFTING"));
});
