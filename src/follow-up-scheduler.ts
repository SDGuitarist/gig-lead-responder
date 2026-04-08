import { getLeadsDueForFollowUp, updateLead, claimFollowUpForSending, storeFollowUpDraft } from "./db/index.js";
import { generateFollowUpDraft } from "./pipeline/follow-up-generate.js";
import { sendSms } from "./sms.js";
import type { LeadRecord } from "./types.js";
import { baseUrl } from "./utils/helpers.js";

const INTERVAL_MS = 15 * 60 * 1_000; // 15 minutes
const MAX_SCHEDULER_RETRIES = 3;
let schedulerHandle: ReturnType<typeof setTimeout> | null = null;
const retryFailures = new Map<number, number>(); // leadId → consecutive failure count
const RETRY_MAP_CAP = 50; // safety valve against unbounded growth

/**
 * Format the follow-up notification SMS.
 * V2: points to dashboard instead of including full draft text.
 */
function formatFollowUpNotification(lead: LeadRecord): string {
  const num = lead.follow_up_count + 1;
  const parts: string[] = [];
  if (lead.client_name) parts.push(lead.client_name);
  if (lead.event_type) parts.push(`(${lead.event_type})`);
  const summary = parts.length > 0 ? parts.join(" ") : `Lead #${lead.id}`;

  return `Follow-up #${num} draft ready for ${summary}.\nReview: ${baseUrl()}/dashboard.html#follow-ups`;
}

/**
 * Process all leads due for follow-up. Sequential, LIMIT 10.
 * Per-lead error handling: if one fails, leave as pending and continue.
 */
async function checkDueFollowUps(): Promise<void> {
  if (retryFailures.size > RETRY_MAP_CAP) retryFailures.clear();

  const leads = getLeadsDueForFollowUp(); // LIMIT 10, ordered by due_at ASC
  if (leads.length === 0) return;

  console.log(`[scheduler] ${leads.length} lead(s) due for follow-up`);

  for (const lead of leads) {
    try {
      // 1. Atomic claim: pending → sent (includes snoozed_until guard)
      if (!claimFollowUpForSending(lead.id)) {
        console.warn(`[scheduler] lead #${lead.id} claim failed (snoozed or state changed)`);
        continue;
      }
      // 2. Reuse existing draft if available (SMS failed on prior attempt), else generate new one
      const draft = lead.follow_up_draft || await generateFollowUpDraft(lead);
      // 3. Store draft in DB only if still in 'sent' status (guards against user skip/reply race)
      if (!lead.follow_up_draft) {
        if (!storeFollowUpDraft(lead.id, draft)) {
          console.warn(`[scheduler] lead #${lead.id} status changed during draft generation — skipping`);
          continue;
        }
      }
      // 4. Send notification SMS pointing to dashboard
      await sendSms(formatFollowUpNotification(lead));
      retryFailures.delete(lead.id);
      console.log(`[scheduler] follow-up notification sent for lead #${lead.id}`);
    } catch (err) {
      const failures = (retryFailures.get(lead.id) || 0) + 1;
      retryFailures.set(lead.id, failures);
      console.error(`[scheduler] follow-up failed for lead #${lead.id} (attempt ${failures}/${MAX_SCHEDULER_RETRIES}):`, err);

      if (failures >= MAX_SCHEDULER_RETRIES) {
        updateLead(lead.id, { follow_up_status: "skipped", follow_up_due_at: null });
        retryFailures.delete(lead.id);
        await sendSms(`Follow-up for Lead #${lead.id} failed ${MAX_SCHEDULER_RETRIES} times — skipped. Check logs.`).catch(console.error);
      } else {
        // Revert to pending so the lead is retried on the next scheduler tick
        updateLead(lead.id, { follow_up_status: "pending" });
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
