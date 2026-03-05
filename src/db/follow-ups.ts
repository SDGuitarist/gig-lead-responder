// Allowed imports: ./migrate.js, ./leads.js, ../types.js only
// NEVER import from ./index.js (circular dependency risk)

import type { LeadRecord } from "../types.js";
import { getLead, updateLead, runTransaction, normalizeLeadRow } from "./leads.js";
import { stmt } from "./stmt-cache.js";

/*
 * Follow-up state machine (5 states, 8 transitions):
 *
 *   NULL --completeApproval()--> pending
 *   pending --scheduler--> sent        (draft generated, SMS sent to Alex)
 *   pending --SKIP--> skipped          (cancel all follow-ups)
 *   pending --REPLIED--> replied       (client responded)
 *   sent --SEND--> pending             (count++, schedule next if count < 3)
 *   sent --SEND--> exhausted           (count reaches 3, terminal)
 *   sent --SKIP--> skipped             (cancel all follow-ups)
 *   sent --REPLIED--> replied          (client responded)
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
  const rows = stmt(
    "SELECT * FROM leads WHERE follow_up_status = 'pending' AND follow_up_due_at <= datetime('now') ORDER BY follow_up_due_at ASC LIMIT 10",
  ).all() as LeadRecord[];
  return rows.map(normalizeLeadRow);
}

/** Get the most recent lead awaiting follow-up approval (status = 'sent'). */
export function getLeadAwaitingFollowUp(): LeadRecord | undefined {
  const row = stmt("SELECT * FROM leads WHERE follow_up_status = 'sent' ORDER BY updated_at DESC LIMIT 1")
    .get() as LeadRecord | undefined;
  return row ? normalizeLeadRow(row) : undefined;
}

/** Get the most recent lead with an active follow-up (pending or sent). */
export function getLeadWithActiveFollowUp(): LeadRecord | undefined {
  const row = stmt("SELECT * FROM leads WHERE follow_up_status IN ('pending', 'sent') ORDER BY updated_at DESC LIMIT 1")
    .get() as LeadRecord | undefined;
  return row ? normalizeLeadRow(row) : undefined;
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
    const result = stmt(
      "UPDATE leads SET follow_up_status = 'pending', updated_at = @now " +
      "WHERE id = @id AND follow_up_status = 'sent'",
    ).run({ id: leadId, now });

    if (result.changes === 0) return undefined;

    const lead = getLead(leadId);
    if (!lead) return undefined;

    const newCount = lead.follow_up_count + 1;

    if (newCount >= MAX_FOLLOW_UPS) {
      return updateLead(leadId, {
        follow_up_status: "exhausted",
        follow_up_count: newCount,
        ...TERMINAL_CLEAR,
      });
    }

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
 * Store a follow-up draft, guarded by follow_up_status = 'sent'.
 * Returns true if the draft was stored, false if the status changed during generation.
 */
export function storeFollowUpDraft(leadId: number, draft: string): boolean {
  const result = stmt("UPDATE leads SET follow_up_draft = @draft, updated_at = @now WHERE id = @id AND follow_up_status = 'sent'")
    .run({ id: leadId, draft, now: new Date().toISOString() });
  return result.changes > 0;
}

/**
 * Skip all remaining follow-ups. Atomically claims from pending or sent.
 * Returns updated lead or undefined if claim failed.
 */
export function skipFollowUp(leadId: number): LeadRecord | undefined {
  const now = new Date().toISOString();
  const row = stmt(
    "UPDATE leads SET follow_up_status = 'skipped', " +
    "follow_up_due_at = NULL, follow_up_draft = NULL, snoozed_until = NULL, " +
    "updated_at = @now " +
    "WHERE id = @id AND follow_up_status IN ('pending', 'sent') RETURNING *",
  ).get({ id: leadId, now }) as LeadRecord | undefined;

  return row ? normalizeLeadRow(row) : undefined;
}

/**
 * Snooze a follow-up. Sets snoozed_until AND due_at atomically, clears draft,
 * transitions to pending. Returns updated lead or undefined if claim failed.
 */
export function snoozeFollowUp(leadId: number, until: string): LeadRecord | undefined {
  const now = new Date().toISOString();
  const row = stmt(
    "UPDATE leads SET follow_up_status = 'pending', " +
    "snoozed_until = @until, follow_up_due_at = @until, follow_up_draft = NULL, " +
    "updated_at = @now " +
    "WHERE id = @id AND follow_up_status IN ('sent', 'pending') RETURNING *",
  ).get({ id: leadId, until, now }) as LeadRecord | undefined;

  return row ? normalizeLeadRow(row) : undefined;
}

/**
 * Mark that the client replied. Terminal state — clears all follow-up fields.
 * Returns updated lead or undefined if claim failed.
 */
export function markClientReplied(leadId: number): LeadRecord | undefined {
  const now = new Date().toISOString();
  const row = stmt(
    "UPDATE leads SET follow_up_status = 'replied', " +
    "follow_up_due_at = NULL, follow_up_draft = NULL, snoozed_until = NULL, " +
    "updated_at = @now " +
    "WHERE id = @id AND follow_up_status IN ('pending', 'sent') RETURNING *",
  ).get({ id: leadId, now }) as LeadRecord | undefined;

  return row ? normalizeLeadRow(row) : undefined;
}

/**
 * Scheduler's atomic claim: pending -> sent. Includes snoozed_until guard so
 * snoozed leads aren't processed. Returns true if claimed.
 */
export function claimFollowUpForSending(leadId: number): boolean {
  const now = new Date().toISOString();
  const result = stmt(
    "UPDATE leads SET follow_up_status = 'sent', updated_at = @now " +
    "WHERE id = @id AND follow_up_status = 'pending' " +
    "AND (snoozed_until IS NULL OR snoozed_until <= datetime('now'))",
  ).run({ id: leadId, now });

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
