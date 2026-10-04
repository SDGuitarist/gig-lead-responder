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

// Follow-up #n gets the n-th banked insight as its fresh angle; none = today's prompt.
test("port manifest R018: follow-up n uses the n-th reserve insight, and only when there is one", async () => {
  const { buildFollowUpPrompt } = await import("./prompts/follow-up.js");
  const lead = (reserve: string | null) => ({ event_type: "Wedding", event_date: null, venue: null, client_name: "Ana",
    classification_json: null, compressed_draft: "Hi Ana.", strategic_reserve_json: reserve }) as never;
  const banked = JSON.stringify(["Her dad played requinto at his own wedding", "The ceremony is outdoors at sunset"]);
  const first = buildFollowUpPrompt(lead(banked), 1);
  assert.ok(first.includes("FRESH ANGLE (banked from the first reply)"));
  assert.ok(first.includes("Her dad played requinto") && !first.includes("ceremony is outdoors"));
  assert.ok(buildFollowUpPrompt(lead(banked), 2).includes("ceremony is outdoors"));
  for (const r of [null, "not json", "[]", '{"a":1}']) {
    assert.ok(!buildFollowUpPrompt(lead(r), 1).includes("FRESH ANGLE"), `absent for ${r}`);
  }
  assert.ok(!buildFollowUpPrompt(lead(banked), 3).includes("FRESH ANGLE"), "no third insight banked");
});

// Codex round 1 (reserve/auth range), finding 1: the prompt said "one sentence, never a
// price" but nothing enforced it. Enforced at parse, which runs before saving AND when
// the follow-up reads the stored reserve.
test("port manifest R018: a reserve entry with a price or past one sentence's length is dropped", () => {
  const long = "Her grandmother ".repeat(30) + "sang.";
  assert.deepEqual(normalizeStrategicReserve(["Quote $1,800 if they push back", "Offer 2 hours for 900 dollars", long,
    "Her abuela sang Las Mañanitas at every birthday — keep that in mind"]), ["Her abuela sang Las Mañanitas at every birthday — keep that in mind"]);
  assert.deepEqual(normalizeStrategicReserve(["Two lines\n\nwith a gap"]), ["Two lines with a gap"], "whitespace collapsed");
  assert.deepEqual(normalizeStrategicReserve(["The ceremony starts at 4:30 for 120 guests"]), ["The ceremony starts at 4:30 for 120 guests"],
    "overshoot control: times and guest counts are not prices");
});

// Codex round 1 (reserve/auth range), finding 3: the generic migration tests use made-up
// migrations; these run the app's real MIGRATIONS list (temp DBs only).
test("port manifest R018: the real migration list backs up, reruns as a no-op, and refuses a newer DB", async () => {
  const { readdirSync } = await import("node:fs");
  const Database = (await import("better-sqlite3")).default;
  const { MIGRATIONS, runMigrations, assertDbNotNewer } = await import("./db/migrations.js");
  initDb(); // applies v1..v3 with backups if no earlier test did
  const backups = join(dirname(process.env.DATABASE_PATH!), "backups");
  const pre = new Database(join(backups, "pre-v3.db"), { readonly: true });
  const preCols = (pre.pragma("table_info(leads)") as Array<{ name: string }>).map((c) => c.name);
  assert.ok(preCols.includes("raw_email") && !preCols.includes("strategic_reserve_json"), "pre-v3 backup has the old schema");
  pre.close();
  const before = readdirSync(backups).sort();
  assert.deepEqual(runMigrations(initDb(), MIGRATIONS, backups), [], "already at v3: nothing applied");
  assert.deepEqual(readdirSync(backups).sort(), before, "and no new backup");
  const newer = new Database(join(mkdtempSync(join(tmpdir(), "glr-newer-")), "leads.db"));
  newer.pragma(`user_version = ${MIGRATIONS.length + 1}`);
  assert.throws(() => assertDbNotNewer(newer, MIGRATIONS), /newer than this code/);
  newer.close();
});
