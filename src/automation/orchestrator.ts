import type { OAuth2Client } from "google-auth-library";
import type { AutomationConfig } from "./config.js";
import type { GmailMessage } from "./gmail-watcher.js";
import type { ParsedLead, YelpLead, SendResult } from "./types.js";
import { validateSource, incrementRejectedEmailCount } from "./source-validator.js";
import { isProcessed, markProcessed } from "./dedup.js";
import { parseLeadEmail } from "./parsers/index.js";
import { routeLead } from "./router.js";
import { logLead, type LeadLogEntry } from "./logger.js";
import { alertAlexSafe as sendSms } from "../alert.js";
import { sendSquarespaceReply } from "./senders/gmail-sender.js";
import { runPipeline } from "../run-pipeline.js";
import type { PipelineOutput } from "../types.js";
import { getLeadByMessageId, insertLead, updateLead } from "../db/leads.js";
import { completeApproval } from "../db/follow-ups.js";
import { YelpPortalClient } from "./portals/yelp-client.js";
import { GigSaladPortalClient } from "./portals/gigsalad-client.js";
import { enrichGigSaladLead, type GigSaladEnrichment } from "./portals/gigsalad-enrich.js";

/** One GigSalad lead's whole read (inboxes + page) gives up after this (login check Codex round 2). */
const GIGSALAD_LEAD_DEADLINE_MS = 90_000;

/** Written to error_message on a lead's first pipeline failure; a second failure is final. */
const PIPELINE_RETRY_MARK = "pipeline attempt 1 failed: ";

/**
 * Process a single Gmail message through the full automation pipeline:
 *
 * 1. Validate source (exact allowlist + DMARC for the platform domain)
 * 2. Dedup check
 * 3. Parse email → ParsedLead
 * 4. Yelp enrichment (if Yelp — read full message from portal); GigSalad enrichment
 *    (the email holds almost nothing — read the lead page in its own account)
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
  gigsaladClient: GigSaladPortalClient,
  deps: { runPipeline: typeof runPipeline; enrichGigSalad?: typeof enrichGigSaladLead; gigsaladDeadlineMs?: number } = { runPipeline },
): Promise<void> {
  const startTime = Date.now();

  // 1. Validate source (DMARC pass for the platform domain is mandatory)
  const validation = validateSource(
    msg.from,
    msg.authenticationResults,
    msg.subject,
    msg.bodyText || msg.bodyHtml
  );
  if (!validation.valid) {
    console.warn(`[source-validator] REJECTED ${msg.from}: ${validation.reason}`);
    incrementRejectedEmailCount();
    return;
  }
  const platform = validation.platform!;

  // 1b. Genuine mail, but a reply to an existing conversation rather than a new
  // lead. Yelp sends both from the same address, so this cannot be done by
  // sender. Do NOT count these as rejections — a reply is not a failure, and
  // conflating them is what hid the Yelp outage in the first place.
  // Consuming replies (auto-stop follow-ups) is roadmap #3, not wired up yet.
  if (validation.kind === "reply") {
    console.log(
      `[source-validator] REPLY from ${msg.from} on ${platform} — not a new lead, skipping lead pipeline`
    );
    return;
  }

  // 2. Dedup
  if (isProcessed(msg.id)) {
    console.log(`Skipping already-processed message: ${msg.id}`);
    return;
  }

  console.log(`\nProcessing ${platform} lead (message: ${msg.id})`);

  // 3. Parse
  let lead: ParsedLead = parseLeadEmail(msg, platform);

  // 3b. Persist to SQLite (so lead appears on dashboard immediately).
  // A retry after a mid-way failure finds the row it already made: resume it
  // if the pipeline never finished, otherwise don't redo it (no double send).
  const existing = getLeadByMessageId(msg.id);
  if (existing && (existing.status !== "received" || existing.pipeline_completed_at)) {
    console.warn(`Lead #${existing.id} for ${msg.id} already got past the pipeline; not redoing it`);
    markProcessed(msg.id);
    return;
  }
  if (existing) console.log(`Resuming half-done lead #${existing.id} for ${msg.id}`);
  const dbLead = existing ?? insertLead({
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

  // 4b. GigSalad enrichment — the email holds only a first name, event type and date; the
  // details are on the lead page (docs/research/2026-10-04-gigsalad-lead-page.md). The send
  // address (portalUrl) is deliberately NOT set: the old GigSalad reply path stays disarmed.
  if (lead.platform === "gigsalad") {
    lead.portalUrl = ""; // never a send address from a GigSalad email (see dispatchReply)
    // A whole GigSalad read (two inbox reads + the page) is capped, so a slow GigSalad cannot hold
    // the poller for minutes (login check Codex round 2). The browser jobs it leaves running are
    // bounded and killed by withGigSaladProfile; the lead is held.
    const deadlineMs = deps.gigsaladDeadlineMs ?? GIGSALAD_LEAD_DEADLINE_MS;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const gs = await Promise.race([
      (deps.enrichGigSalad ?? enrichGigSaladLead)(msg.bodyText || msg.bodyHtml),
      new Promise<GigSaladEnrichment>((r) => { timer = setTimeout(() => r({ status: "hold",
        reason: `GigSalad: reading the lead took longer than ${deadlineMs} ms; held (GigSalad slow or unreachable)` }), deadlineMs); }),
    ]).finally(() => clearTimeout(timer));
    if (gs.status === "enriched") {
      lead.rawText = gs.lead.rawText;
      lead.parseConfidence = "high";
      lead.parseWarnings = gs.lead.warnings;
      if (gs.lead.clientFirstName) lead.clientName = gs.lead.clientFirstName;
      if (gs.lead.eventDate) lead.eventDate = gs.lead.eventDate;
      console.log(`GigSalad enrichment succeeded (${gs.account} account)`);
      if (gs.notice) {
        console.warn(gs.notice);
        if (!config.dryRun) await sendSms(config, gs.notice);
      }
    } else {
      // A hold, or an email without GigSalad's new-lead sentence (real lead emails always have
      // it; Codex round 1, GigSalad, P1): never pipe the near-empty email text.
      const reason = gs.status === "hold" ? gs.reason
        : "GigSalad: email without the new-lead sentence (\"<name> would like a quote for ...\"); not a lead email GigSalad sends";
      lead.parseConfidence = "low";
      lead.parseWarnings = [...lead.parseWarnings, reason];
      console.warn(`GigSalad enrichment held the lead: ${reason}`);
    }
  }

  // 5. Low confidence → skip pipeline, hold immediately
  if (lead.parseConfidence === "low") {
    const why = lead.parseWarnings.length ? `: ${lead.parseWarnings.join("; ")}` : "";
    const holdMsg = `HOLD: Lead #${leadId} ${platform} — low parse confidence${why}. Check dashboard.`;
    updateLead(leadId, { status: "failed", error_message: `Low parse confidence — held for review${why}` });
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
    output = await deps.runPipeline(lead.rawText, undefined, platform);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    // Retry once, then hold (Alex 2026-10-04; Codex round 1, Phase 0 runtime). The first
    // failure stays retryable and rethrows, so the poller holds its cursor and comes back;
    // the mark on the row survives a restart, so a second failure is final.
    if (!existing?.error_message?.startsWith(PIPELINE_RETRY_MARK)) {
      updateLead(leadId, { error_message: PIPELINE_RETRY_MARK + error });
      console.error(`Pipeline failed on lead #${leadId}; it will be retried once: ${error}`);
      throw err;
    }
    console.error(`Pipeline failed again: ${error}`);
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
    strategic_reserve_json: JSON.stringify(output.drafts.strategic_reserve ?? []),
    confidence_score: output.confidence_score,
    pipeline_completed_at: now,
    // A retry that succeeded leaves no failure note on the lead.
    ...(existing?.error_message?.startsWith(PIPELINE_RETRY_MARK) ? { error_message: null } : {}),
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

  // 8. Auto-send (or review-only override)
  await handleAutoSendDecision({
    config,
    leadId,
    platform,
    msgId: msg.id,
    output,
    lead,
    startTime,
    auth,
    yelpClient,
    gigsaladClient,
  });

  markProcessed(msg.id);
}

/**
 * Dispatch a reply to the correct sender based on platform.
 */
export async function dispatchReply(
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

    case "gigsalad":
      // Posting on GigSalad is Alex's decision and not built (Codex round 1, GigSalad, P1): the
      // old submitReply path is unverified and was reachable through a stray portal link. Refuse
      // here, whatever the lead carries; Alex replies on GigSalad himself.
      void gigsaladClient;
      return { status: "failed", platform: "gigsalad", error: "GigSalad posting is disabled: Alex replies on GigSalad himself", timestamp: new Date() };

    case "yelp": {
      const result = await yelpClient.submitReply(lead.portalUrl, replyText);
      if (result.success) {
        return { status: "sent", platform: "yelp", timestamp: new Date() };
      }
      return { status: "failed", platform: "yelp", error: result.error || "Unknown", timestamp: new Date() };
    }
  }
}

/** Side-effect callbacks — injectable for testing. */
export interface AutoSendDeps {
  updateLead: (id: number, fields: Record<string, unknown>) => void;
  sendSms: (config: AutomationConfig, msg: string) => Promise<{ success: boolean; error?: string }>;
  logLead: (entry: LeadLogEntry) => void;
  dispatchReply: (
    lead: ParsedLead, text: string, auth: OAuth2Client,
    config: AutomationConfig, yelpClient: YelpPortalClient,
    gigsaladClient: GigSaladPortalClient
  ) => Promise<SendResult>;
  completeApproval: (leadId: number, doneReason: string, smsSentAt?: string) => unknown;
}

/**
 * Handle the auto-send or review-only decision after routing.
 * Extracted from processLead() for testability.
 *
 * When autoSendEnabled=true:  dispatches the reply via the platform sender.
 * When autoSendEnabled=false: stores the lead as "sent" with a review-only
 *   done_reason and sends a REVIEW SMS instead of dispatching.
 */
export async function handleAutoSendDecision(
  opts: {
    config: AutomationConfig;
    leadId: number;
    platform: string;
    msgId: string;
    output: PipelineOutput;
    lead: ParsedLead;
    startTime: number;
    auth: OAuth2Client;
    yelpClient: YelpPortalClient;
    gigsaladClient: GigSaladPortalClient;
  },
  deps: AutoSendDeps = { updateLead, sendSms, logLead, dispatchReply, completeApproval },
): Promise<void> {
  const { config, leadId, platform, msgId, output, lead, startTime, auth, yelpClient, gigsaladClient } = opts;

  if (config.autoSendEnabled) {
    // Real auto-send path
    const replyText = output.drafts.compressed_draft;
    let sendResult: SendResult;

    if (config.dryRun) {
      console.log(`[DRY-RUN] Would auto-send ${platform} reply:\n${replyText.slice(0, 200)}...`);
      sendResult = { status: "sent", platform, timestamp: new Date() };
    } else {
      sendResult = await deps.dispatchReply(lead, replyText, auth, config, yelpClient, gigsaladClient);
    }

    deps.logLead({
      timestamp: new Date().toISOString(),
      gmailMessageId: msgId,
      platform,
      parseConfidence: lead.parseConfidence,
      classification: output.classification.format_recommended,
      quotePrice: output.pricing.quote_price,
      edgeCase: false,
      status: config.dryRun ? "dry-run" : sendResult.status,
      error: sendResult.status === "failed" ? sendResult.error : undefined,
      durationMs: Date.now() - startTime,
    });

    // Update DB with send result + schedule follow-up atomically
    if (sendResult.status === "sent") {
      deps.completeApproval(leadId, `auto-sent via ${platform}`, new Date().toISOString());
    } else if (sendResult.status === "failed" && !config.dryRun) {
      deps.updateLead(leadId, { status: "failed", error_message: `Reply send failed: ${sendResult.error}` });
      await deps.sendSms(config, `FAIL: Lead #${leadId} ${platform} reply failed. Check dashboard.`);
    }
  } else {
    // Review-only mode: log what would happen, don't send
    console.log(`[review-only] Would auto-send ${platform} reply for lead #${leadId}`);
    deps.updateLead(leadId, {
      status: "sent",
      done_reason: `review-only: would-auto-send via ${platform}`,
    });
    if (!config.dryRun) {
      await deps.sendSms(config, `REVIEW: Lead #${leadId} ${platform} — auto-send suppressed. Check dashboard.`);
    } else {
      console.log(`[DRY-RUN] REVIEW: Lead #${leadId} ${platform} — auto-send suppressed`);
    }
    deps.logLead({
      timestamp: new Date().toISOString(),
      gmailMessageId: msgId,
      platform,
      parseConfidence: lead.parseConfidence,
      classification: output.classification.format_recommended,
      quotePrice: output.pricing.quote_price,
      edgeCase: false,
      status: config.dryRun ? "dry-run" : "review-only",
      durationMs: Date.now() - startTime,
    });
  }
}
