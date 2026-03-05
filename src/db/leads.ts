// Allowed imports: ./migrate.js, ../types.js, node builtins only
// NEVER import from ./index.js (circular dependency risk)

import { types } from "node:util";
import type Database from "better-sqlite3";
import type { LeadRecord, LeadStatus, LeadOutcome, LossReason } from "../types.js";
import { initDb } from "./migrate.js";

// stmt() pattern also in follow-ups.ts, queries.ts — keep in sync
let cachedDb: Database.Database | undefined;
const stmtCache = new Map<string, Database.Statement>();
function stmt(sql: string): Database.Statement {
  const db = initDb();
  if (db !== cachedDb) {
    stmtCache.clear();
    cachedDb = db;
  }
  let s = stmtCache.get(sql);
  if (!s) {
    s = db.prepare(sql);
    stmtCache.set(sql, s);
  }
  return s;
}

// --- Venue miss logging ---

/**
 * Log a venue miss (PF-Intel returned found: false).
 * Deduplicates by venue_name — increments hit_count on repeat misses.
 * Separate from updateLead — different concern, different failure mode.
 */
export function logVenueMiss(venueName: string, leadId: number | undefined): void {
  const truncated = venueName.slice(0, 200);
  try {
    stmt(
      `INSERT INTO venue_misses (venue_name, last_lead_id)
       VALUES (@venueName, @leadId)
       ON CONFLICT(venue_name) DO UPDATE SET
         hit_count = hit_count + 1,
         last_lead_id = excluded.last_lead_id,
         last_seen_at = datetime('now')`,
    ).run({ venueName: truncated, leadId: leadId ?? null });
  } catch (err) {
    console.warn(`[venue-miss] Failed to log miss for "${truncated}":`, err);
  }
}

// --- Helpers ---

/** SQLite stores booleans as 0/1; normalize gate_passed back to boolean. */
export function normalizeLeadRow(row: LeadRecord): LeadRecord {
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
  const insertStmt = stmt(`
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

  const result = insertStmt.run({
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
  const row = stmt("SELECT * FROM leads WHERE id = ?")
    .get(id) as LeadRecord | undefined;

  if (!row) return undefined;
  return normalizeLeadRow(row);
}

export function getLeadsByStatus(status: LeadStatus): LeadRecord[] {
  const rows = stmt("SELECT * FROM leads WHERE status = ? ORDER BY created_at DESC")
    .all(status) as LeadRecord[];

  return rows.map(normalizeLeadRow);
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
  const entries = Object.entries(fields).filter(
    ([key]) => key !== "updated_at",
  );
  if (entries.length === 0) return getLead(id);

  for (const [key] of entries) {
    if (!UPDATE_ALLOWED_COLUMNS.has(key)) {
      throw new Error(`updateLead: invalid column "${key}"`);
    }
  }

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

  // Dynamic SQL — bypass stmt cache (columns vary per call)
  const row = initDb()
    .prepare(`UPDATE leads SET ${setClauses.join(", ")} WHERE id = @id RETURNING *`)
    .get(params) as LeadRecord | undefined;

  return row ? normalizeLeadRow(row) : undefined;
}

/** Atomically set status to 'sending' if currently approvable. Returns true if claimed. */
export function claimLeadForSending(id: number): boolean {
  const result = stmt(
    "UPDATE leads SET status = 'sending', updated_at = @updated_at WHERE id = @id AND status IN ('received', 'sent')",
  ).run({ id, updated_at: new Date().toISOString() });
  return result.changes > 0;
}

// --- Idempotency (processed_emails) ---

export function isEmailProcessed(externalId: string): boolean {
  const row = stmt("SELECT 1 FROM processed_emails WHERE external_id = ?")
    .get(externalId);
  return row !== undefined;
}

export function markEmailProcessed(externalId: string, platform: string): void {
  stmt("INSERT OR IGNORE INTO processed_emails (external_id, platform) VALUES (?, ?)")
    .run(externalId, platform);
}

// --- Transaction helper ---

type NotPromise<T> = T extends Promise<any> ? never : T;

/**
 * Wraps db.transaction(). Callback MUST be synchronous.
 * @see docs/solutions/database-issues/async-sqlite-transaction-boundary.md
 */
export function runTransaction<T>(fn: () => NotPromise<T>): T {
  // Layer 2: Pre-execution — catches async-declared functions (not .bind()'d)
  if (types.isAsyncFunction(fn)) {
    throw new Error(
      "runTransaction: callback must be synchronous. " +
      "See docs/solutions/database-issues/async-sqlite-transaction-boundary.md",
    );
  }

  // Layer 3: Post-execution — catches .bind()'d async and sync-returning-Promise
  const wrappedFn = () => {
    const result = fn();
    if (result != null && typeof (result as any).then === "function") {
      throw new Error(
        "runTransaction: callback returned a Promise. " +
        "Transaction already committed. Use only synchronous operations. " +
        "See docs/solutions/database-issues/async-sqlite-transaction-boundary.md",
      );
    }
    return result;
  };

  return initDb().transaction(wrappedFn as () => T)();
}

// --- Outcome tracking ---

/**
 * Set or clear a lead's outcome. Handles sub-field cleanup automatically.
 *
 * CALLER CONTRACT: When outcome !== null, the caller MUST also call
 * skipFollowUp(id) to freeze the follow-up pipeline. Without this,
 * the scheduler can increment follow_up_count after outcome recording,
 * silently corrupting follow-up effectiveness analytics.
 */
export function setLeadOutcome(
  id: number,
  outcome: LeadOutcome | null,
  options?: { outcome_reason?: LossReason; actual_price?: number },
): LeadRecord | undefined {
  const lead = getLead(id);
  if (!lead || lead.status !== "done") return undefined;

  if (options?.actual_price != null && (!Number.isFinite(options.actual_price) || options.actual_price <= 0)) {
    return undefined;
  }

  const fields: Partial<Omit<LeadRecord, "id" | "created_at">> = {
    outcome,
    outcome_at: outcome !== null ? new Date().toISOString() : null,
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
