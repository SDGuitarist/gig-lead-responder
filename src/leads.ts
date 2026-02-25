import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import type { LeadRecord, LeadStatus, LeadOutcome, LossReason, AnalyticsResponse } from "./types.js";

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
      outcome TEXT CHECK(outcome IN ('booked','lost','no_reply')),
      outcome_reason TEXT CHECK(outcome_reason IN ('price','competitor','cancelled','other')),
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
    ["outcome", "TEXT CHECK(outcome IN ('booked','lost','no_reply'))"],
    ["outcome_reason", "TEXT CHECK(outcome_reason IN ('price','competitor','cancelled','other'))"],
    ["actual_price", "REAL CHECK(actual_price IS NULL OR actual_price > 0)"],
    ["outcome_at", "TEXT"],
  ];
  for (const [col, type] of migrations) {
    if (!existingCols.has(col)) {
      db.exec(`ALTER TABLE leads ADD COLUMN ${col} ${type}`);
    }
  }

  // Create index after migrations so confidence_score column exists
  db.exec("CREATE INDEX IF NOT EXISTS idx_leads_confidence ON leads(confidence_score)");

  return db;
}

// --- Helpers ---

/** SQLite stores booleans as 0/1; normalize gate_passed back to boolean. */
function normalizeRow(row: LeadRecord): LeadRecord {
  return { ...row, gate_passed: row.gate_passed === null ? null : Boolean(row.gate_passed) };
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
  return normalizeRow(row);
}

export function getLeadsByStatus(status: LeadStatus): LeadRecord[] {
  const rows = initDb()
    .prepare("SELECT * FROM leads WHERE status = ? ORDER BY created_at DESC")
    .all(status) as LeadRecord[];

  return rows.map(normalizeRow);
}

// Whitelist of columns allowed in updateLead() — must match LeadRecord fields exactly.
// Prevents runtime key injection into SQL SET clauses.
const UPDATE_ALLOWED_COLUMNS = new Set<string>([
  "source_platform", "mailgun_message_id", "raw_email",
  "client_name", "event_date", "event_type", "venue", "guest_count", "budget_note",
  "status", "classification_json", "pricing_json",
  "full_draft", "compressed_draft", "gate_passed", "gate_json",
  "confidence_score", "error_message", "pipeline_completed_at", "sms_sent_at",
  "edit_round", "edit_instructions", "done_reason",
  "outcome", "outcome_reason", "actual_price", "outcome_at",
  "updated_at",
]);

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

  // Validate all keys against whitelist before building SQL
  for (const [key] of entries) {
    if (!UPDATE_ALLOWED_COLUMNS.has(key)) {
      throw new Error(`updateLead: invalid column "${key}"`);
    }
  }

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

/** Atomically set status to 'sending' if currently approvable. Returns true if claimed. */
export function claimLeadForSending(id: number): boolean {
  const result = initDb()
    .prepare(
      "UPDATE leads SET status = 'sending', updated_at = @updated_at WHERE id = @id AND status IN ('received', 'sent')",
    )
    .run({ id, updated_at: new Date().toISOString() });
  return result.changes > 0;
}

// --- Idempotency (processed_emails) ---

export function isEmailProcessed(externalId: string): boolean {
  const row = initDb()
    .prepare("SELECT 1 FROM processed_emails WHERE external_id = ?")
    .get(externalId);
  return row !== undefined;
}

export function markEmailProcessed(externalId: string, platform: string): void {
  initDb()
    .prepare("INSERT OR IGNORE INTO processed_emails (external_id, platform) VALUES (?, ?)")
    .run(externalId, platform);
}

/** Run a callback inside a SQLite transaction (atomic, serialized). */
export function runTransaction<T>(fn: () => T): T {
  return initDb().transaction(fn)();
}

// --- Dashboard queries ---

export interface ListLeadsFilteredOpts {
  status?: LeadStatus;
  sort?: "date" | "score" | "event";
}

export function listLeadsFiltered(opts: ListLeadsFilteredOpts = {}): LeadRecord[] {
  let sql = "SELECT * FROM leads";
  const params: Record<string, unknown> = {};

  if (opts.status) {
    sql += " WHERE status = @status";
    params.status = opts.status;
  }

  switch (opts.sort) {
    case "date":
      sql += " ORDER BY event_date IS NULL, event_date ASC, created_at DESC";
      break;
    case "score":
      sql += " ORDER BY confidence_score IS NULL, confidence_score DESC";
      break;
    case "event":
      sql += " ORDER BY event_type IS NULL, event_type ASC";
      break;
    default:
      sql += " ORDER BY created_at DESC";
  }

  const rows = initDb().prepare(sql).all(params) as LeadRecord[];

  return rows.map(normalizeRow);
}

export interface LeadStats {
  pending: number;
  sent: number;
  avg_score: number | null;
  this_month: number;
}

// --- Outcome tracking ---

/** Set or clear a lead's outcome. Handles sub-field cleanup automatically. */
export function setLeadOutcome(
  id: number,
  outcome: LeadOutcome | null,
  options?: { outcome_reason?: LossReason; actual_price?: number },
): LeadRecord | undefined {
  const fields: Partial<Omit<LeadRecord, "id" | "created_at">> = {
    outcome,
    outcome_at: outcome !== null ? new Date().toISOString() : null,
    // Always clear both sub-fields, then set only the relevant one
    actual_price: null,
    outcome_reason: null,
  };
  if (outcome === "booked" && options?.actual_price != null) {
    fields.actual_price = options.actual_price;
  }
  if (outcome === "lost" && options?.outcome_reason) {
    fields.outcome_reason = options.outcome_reason;
  }
  return updateLead(id, fields);
}

/** Analytics for the Insights tab. 3 queries in a read transaction. */
export function getAnalytics(): AnalyticsResponse {
  const database = initDb();
  return database.transaction(() => {
    // Query 1: Core counts + revenue + avg prices
    const core = database.prepare(`
      SELECT
        COUNT(*) AS total_leads,
        SUM(CASE WHEN outcome IS NOT NULL THEN 1 ELSE 0 END) AS total_with_outcome,
        SUM(CASE WHEN outcome = 'booked' THEN 1 ELSE 0 END) AS booked,
        SUM(CASE WHEN outcome = 'lost' THEN 1 ELSE 0 END) AS lost,
        SUM(CASE WHEN outcome = 'no_reply' THEN 1 ELSE 0 END) AS no_reply,
        SUM(CASE WHEN outcome = 'booked' AND actual_price IS NOT NULL
            THEN actual_price ELSE 0 END) AS revenue,
        AVG(CASE WHEN outcome = 'booked' AND actual_price IS NOT NULL
            THEN actual_price END) AS avg_actual_price,
        AVG(CASE WHEN outcome IS NOT NULL AND pricing_json IS NOT NULL
            THEN json_extract(pricing_json, '$.quote_price') END) AS avg_quote_price
      FROM leads
      WHERE status IN ('sent', 'done')
    `).get() as {
      total_leads: number;
      total_with_outcome: number;
      booked: number;
      lost: number;
      no_reply: number;
      revenue: number;
      avg_actual_price: number | null;
      avg_quote_price: number | null;
    };

    // Query 2: By platform
    const byPlatform = database.prepare(`
      SELECT source_platform AS label, COUNT(*) AS total,
        SUM(CASE WHEN outcome = 'booked' THEN 1 ELSE 0 END) AS booked
      FROM leads WHERE outcome IS NOT NULL
      GROUP BY source_platform
    `).all() as Array<{ label: string; total: number; booked: number }>;

    // Query 3: By format (from classification_json)
    const byFormat = database.prepare(`
      SELECT json_extract(classification_json, '$.format_recommended') AS label,
        COUNT(*) AS total,
        SUM(CASE WHEN outcome = 'booked' THEN 1 ELSE 0 END) AS booked
      FROM leads WHERE outcome IS NOT NULL AND classification_json IS NOT NULL
      GROUP BY label
    `).all() as Array<{ label: string; total: number; booked: number }>;

    const totalWithOutcome = core.total_with_outcome ?? 0;
    const booked = core.booked ?? 0;

    return {
      total_leads: core.total_leads ?? 0,
      total_with_outcome: totalWithOutcome,
      total_untracked: (core.total_leads ?? 0) - totalWithOutcome,
      booked,
      lost: core.lost ?? 0,
      no_reply: core.no_reply ?? 0,
      conversion_rate: totalWithOutcome > 0 ? booked / totalWithOutcome : 0,
      revenue: core.revenue ?? 0,
      avg_quote_price: core.avg_quote_price !== null ? Math.round(core.avg_quote_price) : null,
      avg_actual_price: core.avg_actual_price !== null ? Math.round(core.avg_actual_price) : null,
      by_platform: byPlatform.map((r) => ({
        label: r.label ?? "unknown",
        total: r.total,
        booked: r.booked,
        rate: r.total > 0 ? r.booked / r.total : 0,
      })),
      by_format: byFormat.map((r) => ({
        label: r.label ?? "unknown",
        total: r.total,
        booked: r.booked,
        rate: r.total > 0 ? r.booked / r.total : 0,
      })),
    };
  })();
}

export function getLeadStats(): LeadStats {
  const now = new Date();
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  const row = initDb()
    .prepare(
      `SELECT
        SUM(CASE WHEN status = 'received' THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS sent,
        AVG(CASE WHEN confidence_score IS NOT NULL THEN confidence_score END) AS avg_score,
        SUM(CASE WHEN created_at >= @firstOfMonth THEN 1 ELSE 0 END) AS this_month
      FROM leads`,
    )
    .get({ firstOfMonth }) as {
    pending: number;
    sent: number;
    avg_score: number | null;
    this_month: number;
  };

  return {
    pending: row.pending ?? 0,
    sent: row.sent ?? 0,
    avg_score: row.avg_score !== null ? Math.round(row.avg_score) : null,
    this_month: row.this_month ?? 0,
  };
}
