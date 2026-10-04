import { test } from "node:test";
import assert from "node:assert/strict";
import { buildClassifyPrompt } from "./prompts/classify.js";

// Port manifest R369: urgency phrases mean urgent whatever the date says.
test("classify treats urgency phrases as urgent", () => {
  const p = buildClassifyPrompt("2026-10-03");
  for (const m of ["URGENCY SIGNALS", "original musician cancelled", "last minute", 'close_type = "direct"', "social_proof_active = false"]) {
    assert.ok(p.includes(m), m);
  }
});
