import { test } from "node:test";
import assert from "node:assert/strict";
import { buildClassifyPrompt } from "./prompts/classify.js";

// Port manifest F5 (Sections 1, 4, 5): named venue tiers, auto-premium
// signals, premium zips and red-flag patterns reach the classifier.
test("port manifest F5: classifier knows the venue tiers and red flags", () => {
  const p = buildClassifyPrompt("2026-10-03");
  for (const m of ["Tier A venues (auto-premium", "Rancho Valencia", "Martin Johnson House", "92091",
    "Private estate in Rancho Santa Fe, La Jolla or Coronado", "RED FLAG PATTERNS", "We'll pay you after the event"]) {
    assert.ok(p.includes(m), m);
  }
});
