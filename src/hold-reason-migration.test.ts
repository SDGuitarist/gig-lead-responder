// Todo 097 plan scenarios M1-M4: the hold_reason column arrives as numbered migration v4, AFTER the legacy follow-up rebuild.
// initDb() is a module-level singleton, so every start-up runs in its own child process against its own temp database file.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import Database from "better-sqlite3";

const MIGRATE_URL = pathToFileURL(join(import.meta.dirname, "db", "migrate.ts")).href;

interface InitResult { ok: boolean; v?: number; hold?: boolean; rows?: string[]; err: string }

function runInit(dbPath: string): InitResult {
  const code = `const { initDb } = await import(${JSON.stringify(MIGRATE_URL)});
    const db = initDb();
    const cols = db.pragma("table_info(leads)").map((c) => c.name);
    const hold = cols.includes("hold_reason");
    const rows = db.prepare("SELECT mailgun_message_id m, raw_email r, " + (hold ? "hold_reason" : "NULL") + " h FROM leads ORDER BY id").all().map((x) => x.m + "|" + x.r + "|" + (x.h ?? "null"));
    console.log("RESULT " + JSON.stringify({ v: db.pragma("user_version", { simple: true }), hold, rows }));`;
  const env: NodeJS.ProcessEnv = { ...process.env, DATABASE_PATH: dbPath };
  delete env.NODE_TEST_CONTEXT; // a child that inherits it would report to its parent test runner
  const r = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", code], { env, encoding: "utf8" });
  const line = (r.stdout || "").split("\n").find((l) => l.startsWith("RESULT "));
  const err = (r.stderr || "").split("\n").find((l) => /error/i.test(l)) ?? "";
  return line && r.status === 0 ? { ok: true, err, ...JSON.parse(line.slice(7)) } : { ok: false, err };
}

const freshPath = () => join(mkdtempSync(join(tmpdir(), "glr-hold-mig-")), "leads.db");
const TWO_ROWS = ["m-1|first|null", "m-2|second|null"];

function insertTwo(dbPath: string, afterOpen?: (db: Database.Database) => void): void {
  const db = new Database(dbPath);
  afterOpen?.(db);
  db.exec("INSERT INTO leads (mailgun_message_id, raw_email, created_at, updated_at) VALUES ('m-1','first','x','x'),('m-2','second','x','x')");
  db.close();
}

// Pre-'replied' database: the baseline columns plus the loop columns, follow_up_status with the OLD 4-value CHECK,
// two rows with DISTINCT ids. (src/db-dedupe-guard.test.ts uses duplicate ids on purpose and fails before the copy.)
function makeLegacy(dbPath: string): void {
  const d = new Database(dbPath);
  d.exec(`CREATE TABLE leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT, source_platform TEXT, mailgun_message_id TEXT UNIQUE, raw_email TEXT NOT NULL, client_name TEXT, event_date TEXT,
    event_type TEXT, venue TEXT, guest_count INTEGER, budget_note TEXT,
    status TEXT NOT NULL DEFAULT 'received' CHECK(status IN ('received','sending','sent','done','failed')),
    classification_json TEXT, pricing_json TEXT, full_draft TEXT, compressed_draft TEXT, gate_passed INTEGER, gate_json TEXT,
    edit_round INTEGER NOT NULL DEFAULT 0, edit_instructions TEXT, done_reason TEXT, outcome TEXT, outcome_reason TEXT, actual_price REAL, outcome_at TEXT,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, confidence_score INTEGER, error_message TEXT, pipeline_completed_at TEXT, sms_sent_at TEXT,
    follow_up_status TEXT CHECK(follow_up_status IN ('pending','sent','skipped','exhausted')),
    follow_up_count INTEGER NOT NULL DEFAULT 0, follow_up_due_at TEXT, follow_up_draft TEXT, snoozed_until TEXT)`);
  d.close();
  insertTwo(dbPath);
}

test("M1 hold_reason migration: a fresh database gets the column at user_version 4", () => {
  const r = runInit(freshPath());
  assert.ok(r.ok, r.err);
  assert.equal(r.hold, true);
  assert.equal(r.v, 4);
});

test("M2 hold_reason migration: a version-3 database with rows is upgraded, rows kept, reason NULL", () => {
  const p = freshPath();
  assert.ok(runInit(p).ok); // process A creates the schema
  insertTwo(p, (db) => { db.exec("ALTER TABLE leads DROP COLUMN hold_reason"); db.pragma("user_version = 3"); }); // rewind to a real v3 shape
  const before = new Database(p, { readonly: true });
  assert.equal(before.pragma("user_version", { simple: true }), 3);
  assert.ok(!(before.pragma("table_info(leads)") as Array<{ name: string }>).some((c) => c.name === "hold_reason"));
  before.close();
  const r = runInit(p); // process B upgrades
  assert.ok(r.ok, r.err);
  assert.equal(r.v, 4);
  assert.equal(r.hold, true);
  assert.deepEqual(r.rows, TWO_ROWS);
});

test("M3 hold_reason migration: a pre-'replied' database with rows rebuilds first, then gains the column, rows kept (the loop placement fails this)", () => {
  const p = freshPath();
  makeLegacy(p);
  const r = runInit(p);
  assert.ok(r.ok, r.err);
  assert.equal(r.v, 4);
  assert.equal(r.hold, true);
  assert.deepEqual(r.rows, TWO_ROWS);
});

test("M4 hold_reason migration: a second start-up in a separate process works, stays at version 4 and keeps the rows", () => {
  const p = freshPath();
  assert.ok(runInit(p).ok);
  insertTwo(p);
  const r = runInit(p);
  assert.ok(r.ok, r.err);
  assert.equal(r.v, 4);
  assert.deepEqual(r.rows, TWO_ROWS);
});
