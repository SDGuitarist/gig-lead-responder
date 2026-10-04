import { test } from "node:test";
import assert from "node:assert/strict";
import { buildClassifyPrompt } from "./prompts/classify.js";
import { normalizeGracefulDecline } from "./pipeline/classify.js";
import { verifyClassificationHeuristics } from "./pipeline/classify-verify.js";
import type { Classification } from "./types.js";

// Port manifest R320, code half: classify flags a format/fit mismatch or sensitive
// context (graceful_decline); such a lead is always held for Alex.
const c = (graceful_decline?: unknown) =>
  ({ format_recommended: "solo", rate_card_tier: "T2", stealth_premium: false, stated_budget: null,
     competition_quote_count: 0, cultural_context_active: false, flagged_concerns: [], graceful_decline }) as unknown as Classification;
const MARKER = "graceful_decline: format/fit or sensitivity trigger";

test("port manifest R320: classify asks for graceful_decline, and only a real true counts", () => {
  const p = buildClassifyPrompt("2026-10-04");
  assert.ok(p.includes("## GRACEFUL DECLINE"));
  assert.ok(p.includes('"graceful_decline": boolean'));
  assert.equal(normalizeGracefulDecline(true), true);
  for (const v of [false, "true", 1, undefined, null]) assert.equal(normalizeGracefulDecline(v), false);
});

test("port manifest R320: a graceful-decline lead is held; others are not", () => {
  assert.ok(verifyClassificationHeuristics("Funeral for my mom", c(true)).warnings.some((w) => w.startsWith(MARKER)));
  assert.ok(!verifyClassificationHeuristics("Birthday party", c(false)).warnings.some((w) => w.startsWith(MARKER)));
  assert.ok(!verifyClassificationHeuristics("Birthday party", c(undefined)).warnings.some((w) => w.startsWith(MARKER)));
});

// Generate and verify carry the pattern only for a decline lead; a reported decline
// failure always fails the gate; the post-check lets the decline exit line through.
const full = (graceful_decline: boolean) => ({ ...c(graceful_decline), mode: "evaluation", action: "quote",
  vagueness: "clear", competition_level: "low", stealth_premium_signals: [], tier: "standard", lead_source_column: "P",
  price_point: "full_premium", format_requested: "piano", duration_hours: 1, timeline_band: "short", close_type: "soft_hold",
  cultural_tradition: null, planner_effort_active: false, social_proof_active: false, context_modifiers: [],
  event_date_iso: null, event_energy: null, venue_name: null, client_first_name: null, platform: "yelp" }) as unknown as Classification;

test("port manifest R320: generate and verify carry the decline pattern only for a decline lead", async () => {
  const { buildGeneratePrompt } = await import("./prompts/generate.js");
  const { buildVerifyPrompt } = await import("./prompts/verify.js");
  const { lookupPrice } = await import("./pipeline/price.js");
  const gen = (d: boolean) => buildGeneratePrompt(full(d), lookupPrice(full(d)), "ctx");
  const ver = (d: boolean) => buildVerifyPrompt(full(d), { budget: { tier: "none" } });
  for (const m of ["GRACEFUL DECLINE MODE", "Format honesty BEFORE the price", "names the specific alternative"]) {
    assert.ok(gen(true).includes(m), m);
  }
  assert.ok(!gen(false).includes("GRACEFUL DECLINE MODE"));
  for (const m of ["GRACEFUL DECLINE", "Graceful decline failed"]) assert.ok(ver(true).includes(m), m);
  assert.ok(!ver(false).includes("Graceful decline failed"));
});

test("port manifest R320: a reported decline failure always fails the gate", async () => {
  const { setClaudeRequesterForTests } = await import("./claude.js");
  const { verifyGate } = await import("./pipeline/verify.js");
  const { GUT_CHECK_KEYS } = await import("./types.js");
  const reply = (gate: Record<string, unknown>) => async () => ({ id: "m", type: "message", role: "assistant", model: "t",
    stop_reason: "end_turn", stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 },
    content: [{ type: "text", text: JSON.stringify({ validation_line: "", best_line: "", concern_traceability: [],
      scene_quote: "", scene_type: "cinematic", competitor_test: false,
      gut_checks: Object.fromEntries(GUT_CHECK_KEYS.map((k) => [k, true])), ...gate }) }] });
  const drafts = { full_draft: "x", compressed_draft: "x", compressed_word_count: 1 };
  try {
    setClaudeRequesterForTests(reply({ gate_status: "pass", fail_reasons: ["Graceful decline failed: price before format honesty"] }) as never);
    assert.equal((await verifyGate(drafts, full(true), { budget: { tier: "none" } } as never)).gate_status, "fail");
    setClaudeRequesterForTests(reply({ gate_status: "pass", fail_reasons: [] }) as never);
    assert.equal((await verifyGate(drafts, full(true), { budget: { tier: "none" } } as never)).gate_status, "pass", "control");
  } finally {
    setClaudeRequesterForTests();
  }
});

test("port manifest R320: the decline exit line passes the post-check only in decline mode", async () => {
  const { postCheckDrafts } = await import("./pipeline/post-check.js");
  const exit = "If a pianist feels right for your mom, I'd recommend looking elsewhere for one. No pressure either way.";
  const soft = (text: string, gracefulDecline?: boolean) =>
    postCheckDrafts(text, text, "yelp", { gracefulDecline }).violations.filter((v) => v.startsWith("soft_refusal"));
  assert.deepEqual(soft(exit, true), []);
  assert.ok(soft(exit).length > 0, "control: outside decline mode it is still a soft refusal");
  assert.ok(soft("Piano is not really my specialty.", true).length > 0, "overshoot: other soft refusals still fail");
});
