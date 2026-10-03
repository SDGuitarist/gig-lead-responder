import { test } from "node:test";
import assert from "node:assert/strict";
import { buildVerifyPrompt } from "./prompts/verify.js";
import type { Classification } from "./types.js";

// Port manifest F2: the voice spec's judgment items are named in the verify
// prompt (plan 0.5: "listed by name"). Calls the real prompt builder.
const c = { action: "quote", format_requested: "guitarist", format_recommended: "solo", venue_name: null, client_first_name: null, stealth_premium_signals: [], context_modifiers: [], flagged_concerns: [], cultural_context_active: false,
  timeline_band: "comfortable", vagueness: "clear", platform: "yelp" } as unknown as Classification;

test("port manifest F2 verify: voice judgment checks are named", () => {
  const p = buildVerifyPrompt(c, { budget: { tier: "none" } });
  for (const m of ["VOICE JUDGMENT CHECKS", "False binary", "Triple strawman", "FOMO framing", "Snappy triads",
    "Unearned profundity", "Hedge softeners", "Named Fear is required and is NOT a false binary"]) {
    assert.ok(p.includes(m), m);
  }
});
