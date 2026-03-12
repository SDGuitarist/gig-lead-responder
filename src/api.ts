import { Router, type Request, type Response } from "express";
import { listLeadsFiltered, listFollowUpLeads, getLeadStats, getLead, updateLead, claimLeadForSending, setLeadOutcomeAndFreeze, getAnalytics, completeApproval } from "./db/index.js";
import type { LeadStatus, LeadOutcome, LossReason } from "./types.js";
import { LEAD_OUTCOMES, LOSS_REASONS } from "./types.js";
import { sessionAuth, csrfGuard } from "./auth.js";
import { analyzeLimiter, approveLimiter } from "./rate-limit.js";
import { sendSms } from "./sms.js";
import { runPipeline } from "./run-pipeline.js";
import { shapeLead } from "./utils/shape-lead.js";
import { asyncHandler } from "./utils/async-handler.js";

const router = Router();
router.use(sessionAuth);

function sendSSE(res: Response, event: string, data: unknown) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

// --- GET /api/leads ---

const VALID_STATUSES = new Set(["received", "sent", "done", "failed"]);
const VALID_SORTS = new Set(["date", "score", "event"]);

router.get("/api/leads", (req: Request, res: Response) => {
  // Follow-up mode: return active follow-up leads (separate query)
  if (req.query.follow_up === "active") {
    const leads = listFollowUpLeads();
    res.json(leads.map(shapeLead));
    return;
  }

  const status = typeof req.query.status === "string" && VALID_STATUSES.has(req.query.status)
    ? (req.query.status as LeadStatus)
    : undefined;
  const sort = typeof req.query.sort === "string" && VALID_SORTS.has(req.query.sort)
    ? (req.query.sort as "date" | "score" | "event")
    : undefined;

  const leads = listLeadsFiltered({ status, sort });
  res.json(leads.map(shapeLead));
});

// --- GET /api/stats ---

router.get("/api/stats", (_req: Request, res: Response) => {
  res.json(getLeadStats());
});

// --- POST /api/leads/:id/approve ---

router.post("/api/leads/:id/approve", approveLimiter, csrfGuard, asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid lead ID" });
    return;
  }

  const lead = getLead(id);
  if (!lead) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }

  if (!lead.compressed_draft) {
    res.status(400).json({ error: "Lead has no draft to send" });
    return;
  }

  // SMS concatenation limit is ~1600 chars; warn but don't block
  if (lead.compressed_draft.length > 1600) {
    console.warn(`Lead ${id}: compressed_draft is ${lead.compressed_draft.length} chars (SMS limit ~1600)`);
  }

  // Atomically claim — prevents double SMS from concurrent requests
  if (!claimLeadForSending(id)) {
    res.status(409).json({ error: "Lead is already being sent or is no longer approvable" });
    return;
  }

  try {
    await sendSms(lead.compressed_draft);
  } catch (err) {
    // Revert to previous status on SMS failure
    updateLead(id, { status: lead.status });
    void err;
    console.error("SMS delivery failed");
    res.status(500).json({ error: "SMS delivery failed. Check server logs." });
    return;
  }

  // Mark done + stamp sms_sent_at + schedule first follow-up atomically
  const updated = completeApproval(id, "approved_dashboard", new Date().toISOString());

  if (!updated) {
    res.status(500).json({ error: "Failed to update lead after sending" });
    return;
  }
  res.json(shapeLead(updated));
}));

// --- POST /api/leads/:id/edit ---

router.post("/api/leads/:id/edit", csrfGuard, asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid lead ID" });
    return;
  }

  const { full_draft } = req.body;
  if (typeof full_draft !== "string" || !full_draft.trim()) {
    res.status(400).json({ error: "full_draft is required" });
    return;
  }
  if (full_draft.length > 50_000) {
    res.status(400).json({ error: "full_draft exceeds maximum length" });
    return;
  }

  const lead = getLead(id);
  if (!lead) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }

  if (lead.edit_round >= 10) {
    res.status(400).json({ error: "Maximum edit rounds reached" });
    return;
  }

  // Null out compressed_draft so approve is blocked until re-analyze
  const updated = updateLead(id, {
    full_draft: full_draft.trim(),
    compressed_draft: null,
    edit_round: lead.edit_round + 1,
  });

  if (!updated) {
    res.status(500).json({ error: "Failed to update lead" });
    return;
  }
  res.json(shapeLead(updated));
}));

// --- POST /api/leads/:id/outcome ---

const VALID_OUTCOMES = new Set<LeadOutcome>(LEAD_OUTCOMES);
const VALID_LOSS_REASONS = new Set<LossReason>(LOSS_REASONS);

router.post("/api/leads/:id/outcome", csrfGuard, (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid lead ID" });
    return;
  }

  const lead = getLead(id);
  if (!lead) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }

  if (lead.status !== "done") {
    res.status(400).json({ error: "Lead must be in done status to set outcome" });
    return;
  }

  if (!req.body || typeof req.body !== "object") {
    res.status(400).json({ error: "Request body must be JSON" });
    return;
  }

  const { outcome, actual_price, outcome_reason } = req.body;

  // outcome can be null (clearing) or a valid outcome string
  if (outcome !== null && (typeof outcome !== "string" || !(VALID_OUTCOMES as ReadonlySet<string>).has(outcome))) {
    res.status(400).json({ error: "Invalid outcome. Must be booked, lost, no_reply, or null" });
    return;
  }

  // Validate actual_price if provided
  if (actual_price !== undefined && actual_price !== null) {
    if (typeof actual_price !== "number" || !Number.isFinite(actual_price) || actual_price <= 0 || actual_price >= 100000) {
      res.status(400).json({ error: "actual_price must be a positive number under 100000" });
      return;
    }
  }

  // Validate outcome_reason if provided
  if (outcome_reason !== undefined && outcome_reason !== null) {
    if (typeof outcome_reason !== "string" || !(VALID_LOSS_REASONS as ReadonlySet<string>).has(outcome_reason)) {
      res.status(400).json({ error: "Invalid outcome_reason. Must be price, competitor, cancelled, or other" });
      return;
    }
  }

  // Reject inapplicable sub-fields
  if (actual_price != null && outcome !== "booked") {
    res.status(400).json({ error: "actual_price is only applicable when outcome is booked" });
    return;
  }
  if (outcome_reason != null && outcome !== "lost") {
    res.status(400).json({ error: "outcome_reason is only applicable when outcome is lost" });
    return;
  }

  const updated = setLeadOutcomeAndFreeze(id, outcome as LeadOutcome | null, {
    actual_price: actual_price ?? undefined,
    outcome_reason: outcome_reason as LossReason | undefined,
  });

  if (!updated) {
    res.status(500).json({ error: "Failed to update outcome" });
    return;
  }

  // Re-fetch to include follow-up status change in response
  const fresh = getLead(id) ?? updated;
  res.json(shapeLead(fresh));
});

// --- GET /api/analytics ---

router.get("/api/analytics", (_req: Request, res: Response) => {
  res.json(getAnalytics());
});

// --- POST /api/analyze ---

router.post("/api/analyze", analyzeLimiter, csrfGuard, async (req: Request, res: Response) => {
  const { text } = req.body;
  if (!text || typeof text !== "string" || !text.trim()) {
    res.status(400).json({ error: "Missing 'text' field in request body" });
    return;
  }
  if (text.length > 50_000) {
    res.status(400).json({ error: "text exceeds maximum length" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  try {
    const output = await runPipeline(text.trim(), (event) => {
      sendSSE(res, "stage", event);
    });
    sendSSE(res, "complete", output);
  } catch (err: unknown) {
    void err;
    console.error("Pipeline error");
    sendSSE(res, "error", { error: "Pipeline processing failed. Check server logs." });
  } finally {
    res.end();
  }
});

export default router;
