import { getLeadsDueForFollowUp, updateLead } from "./leads.js";
import { generateFollowUpDraft } from "./pipeline/follow-up-generate.js";
import { sendSms } from "./sms.js";
import type { LeadRecord } from "./types.js";

const INTERVAL_MS = 15 * 60 * 1_000; // 15 minutes
const MAX_SCHEDULER_RETRIES = 3;
let schedulerHandle: ReturnType<typeof setTimeout> | null = null;
const retryFailures = new Map<number, number>(); // leadId → consecutive failure count

/**
 * Format the follow-up SMS sent to Alex for approval.
 * Uses 📋 prefix to distinguish from initial draft SMS messages.
 */
function formatFollowUpSms(lead: LeadRecord, draft: string): string {
  const lines: string[] = [];
  const num = lead.follow_up_count + 1; // next follow-up number (1-indexed)
  lines.push(`📋 Follow-up #${num} for Lead #${lead.id}`);

  // One-line lead summary: event_type @ venue — event_date
  const parts: string[] = [];
  if (lead.event_type) parts.push(lead.event_type);
  if (lead.venue) parts.push(`@ ${lead.venue}`);
  if (lead.event_date) parts.push(`— ${lead.event_date}`);
  if (parts.length > 0) lines.push(parts.join(" "));

  lines.push("");
  lines.push(draft);
  lines.push("");
  lines.push("Reply SEND to send, SKIP to cancel all follow-ups.");
  return lines.join("\n");
}

/**
 * Process all leads due for follow-up. Sequential, LIMIT 10.
 * Per-lead error handling: if one fails, leave as pending and continue.
 */
async function checkDueFollowUps(): Promise<void> {
  const leads = getLeadsDueForFollowUp(); // LIMIT 10, ordered by due_at ASC
  if (leads.length === 0) return;

  console.log(`[scheduler] ${leads.length} lead(s) due for follow-up`);

  for (const lead of leads) {
    try {
      // 1. Reuse existing draft if available (SMS failed on prior attempt), else generate new one
      const draft = lead.follow_up_draft || await generateFollowUpDraft(lead);
      // 2. Store draft in DB (survives restarts)
      if (!lead.follow_up_draft) updateLead(lead.id, { follow_up_draft: draft });
      // 3. Send SMS to Alex for approval
      await sendSms(formatFollowUpSms(lead, draft));
      // 4. Mark as sent (waiting for SEND/SKIP from Alex)
      updateLead(lead.id, { follow_up_status: "sent" });
      retryFailures.delete(lead.id);
      console.log(`[scheduler] follow-up draft sent for lead #${lead.id}`);
    } catch (err) {
      const failures = (retryFailures.get(lead.id) || 0) + 1;
      retryFailures.set(lead.id, failures);
      console.error(`[scheduler] follow-up failed for lead #${lead.id} (attempt ${failures}/${MAX_SCHEDULER_RETRIES}):`, err);

      if (failures >= MAX_SCHEDULER_RETRIES) {
        updateLead(lead.id, { follow_up_status: "skipped", follow_up_due_at: null });
        retryFailures.delete(lead.id);
        await sendSms(`Follow-up for Lead #${lead.id} failed ${MAX_SCHEDULER_RETRIES} times — skipped. Check logs.`).catch(console.error);
      }
    }
  }
}

/**
 * Main scheduler loop. Runs immediately, then chains via setTimeout.
 * setTimeout (not setInterval) guarantees no overlap — if processing
 * takes longer than INTERVAL_MS, the next check simply starts later.
 */
async function schedulerLoop(): Promise<void> {
  if (process.env.DISABLE_FOLLOW_UPS === "true") {
    console.log("[scheduler] disabled via DISABLE_FOLLOW_UPS");
    schedulerHandle = setTimeout(schedulerLoop, INTERVAL_MS);
    return;
  }

  console.log("[scheduler] heartbeat");
  try {
    await checkDueFollowUps();
  } catch (err) {
    console.error("[scheduler] error:", err);
    await sendSms("Follow-up scheduler error. Check server logs.").catch(
      console.error,
    );
  }
  schedulerHandle = setTimeout(schedulerLoop, INTERVAL_MS);
}

/** Start the follow-up scheduler. Call once from server.ts inside app.listen(). */
export function startFollowUpScheduler(): void {
  console.log("[scheduler] started — checking every 15 minutes");
  schedulerLoop(); // run immediately on startup (catch up from downtime), then chain
}

/** Stop the scheduler. Call on SIGTERM for graceful shutdown. */
export function stopFollowUpScheduler(): void {
  if (schedulerHandle) {
    clearTimeout(schedulerHandle);
    schedulerHandle = null;
  }
}
