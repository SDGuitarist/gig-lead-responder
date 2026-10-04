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
