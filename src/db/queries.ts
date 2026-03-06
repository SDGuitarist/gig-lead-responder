// Allowed imports: ./migrate.js, ./leads.js, ../types.js only
// NEVER import from ./index.js (circular dependency risk)

import type Database from "better-sqlite3";
import type { LeadRecord, LeadStatus, LeadOutcome, AnalyticsResponse, BookingCycleEntry, MonthlyTrendEntry, RevenueByTypeEntry, FollowUpEffectivenessEntry, LossReasonEntry, LossReason } from "../types.js";
import { LOSS_REASONS } from "../types.js";
import { initDb } from "./migrate.js";
import { normalizeLeadRow, setLeadOutcome } from "./leads.js";
import { skipFollowUp } from "./follow-ups.js";

/** Fill missing months between first and last in a DESC-sorted trends array. Returns chronological order. */
function fillMonthlyGaps(rows: Array<{ month: string; received: number; booked: number }>): Array<{ month: string; received: number; booked: number }> {
  if (rows.length <= 1) return [...rows].reverse();
  const byMonth = new Map(rows.map((r) => [r.month, r]));
  const last = rows[0].month; // most recent (DESC order)
  const first = rows[rows.length - 1].month; // oldest
  const filled: Array<{ month: string; received: number; booked: number }> = [];
  let [y, m] = first.split("-").map(Number);
  const [endY, endM] = last.split("-").map(Number);
  const MAX_MONTHS = 120;
  let iterations = 0;
  while ((y < endY || (y === endY && m <= endM)) && iterations++ < MAX_MONTHS) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    filled.push(byMonth.get(key) ?? { month: key, received: 0, booked: 0 });
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return filled;
}

// stmt() pattern also in leads.ts, follow-ups.ts — keep in sync
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

    // Query 4: Booking Cycle Time by source platform
    const bookingCycle = stmt(`
      SELECT source_platform,
        COALESCE(AVG(julianday(outcome_at) - julianday(created_at)), 0) AS avg_days,
        COUNT(*) AS sample_size
      FROM leads
      WHERE status = 'done' AND outcome = 'booked' AND outcome_at IS NOT NULL
      GROUP BY source_platform
    `).all() as Array<{ source_platform: string | null; avg_days: number; sample_size: number }>;

    // Query 5: Monthly Trends (last 12 months)
    // Intentionally no status filter on received: counts total incoming volume
    const monthlyTrends = stmt(`
      SELECT strftime('%Y-%m', created_at) AS month,
        COUNT(*) AS received,
        SUM(CASE WHEN status = 'done' AND outcome = 'booked' THEN 1 ELSE 0 END) AS booked
      FROM leads
      GROUP BY month
      ORDER BY month DESC
      LIMIT 12
    `).all() as Array<{ month: string; received: number; booked: number }>;

    // Query 6: Revenue by Event Type
    // LOWER(TRIM()) kept for legacy rows inserted before insertLead() normalization
    const revenueByType = stmt(`
      SELECT LOWER(TRIM(event_type)) AS event_type,
        COALESCE(total(actual_price), 0) AS revenue,
        COUNT(*) AS count,
        COALESCE(AVG(actual_price), 0) AS avg_price
      FROM leads
      WHERE status = 'done' AND outcome = 'booked' AND actual_price IS NOT NULL
        AND event_type IS NOT NULL
      GROUP BY LOWER(TRIM(event_type))
      ORDER BY revenue DESC
    `).all() as Array<{ event_type: string; revenue: number; count: number; avg_price: number }>;

    // Query 7: Follow-up Effectiveness
    const followUpEff = stmt(`
      SELECT follow_up_count,
        COUNT(*) AS total,
        COUNT(CASE WHEN outcome = 'booked' THEN 1 END) AS booked,
        COUNT(CASE WHEN outcome = 'lost' THEN 1 END) AS lost,
        COUNT(CASE WHEN outcome = 'no_reply' THEN 1 END) AS no_reply
      FROM leads
      WHERE status = 'done' AND outcome IS NOT NULL
      GROUP BY follow_up_count
      ORDER BY follow_up_count
    `).all() as Array<{ follow_up_count: number; total: number; booked: number; lost: number; no_reply: number }>;

    // Query 8: Loss Reasons
    const lossReasons = stmt(`
      SELECT COALESCE(outcome_reason, 'unspecified') AS reason,
        COUNT(*) AS count
      FROM leads
      WHERE status = 'done' AND outcome = 'lost'
      GROUP BY reason
      ORDER BY count DESC
    `).all() as Array<{ reason: string; count: number }>;

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
      booking_cycle: bookingCycle.map((r): BookingCycleEntry => ({
        source_platform: r.source_platform ?? "unknown",
        avg_days: r.avg_days ?? 0,
        sample_size: r.sample_size,
      })),
      monthly_trends: fillMonthlyGaps(monthlyTrends).map((r): MonthlyTrendEntry => ({
        month: r.month,
        received: r.received ?? 0,
        booked: r.booked ?? 0,
      })),
      revenue_by_type: revenueByType.map((r): RevenueByTypeEntry => ({
        event_type: r.event_type,
        revenue: r.revenue ?? 0,
        count: r.count,
        avg_price: r.avg_price != null ? Math.round(r.avg_price) : 0,
      })),
      follow_up_effectiveness: followUpEff.map((r): FollowUpEffectivenessEntry => ({
        follow_up_count: r.follow_up_count,
        total: r.total,
        booked: r.booked,
        lost: r.lost,
        no_reply: r.no_reply,
      })),
      loss_reasons: lossReasons.map((r): LossReasonEntry => ({
        reason: LOSS_REASONS.includes(r.reason as LossReason)
          ? (r.reason as LossReason)
          : "unspecified",
        count: r.count,
      })),
    };
  })();
}

/**
 * Set outcome and freeze follow-up pipeline atomically.
 * Eliminates temporal coupling — callers cannot forget to skip follow-ups.
 */
export function setLeadOutcomeAndFreeze(
  id: number,
  outcome: LeadOutcome | null,
  options?: { outcome_reason?: LossReason; actual_price?: number },
): LeadRecord | undefined {
  const db = initDb();
  return db.transaction(() => {
    const updated = setLeadOutcome(id, outcome, options);
    if (updated && outcome !== null) skipFollowUp(id);
    return updated;
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
