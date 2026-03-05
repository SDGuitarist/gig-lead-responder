import { getLead, updateLead } from "./db/index.js";
import { stmt } from "./db/stmt-cache.js";
import { normalizeLeadRow } from "./db/leads.js";
import { sendSms } from "./sms.js";
import type { LeadRecord, PipelineOutput } from "./types.js";

/**
 * Handle successful pipeline completion:
 * 1. Save pipeline results to DB (drafts survive even if SMS fails)
 * 2. Build and send SMS
 * 3. Mark status="sent" with sms_sent_at
 */
export async function postPipeline(
  leadId: number,
  output: PipelineOutput,
): Promise<void> {
  // Step 1 — Save pipeline results immediately (status stays "received")
  const now = new Date().toISOString();
  updateLead(leadId, {
    classification_json: JSON.stringify(output.classification),
    pricing_json: JSON.stringify(output.pricing),
    full_draft: output.drafts.full_draft,
    compressed_draft: output.drafts.compressed_draft,
    gate_passed: output.gate.gate_status === "pass",
    gate_json: JSON.stringify(output.gate),
    confidence_score: output.confidence_score,
    pipeline_completed_at: now,
  });

  // Step 2 — Build and send SMS
  const lead = getLead(leadId);
  if (!lead) {
    throw new Error(`Lead #${leadId} not found`);
  }

  const lines: string[] = [];
  lines.push(`Lead #${leadId} — ${lead.event_type || "Unknown event"} on ${lead.event_date || "TBD"}`);
  if (lead.venue) {
    lines.push(lead.venue);
  }
  lines.push("");
  lines.push(output.drafts.compressed_draft);
  lines.push("");
  lines.push("Reply YES to send, or send edits.");

  await sendSms(lines.join("\n"));

  // Step 3 — Mark sent (only reached if SMS succeeded)
  updateLead(leadId, {
    status: "sent",
    sms_sent_at: new Date().toISOString(),
  });

  console.log(`Lead #${leadId}: draft sent via SMS (confidence: ${output.confidence_score})`);
}

/**
 * Handle pipeline failure:
 * 1. Mark lead as "failed" with error message
 * 2. Send review alert via SMS
 */
export async function postPipelineError(
  leadId: number,
  err: unknown,
): Promise<void> {
  const message = err instanceof Error ? err.message : String(err);
  const now = new Date().toISOString();

  // Step 1 — Mark failed in DB
  updateLead(leadId, {
    status: "failed",
    error_message: message,
    done_reason: "pipeline_error",
    pipeline_completed_at: now,
  });

  // Step 2 — Send alert SMS
  const truncated = message.length > 100 ? message.slice(0, 100) + "…" : message;
  const smsBody = [
    `Lead #${leadId} — REVIEW NEEDED`,
    `Pipeline failed: ${truncated}`,
    "Check dashboard for details.",
  ].join("\n");

  await sendSms(smsBody);

  console.error(`Lead #${leadId}: pipeline failed — ${message}`);
}

/**
 * Startup recovery: find leads stuck in "received" with pipeline results
 * (pipeline_completed_at set but status never advanced to "sent").
 * Re-attempts the SMS + status transition.
 */
export async function recoverStuckLeads(): Promise<void> {
  const rows = stmt(
    "SELECT * FROM leads WHERE status = 'received' AND pipeline_completed_at IS NOT NULL",
  ).all() as LeadRecord[];

  if (rows.length === 0) return;

  console.log(`Recovery: found ${rows.length} stuck lead(s) — re-attempting SMS...`);

  for (const row of rows) {
    const lead = normalizeLeadRow(row);
    try {
      const lines: string[] = [];
      lines.push(`Lead #${lead.id} — ${lead.event_type || "Unknown event"} on ${lead.event_date || "TBD"}`);
      if (lead.venue) lines.push(lead.venue);
      lines.push("");
      lines.push(lead.compressed_draft || "(no draft)");
      lines.push("");
      lines.push("Reply YES to send, or send edits.");

      await sendSms(lines.join("\n"));

      updateLead(lead.id, {
        status: "sent",
        sms_sent_at: new Date().toISOString(),
      });
      console.log(`Recovery: Lead #${lead.id} — SMS sent, status updated to "sent"`);
    } catch (err) {
      console.error(`Recovery: Lead #${lead.id} — SMS retry failed:`, err);
    }
  }
}
