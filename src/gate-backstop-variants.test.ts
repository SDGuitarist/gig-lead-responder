import { test } from "node:test";
import assert from "node:assert/strict";
import { setClaudeRequesterForTests } from "./claude.js";
import { verifyGate } from "./pipeline/verify.js";
import { GUT_CHECK_KEYS, type Classification } from "./types.js";

// Codex round 1 (round-up/R320 range): the always-fail backstop matched the model's
// wording exactly, so "graceful decline failed: ..." (lowercase) let the gate pass.
// Both backstop phrases must force a fail however the model cases or pads them.
const cl = { action: "quote", format_requested: "x", format_recommended: "solo", delivery_mode: "alex_performs",
  flagged_concerns: [], cultural_context_active: false, timeline_band: "comfortable", vagueness: "clear", platform: "yelp",
  venue_name: null, client_first_name: null, stealth_premium_signals: [], context_modifiers: [] } as unknown as Classification;
async function statusFor(reason: string): Promise<string> {
  setClaudeRequesterForTests((async () => ({ id: "m", type: "message", role: "assistant", model: "t", stop_reason: "end_turn",
    stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 },
    content: [{ type: "text", text: JSON.stringify({ validation_line: "", best_line: "", concern_traceability: [],
      scene_quote: "", scene_type: "cinematic", competitor_test: false,
      gut_checks: Object.fromEntries(GUT_CHECK_KEYS.map((k) => [k, true])), gate_status: "pass", fail_reasons: [reason] }) }] })) as never);
  try {
    return (await verifyGate({ full_draft: "x", compressed_draft: "x", compressed_word_count: 1 }, cl, { budget: { tier: "none" } } as never)).gate_status;
  } finally {
    setClaudeRequesterForTests();
  }
}

test("gate backstop: either failure phrase forces a fail, whatever the case or padding", async () => {
  for (const phrase of ["Graceful decline failed", "Sourced integrity failed"]) {
    for (const v of [phrase, phrase.toLowerCase(), `  ${phrase}`, phrase.toUpperCase(), `\n${phrase.toLowerCase()}`]) {
      assert.equal(await statusFor(`${v}: price before format honesty`), "fail", JSON.stringify(v));
    }
  }
});

test("gate backstop: control, an unrelated reason does not force a fail", async () => {
  assert.equal(await statusFor("Tighten the second sentence"), "pass");
  assert.equal(await statusFor("The decline line could be warmer"), "pass", "mentions decline, not the failure phrase");
});
