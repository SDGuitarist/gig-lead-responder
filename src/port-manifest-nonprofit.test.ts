import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildClassifyPrompt } from "./prompts/classify.js";
import { classifyLead } from "./pipeline/classify.js";
import { setClaudeRequesterForTests } from "./claude.js";

// Port manifest R403 (NP track, step 1). Alex decided Sept 15, 2026: nonprofit and fundraiser leads are
// routed on WHO PAYS, never premium on the venue alone (the lost Sept 2026 donor-dinner precedent was
// quoted T4 at a luxury venue). The always-loaded docs and the classify prompt still treated
// "fundraiser" and "donor" as premium signals. Alex 2026-10-09: fix that first, and hold every
// nonprofit lead until the NP rates are set.
test("port manifest R403: the classify prompt asks who pays and never makes a nonprofit premium on venue alone", () => {
  const p = buildClassifyPrompt("2026-10-09");
  assert.ok(p.includes("## BUYER (WHO PAYS)"));
  assert.match(p, /"nonprofit_buyer": boolean/);
  assert.match(p, /never premium on the venue alone/i);
  assert.doesNotMatch(p, /private event or donor/i, "donor events are not an auto-premium pattern");
});

test("port manifest R403: the always-loaded docs no longer list a fundraiser as a premium signal", () => {
  for (const f of ["docs/QUICK_REFERENCE.md", "docs/PROTOCOL.md"]) {
    const premiumRows = readFileSync(f, "utf-8").split("\n").filter((l) => /^\| Event type \|.*Corporate 100\+/.test(l)); // premium-signal rows only
    assert.ok(premiumRows.length > 0, `control: ${f} has an Event type premium row`);
    for (const row of premiumRows) {
      assert.doesNotMatch(row, /fundraiser at cultural venue|\(Corporate 100\+, fundraiser,/i, `${f}: fundraiser listed as a signal: ${row}`);
      assert.match(row, /never premium on the venue alone/i, `${f}: the who-pays rule is stated: ${row}`);
    }
  }
});

// Alex's catch 2026-10-09: his one real NP booking came through an event PLANNER at a five-star venue,
// which also fits the coming T4 rule (planner + five-star). Route on who pays: the nonprofit pays, so a
// planner or events company booking for a nonprofit is nonprofit_buyer (NP beats T4).
test("port manifest R403: a planner booking for a nonprofit is a nonprofit buyer (NP beats T4)", () => {
  assert.match(buildClassifyPrompt("2026-10-09"), /planner or events company booking for a nonprofit[^.]*nonprofit_buyer is true/i);
});

// Step 2: the parsed field. Only a real boolean true counts (a string "true", 1 or a missing field is
// false), the same rule as price_asked and extended_dancer. Through the real classifyLead.
const valid = {
  mode: "evaluation", action: "quote", vagueness: "clear", competition_level: "low", competition_quote_count: 0,
  stealth_premium: false, stealth_premium_signals: [], tier: "standard", rate_card_tier: "T2", lead_source_column: "D",
  price_point: "full_premium", format_requested: "guitarist", format_recommended: "solo", duration_hours: 2,
  stated_budget: null, event_date_iso: null, timeline_band: "comfortable", close_type: "soft_hold", event_energy: null,
  cultural_context_active: false, cultural_tradition: null, planner_effort_active: false, social_proof_active: false,
  context_modifiers: [], flagged_concerns: [], venue_name: null, client_first_name: null,
};
async function classifyAs(out: Record<string, unknown>) {
  setClaudeRequesterForTests((async () => ({ id: "m", type: "message", role: "assistant", model: "t", stop_reason: "end_turn",
    stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 },
    content: [{ type: "text", text: JSON.stringify(out) }] })) as never);
  try { return await classifyLead("lead text", "2026-10-09"); } finally { setClaudeRequesterForTests(); }
}
test("port manifest R403: nonprofit_buyer parses only a real true", async () => {
  assert.equal((await classifyAs({ ...valid, nonprofit_buyer: true })).nonprofit_buyer, true);
  for (const v of ["true", 1, null, undefined, false]) {
    assert.equal((await classifyAs({ ...valid, nonprofit_buyer: v })).nonprofit_buyer, false, String(v));
  }
});
