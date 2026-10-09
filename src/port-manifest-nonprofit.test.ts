import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildClassifyPrompt } from "./prompts/classify.js";

// Port manifest R403 (NP track, step 1). Alex decided Sept 15, 2026: nonprofit and fundraiser leads are
// routed on WHO PAYS, never premium on the venue alone (the lost Sept 2026 donor-dinner precedent was
// quoted T4 at a luxury venue). The always-loaded docs and the classify prompt still treated
// "fundraiser" and "donor" as premium signals. Alex 2026-10-09: fix that first, and hold every
// nonprofit lead until the NP rates are set.
test("port manifest R403: the classify prompt asks who pays and never makes a nonprofit premium on venue alone", () => {
  const p = buildClassifyPrompt("2026-10-09");
  assert.ok(p.includes("## BUYER (WHO PAYS)"));
  assert.match(p, /"nonprofit_buyer": boolean/);
  assert.match(p, /never premium on the venue alone/i);
  assert.doesNotMatch(p, /private event or donor/i, "donor events are not an auto-premium pattern");
});

test("port manifest R403: the always-loaded docs no longer list a fundraiser as a premium signal", () => {
  for (const f of ["docs/QUICK_REFERENCE.md", "docs/PROTOCOL.md"]) {
    const premiumRows = readFileSync(f, "utf-8").split("\n").filter((l) => /^\| Event type \|.*Corporate 100\+/.test(l)); // premium-signal rows only
    assert.ok(premiumRows.length > 0, `control: ${f} has an Event type premium row`);
    for (const row of premiumRows) {
      assert.doesNotMatch(row, /fundraiser at cultural venue|\(Corporate 100\+, fundraiser,/i, `${f}: fundraiser listed as a signal: ${row}`);
      assert.match(row, /never premium on the venue alone/i, `${f}: the who-pays rule is stated: ${row}`);
    }
  }
});

// Alex's catch 2026-10-09: his one real NP booking came through an event PLANNER at a five-star venue,
// which also fits the coming T4 rule (planner + five-star). Route on who pays: the nonprofit pays, so a
// planner or events company booking for a nonprofit is nonprofit_buyer (NP beats T4).
test("port manifest R403: a planner booking for a nonprofit is a nonprofit buyer (NP beats T4)", () => {
  assert.match(buildClassifyPrompt("2026-10-09"), /planner or events company booking for a nonprofit[^.]*nonprofit_buyer is true/i);
});
