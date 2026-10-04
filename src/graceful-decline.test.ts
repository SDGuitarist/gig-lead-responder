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
