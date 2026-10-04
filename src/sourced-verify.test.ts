import { test } from "node:test";
import assert from "node:assert/strict";
import { buildVerifyPrompt } from "./prompts/verify.js";
import { GUT_CHECK_KEYS, type Classification } from "./types.js";

// Port manifest R257 + R338 (#8 Sourced Integrity): verify checks sourced and
// hybrid drafts for curation-as-expertise, authenticity, accountability and
// musician quality, and a failure fails the gate. Alex-performs leads skip it.
const c = (mode: string) =>
  ({ action: "quote", format_requested: "mariachi", format_recommended: "mariachi_full", delivery_mode: mode,
     flagged_concerns: [], cultural_context_active: false, timeline_band: "comfortable", vagueness: "clear",
     platform: "yelp", venue_name: null, client_first_name: null, stealth_premium_signals: [], context_modifiers: [] }) as unknown as Classification;

test("sourced integrity is checked for sourced and hybrid leads", () => {
  for (const mode of ["alex_sources", "hybrid"]) {
    const p = buildVerifyPrompt(c(mode), { budget: { tier: "none" } });
    for (const m of ["SOURCED INTEGRITY", "single point of contact", "never apologetic", "Sourced integrity failed"]) {
      assert.ok(p.includes(m), `${mode}: ${m}`);
    }
  }
  assert.ok(!buildVerifyPrompt(c("alex_performs"), { budget: { tier: "none" } }).includes("SOURCED INTEGRITY"));
});

test("sourced integrity is checked: a reported failure always fails the gate", async () => {
  const { setClaudeRequesterForTests } = await import("./claude.js");
  const { verifyGate } = await import("./pipeline/verify.js");
  const reply = (gate: Record<string, unknown>) => async () => ({
    id: "msg-test", type: "message" as const, role: "assistant" as const, model: "test", stop_reason: "end_turn" as const,
    stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 },
    content: [{ type: "text" as const, text: JSON.stringify({ validation_line: "", best_line: "", concern_traceability: [],
      scene_quote: "", scene_type: "cinematic", competitor_test: false,
      gut_checks: Object.fromEntries(GUT_CHECK_KEYS.map((k) => [k, true])), ...gate }) }],
  });
  const drafts = { full_draft: "x", compressed_draft: "x", compressed_word_count: 1 };
  try {
    setClaudeRequesterForTests(reply({ gate_status: "pass", fail_reasons: ["Sourced integrity failed: transparency in the opening line"] }) as never);
    assert.equal((await verifyGate(drafts, c("alex_sources"), { budget: { tier: "none" } } as never)).gate_status, "fail");
    setClaudeRequesterForTests(reply({ gate_status: "pass", fail_reasons: [] }) as never);
    assert.equal((await verifyGate(drafts, c("alex_sources"), { budget: { tier: "none" } } as never)).gate_status, "pass", "control");
  } finally {
    setClaudeRequesterForTests();
  }
});
