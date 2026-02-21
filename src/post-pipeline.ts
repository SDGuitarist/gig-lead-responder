import { getLead, updateLead } from "./leads.js";
import { sendSms } from "./sms.js";
import type { PipelineOutput } from "./types.js";

/**
 * Handle successful pipeline completion:
 * 1. Build SMS from existing lead fields + pipeline output
 * 2. Send SMS (must succeed before any DB write)
 * 3. Write all pipeline data + status="sent" in one atomic UPDATE
 */
export async function postPipeline(
  leadId: number,
  output: PipelineOutput,
): Promise<void> {
  // Step 1 — Build SMS body (uses fields set at insert time, no pipeline write needed)
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

  // Step 2 — Send SMS (must succeed before DB write)
  await sendSms(lines.join("\n"));

  // Step 3 — Write all pipeline data + status="sent" in one atomic UPDATE
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
    status: "sent",
    sms_sent_at: now,
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
