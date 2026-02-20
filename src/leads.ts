import Database from "better-sqlite3";
import type { LeadRecord, LeadStatus } from "./types.js";

const DB_PATH = process.env.DATABASE_PATH || "./data/leads.db";

let db: Database.Database;

export function initDb(): Database.Database {
  if (db) return db;

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
      status TEXT NOT NULL DEFAULT 'received',
      classification_json TEXT,
      pricing_json TEXT,
      full_draft TEXT,
      compressed_draft TEXT,
      gate_passed INTEGER,
      gate_json TEXT,
      edit_round INTEGER NOT NULL DEFAULT 0,
      edit_instructions TEXT,
      done_reason TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
  `);

  return db;
}

// --- CRUD ---

export interface InsertLeadInput {
  raw_email: string;
  source_platform?: string | null;
  mailgun_message_id?: string | null;
  client_name?: string | null;
  event_date?: string | null;
  event_type?: string | null;
  venue?: string | null;
  guest_count?: number | null;
  budget_note?: string | null;
}

export function insertLead(input: InsertLeadInput): LeadRecord {
  const now = new Date().toISOString();
  const stmt = initDb().prepare(`
    INSERT INTO leads (
      raw_email, source_platform, mailgun_message_id,
      client_name, event_date, event_type, venue, guest_count, budget_note,
      status, edit_round, created_at, updated_at
    ) VALUES (
      @raw_email, @source_platform, @mailgun_message_id,
      @client_name, @event_date, @event_type, @venue, @guest_count, @budget_note,
      'received', 0, @now, @now
    )
  `);

  const result = stmt.run({
    raw_email: input.raw_email,
    source_platform: input.source_platform ?? null,
    mailgun_message_id: input.mailgun_message_id ?? null,
    client_name: input.client_name ?? null,
    event_date: input.event_date ?? null,
    event_type: input.event_type ?? null,
    venue: input.venue ?? null,
    guest_count: input.guest_count ?? null,
    budget_note: input.budget_note ?? null,
    now,
  });

  return getLead(Number(result.lastInsertRowid))!;
}

export function getLead(id: number): LeadRecord | undefined {
  const row = initDb()
    .prepare("SELECT * FROM leads WHERE id = ?")
    .get(id) as LeadRecord | undefined;

  if (!row) return undefined;
  // SQLite stores booleans as 0/1; convert gate_passed
  return { ...row, gate_passed: row.gate_passed === null ? null : Boolean(row.gate_passed) };
}

export function getLeadsByStatus(status: LeadStatus): LeadRecord[] {
  const rows = initDb()
    .prepare("SELECT * FROM leads WHERE status = ? ORDER BY created_at DESC")
    .all(status) as LeadRecord[];

  return rows.map((r) => ({
    ...r,
    gate_passed: r.gate_passed === null ? null : Boolean(r.gate_passed),
  }));
}

export function updateLead(
  id: number,
  fields: Partial<Omit<LeadRecord, "id" | "created_at">>,
): LeadRecord | undefined {
  const current = getLead(id);
  if (!current) return undefined;

  // Build SET clause from provided fields
  const entries = Object.entries(fields).filter(
    ([key]) => key !== "updated_at",
  );
  if (entries.length === 0) return current;

  // Convert gate_passed boolean back to integer for SQLite
  const params: Record<string, unknown> = {};
  const setClauses: string[] = [];

  for (const [key, value] of entries) {
    setClauses.push(`${key} = @${key}`);
    params[key] = key === "gate_passed" && typeof value === "boolean"
      ? (value ? 1 : 0)
      : value;
  }

  setClauses.push("updated_at = @updated_at");
  params.updated_at = new Date().toISOString();
  params.id = id;

  initDb()
    .prepare(`UPDATE leads SET ${setClauses.join(", ")} WHERE id = @id`)
    .run(params);

  return getLead(id);
}

export function listLeads(): LeadRecord[] {
  const rows = initDb()
    .prepare("SELECT * FROM leads ORDER BY created_at DESC")
    .all() as LeadRecord[];

  return rows.map((r) => ({
    ...r,
    gate_passed: r.gate_passed === null ? null : Boolean(r.gate_passed),
  }));
}
