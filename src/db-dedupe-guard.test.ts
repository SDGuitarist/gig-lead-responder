import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";

// An old-schema DB (follow_up_status CHECK without 'replied', no UNIQUE on
// mailgun_message_id) holding two rows with the same id. The legacy rebuild
// used to DELETE one of them silently. It must now refuse and keep both.
const dbPath = join(mkdtempSync(join(tmpdir(), "glr-dedupe-")), "leads.db");
const old = new Database(dbPath);
old.exec(`
  CREATE TABLE leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_platform TEXT,
    mailgun_message_id TEXT,
    raw_email TEXT NOT NULL,
    client_name TEXT, event_date TEXT, event_type TEXT, venue TEXT,
    guest_count INTEGER, budget_note TEXT,
    status TEXT NOT NULL DEFAULT 'received',
    classification_json TEXT, pricing_json TEXT, full_draft TEXT, compressed_draft TEXT,
    gate_passed INTEGER, gate_json TEXT,
    edit_round INTEGER NOT NULL DEFAULT 0,
    edit_instructions TEXT, done_reason TEXT,
    outcome TEXT, outcome_reason TEXT, actual_price REAL, outcome_at TEXT,
    follow_up_status TEXT CHECK(follow_up_status IN ('pending','sent','skipped','exhausted')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  INSERT INTO leads (mailgun_message_id, raw_email, created_at, updated_at) VALUES ('dup-1', 'first', 'x', 'x');
  INSERT INTO leads (mailgun_message_id, raw_email, created_at, updated_at) VALUES ('dup-1', 'second', 'x', 'x');
`);
old.close();
process.env.DATABASE_PATH = dbPath;

test("legacy rebuild refuses duplicate message ids instead of deleting rows", async () => {
  const { initDb } = await import("./db/migrate.js");
  assert.throws(() => initDb(), /duplicate mailgun_message_id/);
  const check = new Database(dbPath, { readonly: true });
  const rows = check.prepare("SELECT raw_email FROM leads ORDER BY id").all() as Array<{ raw_email: string }>;
  assert.deepEqual(rows.map((r) => r.raw_email), ["first", "second"]);
});
