import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

// Port manifest R018/R266/R272: the strategic reserve (insights the first reply
// didn't use) is banked per lead so a follow-up has fresh angles (Alex approved
// migration v3, 2026-10-04). Temp DB only.
process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "glr-reserve-")), "leads.db");
const { initDb } = await import("./db/migrate.js");
const { insertLead, updateLead, getLead } = await import("./db/index.js");

test("port manifest R018: migration v3 adds strategic_reserve_json, with a backup first", () => {
  const db = initDb();
  assert.equal(db.pragma("user_version", { simple: true }), 3);
  const cols = (db.pragma("table_info(leads)") as Array<{ name: string }>).map((c) => c.name);
  assert.ok(cols.includes("strategic_reserve_json"));
  assert.ok(existsSync(join(dirname(process.env.DATABASE_PATH!), "backups", "pre-v3.db")));
  const lead = insertLead({ raw_email: "x", source_platform: "gigsalad", mailgun_message_id: "sr-1" });
  updateLead(lead.id, { strategic_reserve_json: JSON.stringify(["Grandmother flew in from Oaxaca"]) });
  assert.equal(getLead(lead.id)?.strategic_reserve_json, '["Grandmother flew in from Oaxaca"]');
});

const { normalizeStrategicReserve } = await import("./pipeline/generate.js");

const cl = { mode: "evaluation", action: "quote", vagueness: "clear", competition_level: "low", competition_quote_count: 0,
    stealth_premium: false, stealth_premium_signals: [], tier: "standard", rate_card_tier: "T2", lead_source_column: "P",
    price_point: "full_premium", format_requested: "guitarist", format_recommended: "solo", duration_hours: 2,
    stated_budget: null, timeline_band: "comfortable", close_type: "soft_hold", cultural_context_active: false,
    cultural_tradition: null, planner_effort_active: false, social_proof_active: false, context_modifiers: [],
    event_date_iso: null, event_energy: null, flagged_concerns: [], venue_name: null, client_first_name: null, platform: "yelp" } as never;

test("port manifest R018: generate asks for a strategic reserve of unused insights", async () => {
  const { buildGeneratePrompt } = await import("./prompts/generate.js");
  const { lookupPrice } = await import("./pipeline/price.js");
  const p = buildGeneratePrompt(cl, lookupPrice(cl), "ctx");
  for (const m of ['"strategic_reserve"', "you did NOT use in the drafts", "never a price"]) assert.ok(p.includes(m), m);
});

test("port manifest R018: the reserve parses to at most 3 non-empty strings and never blocks a draft", () => {
  assert.deepEqual(normalizeStrategicReserve([" a ", "b", "c", "d"]), ["a", "b", "c"]);
  assert.deepEqual(normalizeStrategicReserve(["a", 7, "", null, "b"]), ["a", "b"]);
  for (const bad of [undefined, null, "a", { 0: "a" }, 3]) assert.deepEqual(normalizeStrategicReserve(bad), [], String(bad));
});

test("port manifest R018: generate returns the reserve", async () => {
  const { setClaudeRequesterForTests } = await import("./claude.js");
  const { generateResponse } = await import("./pipeline/generate.js");
  setClaudeRequesterForTests((async () => ({ id: "m", type: "message", role: "assistant", model: "t", stop_reason: "end_turn",
    stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 },
    content: [{ type: "text", text: JSON.stringify({ reasoning: {}, full_draft: "Hi Ana, here is the plan.",
      compressed_draft: "Hi Ana.", strategic_reserve: ["Her dad played requinto at their own wedding"] }) }] })) as never);
  try {
    const drafts = await generateResponse(cl, { format: "solo", duration_hours: 2, tier_key: "T2P", anchor: 595, floor: 550,
      quote_price: 595, competition_position: "at anchor", budget: { tier: "none" } } as never, "ctx");
    assert.deepEqual(drafts.strategic_reserve, ["Her dad played requinto at their own wedding"]);
  } finally {
    setClaudeRequesterForTests();
  }
});

test("port manifest R018: the dashboard path saves the reserve on the lead", async () => {
  const { postPipeline } = await import("./post-pipeline.js");
  const lead = insertLead({ raw_email: "x", source_platform: "direct", mailgun_message_id: "sr-2" });
  const output = { classification: cl, pricing: {}, gate: { gate_status: "pass" }, confidence_score: 50,
    drafts: { full_draft: "Hi", compressed_draft: "Hi", compressed_word_count: 1, strategic_reserve: ["Wedding is on her parents' 40th"] } };
  // No alert channel yet, so the SMS step rejects after the save; the save is what this checks.
  await postPipeline(lead.id, output as never).catch(() => {});
  assert.equal(getLead(lead.id)?.strategic_reserve_json, '["Wedding is on her parents\' 40th"]');
});
