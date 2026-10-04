import { test } from "node:test";
import assert from "node:assert/strict";
import { postCheckDrafts } from "./pipeline/post-check.js";
import { buildVerifyPrompt } from "./prompts/verify.js";
import { GUT_CHECK_KEYS, type Classification } from "./types.js";

// Port manifest R035 / R040 (Codex round 1, port range, finding 4): evidence that
// the voice spec's em-dash rule and its 7-step self-check actually run.

test("voice self-check: em dashes never reach a draft, but price lines keep theirs", () => {
  const r = postCheckDrafts("You've thought this through — the format, the setup — and it shows.", "Latin Duo — $1,100 for two hours.");
  assert.ok(!r.full_draft.includes("—"), "prose em dashes are replaced");
  assert.ok(r.compressed_draft.includes("— $1,100"), "the pricing-line em dash stays");
});

test("voice self-check: all 7 self-check items have a home", () => {
  // 1 em dash and 2 kill list run in code
  assert.ok(!postCheckDrafts("A — B", "ok").full_draft.includes("—"), "1: em dash");
  assert.ok(postCheckDrafts("A seamless night.", "ok").violations.some((v) => v.startsWith("voice_kill_full")), "2: kill list");
  // 3 hedges, 6 read-aloud, 7 rhythm are named verify judgment checks; 4 and 5 are gut checks
  const c = { action: "quote", format_requested: "guitarist", format_recommended: "solo", delivery_mode: "alex_performs",
    flagged_concerns: [], cultural_context_active: false, timeline_band: "comfortable", vagueness: "clear", platform: "yelp",
    venue_name: null, client_first_name: null, stealth_premium_signals: [], context_modifiers: [] } as unknown as Classification;
  const p = buildVerifyPrompt(c, { budget: { tier: "none" } });
  assert.ok(p.includes("Hedge softeners"), "3: hedges");
  assert.ok(p.includes("sounds_like_alex"), "6: read it aloud");
  assert.ok(p.includes("Uniform rhythm"), "7: rhythm");
  assert.ok((GUT_CHECK_KEYS as readonly string[]).includes("validated_them"), "4: validation");
  assert.ok((GUT_CHECK_KEYS as readonly string[]).includes("lead_specific_opening"), "5: deletion test on the opening");
});
