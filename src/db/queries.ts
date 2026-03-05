// Allowed imports: ./migrate.js, ./leads.js, ../types.js only
// NEVER import from ./index.js (circular dependency risk)

import type { LeadRecord, LeadStatus, AnalyticsResponse } from "../types.js";
import { initDb } from "./migrate.js";
import { normalizeLeadRow } from "./leads.js";
import { stmt } from "./stmt-cache.js";

// --- Dashboard queries ---

export interface ListLeadsFilteredOpts {
  status?: LeadStatus;
  sort?: "date" | "score" | "event";
  limit?: number;
  offset?: number;
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

  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;
  sql += " LIMIT @limit OFFSET @offset";
  params.limit = limit;
  params.offset = offset;

  // Dynamic SQL — bypass stmt cache (same pattern as updateLead)
  const rows = initDb().prepare(sql).all(params) as LeadRecord[];

  return rows.map(normalizeLeadRow);
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
  const rows = stmt(sql).all() as LeadRecord[];
  return rows.map(normalizeLeadRow);
}

export interface LeadStats {
  pending: number;
  sent: number;
  avg_score: number | null;
  this_month: number;
}

/** Analytics for the Insights tab. 3 queries in a read-only transaction. */
export function getAnalytics(): AnalyticsResponse {
  const db = initDb();
  return db.transaction(() => {
    // Query 1: Core counts + revenue + avg prices
    const core = stmt(`
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
    const byPlatform = stmt(`
      SELECT source_platform AS label, COUNT(*) AS total,
        SUM(CASE WHEN outcome = 'booked' THEN 1 ELSE 0 END) AS booked
      FROM leads WHERE status = 'done' AND outcome IS NOT NULL
      GROUP BY source_platform
    `).all() as Array<{ label: string; total: number; booked: number }>;

    // Query 3: By format (from classification_json)
    const byFormat = stmt(`
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

  const row = stmt(
    `SELECT
      SUM(CASE WHEN status = 'received' THEN 1 ELSE 0 END) AS pending,
      SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS sent,
      AVG(CASE WHEN confidence_score IS NOT NULL THEN confidence_score END) AS avg_score,
      SUM(CASE WHEN created_at >= @firstOfMonth THEN 1 ELSE 0 END) AS this_month
    FROM leads`,
  ).get({ firstOfMonth }) as {
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
