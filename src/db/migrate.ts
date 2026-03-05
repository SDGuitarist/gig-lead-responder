// Allowed imports: node builtins, better-sqlite3, ../types.js only
// NEVER import from ./index.js (circular dependency risk)

import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { FOLLOW_UP_STATUSES } from "../types.js";

const DB_PATH = process.env.DATABASE_PATH || "./data/leads.db";

let db: Database.Database;

export function initDb(): Database.Database {
  if (db) return db;

  mkdirSync(dirname(DB_PATH), { recursive: true });
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_platform TEXT,
      mailgun_message_id TEXT UNIQUE,
      raw_email TEXT NOT NULL,
      client_name TEXT,
      event_date TEXT,
      event_type TEXT,
      venue TEXT,
      guest_count INTEGER,
      budget_note TEXT,
      status TEXT NOT NULL DEFAULT 'received' CHECK(status IN ('received','sending','sent','done','failed')),
      classification_json TEXT,
      pricing_json TEXT,
      full_draft TEXT,
      compressed_draft TEXT,
      gate_passed INTEGER,
      gate_json TEXT,
      edit_round INTEGER NOT NULL DEFAULT 0,
      edit_instructions TEXT,
      done_reason TEXT,
      outcome TEXT CHECK(outcome IN ('booked','lost','no_reply')),         -- SYNC: LEAD_OUTCOMES in types.ts
      outcome_reason TEXT CHECK(outcome_reason IN ('price','competitor','cancelled','other')),  -- SYNC: LOSS_REASONS in types.ts
      actual_price REAL CHECK(actual_price IS NULL OR actual_price > 0),
      outcome_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
    CREATE INDEX IF NOT EXISTS idx_leads_event_date ON leads(event_date);

    CREATE TABLE IF NOT EXISTS processed_emails (
      external_id TEXT PRIMARY KEY,
      platform TEXT NOT NULL,
      received_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Add columns that didn't exist in Phase 1 (safe for existing DBs)
  const existingCols = new Set(
    (db.pragma("table_info(leads)") as Array<{ name: string }>).map((c) => c.name),
  );
  const migrations: Array<[string, string]> = [
    ["confidence_score", "INTEGER"],
    ["error_message", "TEXT"],
    ["pipeline_completed_at", "TEXT"],
    ["sms_sent_at", "TEXT"],
    // SYNC: CHECK values must match LEAD_OUTCOMES in types.ts
    ["outcome", "TEXT CHECK(outcome IN ('booked','lost','no_reply'))"],
    // SYNC: CHECK values must match LOSS_REASONS in types.ts
    ["outcome_reason", "TEXT CHECK(outcome_reason IN ('price','competitor','cancelled','other'))"],
    ["actual_price", "REAL CHECK(actual_price IS NULL OR actual_price > 0)"],
    ["outcome_at", "TEXT"],
    // SYNC: CHECK values must match FOLLOW_UP_STATUSES in types.ts
    ["follow_up_status", `TEXT CHECK(follow_up_status IN (${FOLLOW_UP_STATUSES.map((s) => `'${s}'`).join(",")}))`],
    ["follow_up_count", "INTEGER NOT NULL DEFAULT 0"],
    ["follow_up_due_at", "TEXT"],
    ["follow_up_draft", "TEXT"],
    ["snoozed_until", "TEXT"],
  ];
  for (const [col, type] of migrations) {
    if (!existingCols.has(col)) {
      db.exec(`ALTER TABLE leads ADD COLUMN ${col} ${type}`);
    }
  }

  // --- Table rebuild: add 'replied' to follow_up_status CHECK constraint ---
  // SQLite cannot ALTER CHECK constraints. Existing production DBs have the old
  // 4-value CHECK. This rebuild adds 'replied' to the constraint.
  // Safe for small tables (<100 rows). Runs once: skips if 'replied' already in schema.
  const tableSql = (db.prepare(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name='leads'",
  ).get() as { sql: string } | undefined)?.sql ?? "";
  const needsFollowUpRebuild = tableSql.includes("follow_up_status") && !tableSql.includes("'replied'");

  if (needsFollowUpRebuild) {
    console.log("Migration: rebuilding leads table to add 'replied' to follow_up_status CHECK...");

    // Pre-check: deduplicate mailgun_message_id before rebuild (UNIQUE constraint would fail)
    const dupes = db.prepare(
      "SELECT mailgun_message_id, COUNT(*) as cnt FROM leads WHERE mailgun_message_id IS NOT NULL GROUP BY mailgun_message_id HAVING cnt > 1",
    ).all() as Array<{ mailgun_message_id: string; cnt: number }>;
    if (dupes.length > 0) {
      console.warn(`Migration: found ${dupes.length} duplicate mailgun_message_id(s) — deduplicating (keeping newest)...`);
      for (const dupe of dupes) {
        // Keep the row with the highest id (newest), delete older duplicates
        db.prepare(
          "DELETE FROM leads WHERE mailgun_message_id = ? AND id NOT IN (SELECT MAX(id) FROM leads WHERE mailgun_message_id = ?)",
        ).run(dupe.mailgun_message_id, dupe.mailgun_message_id);
      }
      console.log("Migration: duplicates resolved.");
    }

    const colNames = (db.pragma("table_info(leads)") as Array<{ name: string }>).map(c => c.name);
    const colList = colNames.join(", ");

    db.transaction(() => {
      db.exec(`
        CREATE TABLE leads_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          source_platform TEXT,
          mailgun_message_id TEXT UNIQUE,
          raw_email TEXT NOT NULL,
          client_name TEXT,
          event_date TEXT,
          event_type TEXT,
          venue TEXT,
          guest_count INTEGER,
          budget_note TEXT,
          status TEXT NOT NULL DEFAULT 'received' CHECK(status IN ('received','sending','sent','done','failed')),
          classification_json TEXT,
          pricing_json TEXT,
          full_draft TEXT,
          compressed_draft TEXT,
          gate_passed INTEGER,
          gate_json TEXT,
          edit_round INTEGER NOT NULL DEFAULT 0,
          edit_instructions TEXT,
          done_reason TEXT,
          outcome TEXT CHECK(outcome IN ('booked','lost','no_reply')),
          outcome_reason TEXT CHECK(outcome_reason IN ('price','competitor','cancelled','other')),
          actual_price REAL CHECK(actual_price IS NULL OR actual_price > 0),
          outcome_at TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          confidence_score INTEGER,
          error_message TEXT,
          pipeline_completed_at TEXT,
          sms_sent_at TEXT,
          follow_up_status TEXT CHECK(follow_up_status IN ('pending','sent','skipped','exhausted','replied')),
          follow_up_count INTEGER NOT NULL DEFAULT 0,
          follow_up_due_at TEXT,
          follow_up_draft TEXT,
          snoozed_until TEXT
        )
      `);
      db.exec(`INSERT INTO leads_new (${colList}) SELECT ${colList} FROM leads`);
      db.exec("DROP TABLE leads");
      db.exec("ALTER TABLE leads_new RENAME TO leads");
    })();
    console.log("Migration complete: follow_up_status CHECK now includes 'replied'.");
  }

  // Create indexes after migrations so all columns exist (includes idx_leads_status
  // and idx_leads_event_date which are dropped if the table rebuild migration runs)
  db.exec("CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_leads_event_date ON leads(event_date)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_leads_confidence ON leads(confidence_score)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_leads_outcome ON leads(outcome)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_leads_source_platform ON leads(source_platform)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_leads_follow_up_due ON leads(follow_up_status, follow_up_due_at)");

  // venue_misses: deduplicated log of venue names not found in PF-Intel
  db.exec(`
    CREATE TABLE IF NOT EXISTS venue_misses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      venue_name TEXT NOT NULL UNIQUE,
      hit_count INTEGER NOT NULL DEFAULT 1,
      last_lead_id INTEGER,
      first_seen_at TEXT DEFAULT (datetime('now')),
      last_seen_at TEXT DEFAULT (datetime('now'))
    )
  `);

  return db;
}
