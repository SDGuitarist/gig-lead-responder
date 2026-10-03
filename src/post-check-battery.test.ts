import { test } from "node:test";
import assert from "node:assert/strict";
import { postCheckDrafts } from "./pipeline/post-check.js";

// Alex 2026-10-03: never mention battery-powered sound in any quote. Backstop
// for a model that says it anyway: a violation fails the gate (rewrite, then hold).
const battery = (r: { violations: string[] }) => r.violations.filter((v) => v.startsWith("battery_mention"));

test("post-check holds battery mention: full and compressed drafts", () => {
  const r = postCheckDrafts("I'm self-contained with battery-powered sound.", "Batteries included, so no outlet needed.");
  assert.deepEqual(battery(r), ["battery_mention_full", "battery_mention_compressed"]);
});

test("post-check holds battery mention: control, self-contained wording passes", () => {
  const r = postCheckDrafts("I'm fully self-contained for indoors or outdoors.", "Fully self-contained, one outlet.");
  assert.deepEqual(battery(r), []);
});
