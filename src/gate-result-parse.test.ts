import { test } from "node:test";
import assert from "node:assert/strict";
import { setClaudeRequesterForTests } from "./claude.js";
import { verifyGate } from "./pipeline/verify.js";
import { GUT_CHECK_KEYS, type Classification } from "./types.js";

// Codex round 1 (port range) finding 2: the gate result was cast after checking
// only that two fields were arrays. Every field must parse into its type, or the
// whole result is rejected (callClaude retries once, then the lead fails safe).
const c = { action: "quote", format_requested: "guitarist", format_recommended: "solo", delivery_mode: "alex_performs",
  flagged_concerns: [], cultural_context_active: false, timeline_band: "comfortable", vagueness: "clear", platform: "yelp",
  venue_name: null, client_first_name: null, stealth_premium_signals: [], context_modifiers: [] } as unknown as Classification;
const drafts = { full_draft: "x", compressed_draft: "x", compressed_word_count: 1 };
const good = (over: Record<string, unknown> = {}) => ({
  validation_line: "v", best_line: "b", concern_traceability: [{ concern: "outdoor", draft_sentence: "s" }],
  scene_quote: "q", scene_type: "cinematic", competitor_test: false,
  gut_checks: Object.fromEntries(GUT_CHECK_KEYS.map((k) => [k, true])), gate_status: "pass", fail_reasons: [], ...over });
async function run(gate: Record<string, unknown>) {
  setClaudeRequesterForTests((async () => ({ id: "m", type: "message", role: "assistant", model: "t", stop_reason: "end_turn",
    stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 },
    content: [{ type: "text", text: JSON.stringify(gate) }] })) as never);
  try { return await verifyGate(drafts, c, { budget: { tier: "none" } } as never); } finally { setClaudeRequesterForTests(); }
}

test("gate result parse: malformed entries are rejected, not trusted", async () => {
  for (const [label, bad] of [
    ["object fail reason", good({ fail_reasons: [{ reason: "Sourced integrity failed" }] })],
    ["numeric traceability", good({ concern_traceability: [{ concern: 1, draft_sentence: "s" }] })],
    ["non-boolean gut check", good({ gut_checks: { ...good().gut_checks as object, can_see_it: "yes" } })],
    ["missing gut check", good({ gut_checks: {} })],
    ["bad scene type", good({ scene_type: "vivid" })],
    ["non-boolean competitor test", good({ competitor_test: "no" })],
  ] as const) {
    await assert.rejects(run(bad), /invalid|Failed to parse/, label);
  }
});

test("gate result parse: control, valid pass and fail results come through", async () => {
  assert.equal((await run(good())).gate_status, "pass");
  const failed = await run(good({ gate_status: "fail", fail_reasons: ["Scene is structural"] }));
  assert.deepEqual([failed.gate_status, failed.fail_reasons], ["fail", ["Scene is structural"]]);
});
