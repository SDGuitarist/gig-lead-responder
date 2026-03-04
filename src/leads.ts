import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import type { LeadRecord, LeadStatus, LeadOutcome, LossReason, AnalyticsResponse, FollowUpStatus } from "./types.js";
import { FOLLOW_UP_STATUSES } from "./types.js";

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

// --- Venue miss logging ---

/**
 * Log a venue miss (PF-Intel returned found: false).
 * Deduplicates by venue_name — increments hit_count on repeat misses.
 * Separate from updateLead — different concern, different failure mode.
 */
export function logVenueMiss(venueName: string, leadId: number | undefined): void {
  // Truncate to 200 chars before insert
  const truncated = venueName.slice(0, 200);
  try {
    initDb()
      .prepare(
        `INSERT INTO venue_misses (venue_name, last_lead_id)
         VALUES (@venueName, @leadId)
         ON CONFLICT(venue_name) DO UPDATE SET
           hit_count = hit_count + 1,
           last_lead_id = excluded.last_lead_id,
           last_seen_at = datetime('now')`,
      )
      .run({ venueName: truncated, leadId: leadId ?? null });
  } catch (err) {
    // Don't let miss logging crash the pipeline
    console.warn(`[venue-miss] Failed to log miss for "${truncated}":`, err);
  }
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
  "follow_up_status", "follow_up_count", "follow_up_due_at", "follow_up_draft",
  "snoozed_until", "updated_at",
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

// --- Follow-up helpers ---

/*
 * Follow-up state machine (5 states, 8 transitions):
 *
 *   NULL ──completeApproval()──▶ pending
 *   pending ──scheduler──▶ sent        (draft generated, SMS sent to Alex)
 *   pending ──SKIP──▶ skipped          (cancel all follow-ups)
 *   pending ──REPLIED──▶ replied       (client responded)
 *   sent ──SEND──▶ pending             (count++, schedule next if count < 3)
 *   sent ──SEND──▶ exhausted           (count reaches 3, terminal)
 *   sent ──SKIP──▶ skipped             (cancel all follow-ups)
 *   sent ──REPLIED──▶ replied          (client responded)
 */

const MAX_FOLLOW_UPS = 3;

const FOLLOW_UP_DELAYS_MS = [
  24 * 60 * 60 * 1_000,     // 1st: 24 hours
  3 * 24 * 60 * 60 * 1_000, // 2nd: 3 days
  7 * 24 * 60 * 60 * 1_000, // 3rd: 7 days
];

/** Returns delay in ms before the next follow-up. */
function computeFollowUpDelay(followUpCount: 0 | 1 | 2): number {
  return FOLLOW_UP_DELAYS_MS[followUpCount];
}

/** Query leads that are due for follow-up (pending + past due). */
export function getLeadsDueForFollowUp(): LeadRecord[] {
  const rows = initDb()
    .prepare(
      "SELECT * FROM leads WHERE follow_up_status = 'pending' AND follow_up_due_at <= datetime('now') ORDER BY follow_up_due_at ASC LIMIT 10",
    )
    .all() as LeadRecord[];
  return rows.map(normalizeRow);
}

/** Get the most recent lead awaiting follow-up approval (status = 'sent'). */
export function getLeadAwaitingFollowUp(): LeadRecord | undefined {
  const row = initDb()
    .prepare("SELECT * FROM leads WHERE follow_up_status = 'sent' ORDER BY updated_at DESC LIMIT 1")
    .get() as LeadRecord | undefined;
  return row ? normalizeRow(row) : undefined;
}

/** Get the most recent lead with an active follow-up (pending or sent). */
export function getLeadWithActiveFollowUp(): LeadRecord | undefined {
  const row = initDb()
    .prepare("SELECT * FROM leads WHERE follow_up_status IN ('pending', 'sent') ORDER BY updated_at DESC LIMIT 1")
    .get() as LeadRecord | undefined;
  return row ? normalizeRow(row) : undefined;
}

/** Set a lead's follow-up to pending with a due date. */
export function scheduleFollowUp(leadId: number, dueAt: string): void {
  updateLead(leadId, { follow_up_status: "pending", follow_up_due_at: dueAt });
}

// --- Atomic follow-up claim functions ---
// Used by BOTH dashboard API and SMS handlers — single code path for all transitions.

/** Fields to clear when entering a terminal state (skipped, exhausted, replied). */
const TERMINAL_CLEAR = {
  follow_up_due_at: null,
  follow_up_draft: null,
  snoozed_until: null,
} as const;

/**
 * Approve a follow-up draft (SEND). Atomically claims status='sent', increments count,
 * schedules next or exhausts. Returns updated lead or undefined if claim failed.
 */
export function approveFollowUp(leadId: number): LeadRecord | undefined {
  return runTransaction(() => {
    const now = new Date().toISOString();
    const result = initDb()
      .prepare(
        "UPDATE leads SET follow_up_status = 'pending', updated_at = @now " +
        "WHERE id = @id AND follow_up_status = 'sent'",
      )
      .run({ id: leadId, now });

    if (result.changes === 0) return undefined;

    const lead = getLead(leadId);
    if (!lead) return undefined;

    const newCount = lead.follow_up_count + 1;

    if (newCount >= MAX_FOLLOW_UPS) {
      // Terminal — all follow-ups done
      return updateLead(leadId, {
        follow_up_status: "exhausted",
        follow_up_count: newCount,
        ...TERMINAL_CLEAR,
      });
    }

    // Schedule next follow-up
    const delay = computeFollowUpDelay(newCount as 0 | 1 | 2);
    const dueAt = new Date(Date.now() + delay).toISOString();
    return updateLead(leadId, {
      follow_up_count: newCount,
      follow_up_due_at: dueAt,
      follow_up_draft: null,
      snoozed_until: null,
    });
  });
}

/**
 * Skip all remaining follow-ups. Atomically claims from pending or sent.
 * Returns updated lead or undefined if claim failed.
 */
export function skipFollowUp(leadId: number): LeadRecord | undefined {
  const now = new Date().toISOString();
  const result = initDb()
    .prepare(
      "UPDATE leads SET follow_up_status = 'skipped', " +
      "follow_up_due_at = NULL, follow_up_draft = NULL, snoozed_until = NULL, " +
      "updated_at = @now " +
      "WHERE id = @id AND follow_up_status IN ('pending', 'sent')",
    )
    .run({ id: leadId, now });

  if (result.changes === 0) return undefined;
  return getLead(leadId);
}

/**
 * Snooze a follow-up. Sets snoozed_until AND due_at atomically, clears draft,
 * transitions to pending. Returns updated lead or undefined if claim failed.
 */
export function snoozeFollowUp(leadId: number, until: string): LeadRecord | undefined {
  const now = new Date().toISOString();
  // Enforce invariant: snoozed_until ≤ due_at (use snooze date as new due_at)
  const result = initDb()
    .prepare(
      "UPDATE leads SET follow_up_status = 'pending', " +
      "snoozed_until = @until, follow_up_due_at = @until, follow_up_draft = NULL, " +
      "updated_at = @now " +
      "WHERE id = @id AND follow_up_status IN ('sent', 'pending')",
    )
    .run({ id: leadId, until, now });

  if (result.changes === 0) return undefined;
  return getLead(leadId);
}

/**
 * Mark that the client replied. Terminal state — clears all follow-up fields.
 * Returns updated lead or undefined if claim failed.
 */
export function markClientReplied(leadId: number): LeadRecord | undefined {
  const now = new Date().toISOString();
  const result = initDb()
    .prepare(
      "UPDATE leads SET follow_up_status = 'replied', " +
      "follow_up_due_at = NULL, follow_up_draft = NULL, snoozed_until = NULL, " +
      "updated_at = @now " +
      "WHERE id = @id AND follow_up_status IN ('pending', 'sent')",
    )
    .run({ id: leadId, now });

  if (result.changes === 0) return undefined;
  return getLead(leadId);
}

/**
 * Scheduler's atomic claim: pending → sent. Includes snoozed_until guard so
 * snoozed leads aren't processed. Returns true if claimed.
 */
export function claimFollowUpForSending(leadId: number): boolean {
  const now = new Date().toISOString();
  const result = initDb()
    .prepare(
      "UPDATE leads SET follow_up_status = 'sent', updated_at = @now " +
      "WHERE id = @id AND follow_up_status = 'pending' " +
      "AND (snoozed_until IS NULL OR snoozed_until <= datetime('now'))",
    )
    .run({ id: leadId, now });

  return result.changes > 0;
}

/**
 * Shared approval function — called by BOTH Twilio webhook and dashboard API.
 * Atomically sets status = "done" and schedules the first follow-up.
 */
export function completeApproval(leadId: number, doneReason: string, smsSentAt?: string): LeadRecord | undefined {
  return runTransaction(() => {
    const fields: Partial<Omit<LeadRecord, "id" | "created_at">> = {
      status: "done",
      done_reason: doneReason,
    };
    if (smsSentAt) fields.sms_sent_at = smsSentAt;
    const lead = updateLead(leadId, fields);
    if (lead) {
      const delay = computeFollowUpDelay(0);
      const dueAt = new Date(Date.now() + delay).toISOString();
      scheduleFollowUp(leadId, dueAt);
    }
    return lead;
  });
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

/**
 * List leads with active follow-ups (pending or sent — not terminal states).
 * Sorted: sent (action needed) first, then by due_at ascending.
 */
export function listFollowUpLeads(): LeadRecord[] {
  const sql = `
    SELECT * FROM leads
    WHERE follow_up_status IS NOT NULL
      AND follow_up_status NOT IN ('skipped', 'exhausted', 'replied')
    ORDER BY
      CASE follow_up_status WHEN 'sent' THEN 0 ELSE 1 END,
      follow_up_due_at ASC
  `;
  const rows = initDb().prepare(sql).all() as LeadRecord[];
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
  // Guard: only done leads can have outcomes (matches API check + DB intent)
  const lead = getLead(id);
  if (!lead || lead.status !== "done") return undefined;

  // Runtime guard matching DB CHECK constraint: actual_price > 0
  if (options?.actual_price != null && (!Number.isFinite(options.actual_price) || options.actual_price <= 0)) {
    return undefined;
  }

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

/** Analytics for the Insights tab. 3 queries in a read-only transaction. */
export function getAnalytics(): AnalyticsResponse {
  const db = initDb();
  return db.transaction(() => {
    // Query 1: Core counts + revenue + avg prices
    const core = db.prepare(`
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
      WHERE status = 'done'
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
    const byPlatform = db.prepare(`
      SELECT source_platform AS label, COUNT(*) AS total,
        SUM(CASE WHEN outcome = 'booked' THEN 1 ELSE 0 END) AS booked
      FROM leads WHERE status = 'done' AND outcome IS NOT NULL
      GROUP BY source_platform
    `).all() as Array<{ label: string; total: number; booked: number }>;

    // Query 3: By format (from classification_json)
    const byFormat = db.prepare(`
      SELECT json_extract(classification_json, '$.format_recommended') AS label,
        COUNT(*) AS total,
        SUM(CASE WHEN outcome = 'booked' THEN 1 ELSE 0 END) AS booked
      FROM leads WHERE status = 'done' AND outcome IS NOT NULL AND classification_json IS NOT NULL
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
