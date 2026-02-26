import twilio from "twilio";
import { Router } from "express";
import type { Request, Response } from "express";
import { getLead, getLeadsByStatus, updateLead, completeApproval } from "./leads.js";
import { sendSms } from "./sms.js";
import { runEditPipeline } from "./run-pipeline.js";
import type { Classification, LeadRecord, PricingResult } from "./types.js";

const router = Router();

// YES, Y, APPROVE, OK — optionally followed by - or space + integer lead ID
const APPROVAL_PATTERN = /^(yes|y|approve|ok)(?:[-\s](\d+))?$/i;

// Edit with ID prefix: #42 or 42: followed by instructions
const EDIT_ID_PATTERN = /^#?(\d+)[:\s]\s*([\s\S]+)/;

const MAX_EDIT_ROUNDS = 3;

// --- Helpers ---

/** Strip trailing slashes from BASE_URL. */
function baseUrl(): string {
  return (process.env.BASE_URL || "").replace(/\/+$/, "");
}

/** Send empty TwiML response (Twilio requires XML). */
function emptyTwiml(res: Response): void {
  res.type("text/xml").send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
}

/** Validate Twilio webhook signature using X-Twilio-Signature header.
 *  Set DISABLE_TWILIO_VALIDATION=true to bypass (debug URL mismatches only). */
function verifyTwilioSignature(req: Request): boolean {
  if (process.env.DISABLE_TWILIO_VALIDATION === "true") {
    console.warn("⚠ Twilio signature validation disabled via DISABLE_TWILIO_VALIDATION");
    return true;
  }

  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const base = process.env.BASE_URL;
  if (!authToken || !base) {
    console.error("TWILIO_AUTH_TOKEN and BASE_URL must be set for Twilio signature validation");
    return false;
  }

  const signature = req.headers["x-twilio-signature"] as string | undefined;
  if (!signature) return false;

  const url = base.replace(/\/+$/, "") + "/webhook/twilio";
  return twilio.validateRequest(authToken, signature, url, req.body);
}

type ResolveResult = { ok: true; lead: LeadRecord } | { ok: false; error: string };

/**
 * Resolve lead by explicit ID or fall back to most recent "sent" lead.
 * Returns the lead or an error message string.
 */
function resolveLead(leadId: number | null): ResolveResult {
  if (leadId !== null) {
    const lead = getLead(leadId);
    if (!lead) return { ok: false, error: `Lead #${leadId} not found.` };
    if (lead.status !== "sent") return { ok: false, error: `Lead #${leadId} is not pending (status: ${lead.status}).` };
    return { ok: true, lead };
  }

  // No explicit ID — fall back to most recent "sent" lead
  const sentLeads = getLeadsByStatus("sent");

  if (sentLeads.length === 0) {
    return { ok: false, error: `No pending leads. Check dashboard at ${baseUrl()}/leads` };
  }
  if (sentLeads.length > 1) {
    const ids = sentLeads.map((l) => `#${l.id}`).join(", ");
    return { ok: false, error: `Multiple leads pending: ${ids}. Reply with ID, e.g. YES-${sentLeads[0].id}` };
  }

  return { ok: true, lead: sentLeads[0] };
}

// --- Handlers ---

/** Handle YES/approve reply: mark done, send confirmation with dashboard link. */
async function handleApproval(leadId: number | null): Promise<void> {
  const result = resolveLead(leadId);
  if (!result.ok) {
    await sendSms(result.error);
    return;
  }

  const lead = result.lead;

  // Mark done + schedule first follow-up atomically
  completeApproval(lead.id, "approved");

  await sendSms(`Lead #${lead.id} approved! Full draft: ${baseUrl()}/leads/${lead.id}`);
  console.log(`Lead #${lead.id}: approved via SMS`);
}

/**
 * Handle edit instructions: re-run generate + verify only, send new draft.
 * Classification and pricing are reused from the original pipeline run.
 */
async function handleEdit(leadId: number | null, instructions: string): Promise<void> {
  const result = resolveLead(leadId);
  if (!result.ok) {
    await sendSms(result.error);
    return;
  }

  const lead = result.lead;

  // Check max edit rounds
  if (lead.edit_round >= MAX_EDIT_ROUNDS) {
    updateLead(lead.id, {
      status: "failed",
      done_reason: "max_edits",
    });
    await sendSms(
      `Max revisions reached for lead #${lead.id}. Full draft on dashboard: ${baseUrl()}/leads/${lead.id}`,
    );
    return;
  }

  // Need stored classification + pricing to re-generate
  if (!lead.classification_json || !lead.pricing_json) {
    await sendSms(`Lead #${lead.id} has no classification data. Cannot edit.`);
    return;
  }

  const classification: Classification = JSON.parse(lead.classification_json);
  // Re-stamp platform from DB (not stored in classification JSON)
  classification.platform = (lead.source_platform as Classification["platform"]) ?? undefined;
  const pricing: PricingResult = JSON.parse(lead.pricing_json);

  // Re-run context → generate (with instructions) → verify
  const { drafts, gate } = await runEditPipeline(classification, pricing, instructions);

  // Update lead with new drafts
  const newRound = lead.edit_round + 1;
  updateLead(lead.id, {
    full_draft: drafts.full_draft,
    compressed_draft: drafts.compressed_draft,
    gate_passed: gate.gate_status === "pass",
    gate_json: JSON.stringify(gate),
    edit_round: newRound,
    edit_instructions: instructions,
  });

  // Send new draft via SMS
  const lines: string[] = [];
  lines.push(`Lead #${lead.id} -- Edit ${newRound}/${MAX_EDIT_ROUNDS}`);
  lines.push("");
  lines.push(drafts.compressed_draft);
  lines.push("");
  lines.push("Reply YES to send, or send more edits.");
  await sendSms(lines.join("\n"));

  console.log(`Lead #${lead.id}: edit round ${newRound} sent via SMS`);
}

// --- Route ---

router.post("/webhook/twilio", (req: Request, res: Response) => {
  // Signature validation
  if (!verifyTwilioSignature(req)) {
    console.warn("Twilio webhook signature validation failed");
    res.status(401).json({ error: "Invalid Twilio signature" });
    return;
  }

  const smsBody = ((req.body.Body as string) || "").trim();
  const from = (req.body.From as string) || "";

  // Only accept messages from Alex's phone
  if (from !== process.env.ALEX_PHONE) {
    console.warn(`Twilio webhook from unknown number: ${from}`);
    emptyTwiml(res);
    return;
  }

  if (!smsBody) {
    emptyTwiml(res);
    return;
  }

  // 1. Try approval pattern: YES, Y, APPROVE, OK with optional lead ID
  const approvalMatch = smsBody.match(APPROVAL_PATTERN);
  if (approvalMatch) {
    const leadId = approvalMatch[2] ? parseInt(approvalMatch[2], 10) : null;
    // Return TwiML immediately, process async
    emptyTwiml(res);
    handleApproval(leadId).catch((err) => {
      console.error("Approval handler error:", err);
      sendSms(`Error approving: ${err instanceof Error ? err.message : String(err)}`).catch(console.error);
    });
    return;
  }

  // 2. Try edit with ID prefix: #42 or 42: followed by instructions
  const editIdMatch = smsBody.match(EDIT_ID_PATTERN);
  if (editIdMatch) {
    const leadId = parseInt(editIdMatch[1], 10);
    const instructions = editIdMatch[2].trim();
    emptyTwiml(res);
    handleEdit(leadId, instructions).catch((err) => {
      console.error("Edit handler error:", err);
      sendSms(`Error editing lead #${leadId}: ${err instanceof Error ? err.message : String(err)}`).catch(console.error);
    });
    return;
  }

  // 3. Edit without ID — entire message is the edit instructions
  emptyTwiml(res);
  handleEdit(null, smsBody).catch((err) => {
    console.error("Edit handler error:", err);
    sendSms(`Error processing edit: ${err instanceof Error ? err.message : String(err)}`).catch(console.error);
  });
});

export default router;
