import type { OAuth2Client } from "google-auth-library";
import type { AutomationConfig } from "./config.js";
import type { GmailMessage } from "./gmail-watcher.js";
import type { ParsedLead, YelpLead, SendResult } from "./types.js";
import { validateSource } from "./source-validator.js";
import { isProcessed, markProcessed } from "./dedup.js";
import { parseLeadEmail } from "./parsers/index.js";
import { routeLead } from "./router.js";
import { logLead } from "./logger.js";
import { sendSmsSafe as sendSms } from "../sms.js";
import { sendSquarespaceReply } from "./senders/gmail-sender.js";
import { runPipeline } from "../run-pipeline.js";
import { insertLead, updateLead } from "../db/leads.js";
import { YelpPortalClient } from "./portals/yelp-client.js";
import { GigSaladPortalClient } from "./portals/gigsalad-client.js";

/**
 * Process a single Gmail message through the full automation pipeline:
 *
 * 1. Validate source (exact allowlist + SPF/DKIM)
 * 2. Dedup check
 * 3. Parse email → ParsedLead
 * 4. Yelp enrichment (if Yelp — read full message from portal)
 * 5. Run pipeline (skip if low confidence → hold)
 * 6. Route (auto-send or hold)
 * 7. Send reply or SMS notification
 * 8. Log + mark processed
 */
export async function processLead(
  msg: GmailMessage,
  config: AutomationConfig,
  auth: OAuth2Client,
  yelpClient: YelpPortalClient,
  gigsaladClient: GigSaladPortalClient
): Promise<void> {
  const startTime = Date.now();

  // 1. Validate source
  const validation = validateSource(msg.from, msg.authenticationResults);
  if (!validation.valid) {
    console.log(`Skipping email from ${msg.from}: ${validation.reason}`);
    return;
  }
  const platform = validation.platform!;

  // 2. Dedup
  if (isProcessed(msg.id)) {
    console.log(`Skipping already-processed message: ${msg.id}`);
    return;
  }

  console.log(`\nProcessing ${platform} lead (message: ${msg.id})`);

  // 3. Parse
  let lead: ParsedLead = parseLeadEmail(msg, platform);

  // 3b. Persist to SQLite (so lead appears on dashboard immediately)
  const dbLead = insertLead({
    raw_email: lead.rawText,
    source_platform: platform,
    mailgun_message_id: msg.id,
    client_name: lead.clientName ?? null,
    event_date: lead.eventDate ?? null,
  });
  const leadId = dbLead.id;

  // 4. Yelp enrichment — read full message from portal
  if (lead.platform === "yelp" && !lead.enriched) {
    console.log("Yelp lead detected — enriching via portal...");
    const details = await yelpClient.fetchLeadDetails(lead.portalUrl);
    if (details.success) {
      (lead as YelpLead).rawText = details.fullMessage;
      (lead as YelpLead).enriched = true;
      (lead as YelpLead).parseConfidence = "high";
      if (details.clientName) lead.clientName = details.clientName;
      console.log("Yelp enrichment succeeded — full message retrieved");
    } else {
      console.warn(`Yelp enrichment failed: ${details.error}`);
      // Confidence stays "low" → router will hold
    }
  }

  // 5. Low confidence → skip pipeline, hold immediately
  if (lead.parseConfidence === "low") {
    const holdMsg = `HOLD: Lead #${leadId} ${platform} — low parse confidence. Check dashboard.`;
    updateLead(leadId, { status: "failed", error_message: "Low parse confidence — held for review" });
    if (!config.dryRun) {
      await sendSms(config, holdMsg);
    } else {
      console.log(`[DRY-RUN] ${holdMsg}`);
    }
    logLead({
      timestamp: new Date().toISOString(),
      gmailMessageId: msg.id,
      platform,
      parseConfidence: lead.parseConfidence,
      edgeCase: true,
      edgeCaseReasons: ["Low parse confidence"],
      status: config.dryRun ? "dry-run" : "held",
      durationMs: Date.now() - startTime,
    });
    markProcessed(msg.id);
    return;
  }

  // 6. Run pipeline
  console.log("Running pipeline...");
  let output;
  try {
    output = await runPipeline(lead.rawText);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`Pipeline failed: ${error}`);
    updateLead(leadId, { status: "failed", error_message: error, pipeline_completed_at: new Date().toISOString() });
    if (!config.dryRun) {
      await sendSms(config, `FAIL: Lead #${leadId} ${platform} — pipeline error. Check dashboard.`);
    }
    logLead({
      timestamp: new Date().toISOString(),
      gmailMessageId: msg.id,
      platform,
      parseConfidence: lead.parseConfidence,
      edgeCase: false,
      status: config.dryRun ? "dry-run" : "failed",
      error,
      durationMs: Date.now() - startTime,
    });
    markProcessed(msg.id);
    return;
  }

  // 6b. Save pipeline results to DB
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
    client_name: output.classification.client_first_name ?? undefined,
    venue: output.classification.venue_name ?? undefined,
    event_type: output.classification.format_requested ?? undefined,
    event_date: output.classification.event_date_iso ?? undefined,
  });

  // 7. Route
  const result = routeLead(lead, output, config.edgeCaseBudgetThreshold);

  if (result.action === "hold") {
    const reasonSummary = result.reasons.slice(0, 2).join("; ");
    const holdMsg = `HOLD: Lead #${leadId} ${platform} — ${reasonSummary}. Check dashboard.`;
    updateLead(leadId, { status: "sent" });
    if (!config.dryRun) {
      await sendSms(config, holdMsg);
    } else {
      console.log(`[DRY-RUN] ${holdMsg}`);
    }
    logLead({
      timestamp: new Date().toISOString(),
      gmailMessageId: msg.id,
      platform,
      parseConfidence: lead.parseConfidence,
      classification: output.classification.format_recommended,
      quotePrice: output.pricing.quote_price,
      edgeCase: true,
      edgeCaseReasons: result.reasons,
      status: config.dryRun ? "dry-run" : "held",
      durationMs: Date.now() - startTime,
    });
    markProcessed(msg.id);
    return;
  }

  // 8. Auto-send
  const replyText = output.drafts.compressed_draft;
  let sendResult: SendResult;

  if (config.dryRun) {
    console.log(`[DRY-RUN] Would auto-send ${platform} reply:\n${replyText.slice(0, 200)}...`);
    sendResult = { status: "sent", platform, timestamp: new Date() };
  } else {
    sendResult = await dispatchReply(lead, replyText, auth, config, yelpClient, gigsaladClient);
  }

  logLead({
    timestamp: new Date().toISOString(),
    gmailMessageId: msg.id,
    platform,
    parseConfidence: lead.parseConfidence,
    classification: output.classification.format_recommended,
    quotePrice: output.pricing.quote_price,
    edgeCase: false,
    status: config.dryRun ? "dry-run" : sendResult.status,
    error: sendResult.status === "failed" ? sendResult.error : undefined,
    durationMs: Date.now() - startTime,
  });

  // Update DB with send result
  if (sendResult.status === "sent") {
    updateLead(leadId, { status: "done", done_reason: `auto-sent via ${platform}`, sms_sent_at: new Date().toISOString() });
  } else if (sendResult.status === "failed" && !config.dryRun) {
    updateLead(leadId, { status: "failed", error_message: `Reply send failed: ${sendResult.error}` });
    await sendSms(config, `FAIL: Lead #${leadId} ${platform} reply failed. Check dashboard.`);
  }

  markProcessed(msg.id);
}

/**
 * Dispatch a reply to the correct sender based on platform.
 */
async function dispatchReply(
  lead: ParsedLead,
  replyText: string,
  auth: OAuth2Client,
  config: AutomationConfig,
  yelpClient: YelpPortalClient,
  gigsaladClient: GigSaladPortalClient
): Promise<SendResult> {
  switch (lead.platform) {
    case "squarespace":
      return sendSquarespaceReply(auth, lead, replyText);

    case "gigsalad": {
      const result = await gigsaladClient.submitReply(lead.portalUrl, replyText);
      if (result.success) {
        return { status: "sent", platform: "gigsalad", timestamp: new Date() };
      }
      return { status: "failed", platform: "gigsalad", error: result.error || "Unknown", timestamp: new Date() };
    }

    case "yelp": {
      const result = await yelpClient.submitReply(lead.portalUrl, replyText);
      if (result.success) {
        return { status: "sent", platform: "yelp", timestamp: new Date() };
      }
      return { status: "failed", platform: "yelp", error: result.error || "Unknown", timestamp: new Date() };
    }
  }
}
