import { readFileSync } from "node:fs";
import { join } from "node:path";
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
const openapiSpec = readFileSync(join(import.meta.dirname, "..", "openapi.yaml"), "utf-8");

function sendSSE(res: Response, event: string, data: unknown) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function sendError(res: Response, status: number, code: string, error: string): void {
  res.status(status).json({ code, error });
}

function parseLeadId(req: Request, res: Response): number | null {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) {
    sendError(res, 400, "invalid_lead_id", "Invalid lead ID");
    return null;
  }
  return id;
}

router.get("/api/openapi.yaml", (_req: Request, res: Response) => {
  res.type("application/yaml").send(openapiSpec);
});

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

  const limit = typeof req.query.limit === "string" ? Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200) : 50;
  const offset = typeof req.query.offset === "string" ? Math.max(parseInt(req.query.offset, 10) || 0, 0) : 0;

  const leads = listLeadsFiltered({ status, sort, limit, offset });
  res.json(leads.map(shapeLead));
});

router.get("/api/leads/:id", (req: Request, res: Response) => {
  const id = parseLeadId(req, res);
  if (id === null) return;

  const lead = getLead(id);
  if (!lead) {
    sendError(res, 404, "lead_not_found", "Lead not found");
    return;
  }

  res.json(shapeLead(lead));
});

// --- GET /api/stats ---

router.get("/api/stats", (_req: Request, res: Response) => {
  res.json(getLeadStats());
});

// --- POST /api/leads/:id/approve ---

router.post("/api/leads/:id/approve", approveLimiter, csrfGuard, asyncHandler(async (req: Request, res: Response) => {
  const id = parseLeadId(req, res);
  if (id === null) return;

  const lead = getLead(id);
  if (!lead) {
    sendError(res, 404, "lead_not_found", "Lead not found");
    return;
  }

  if (!lead.compressed_draft) {
    sendError(res, 400, "missing_compressed_draft", "Lead has no draft to send");
    return;
  }

  // SMS concatenation limit is ~1600 chars; warn but don't block
  if (lead.compressed_draft.length > 1600) {
    console.warn(`Lead ${id}: compressed_draft is ${lead.compressed_draft.length} chars (SMS limit ~1600)`);
  }

  // Atomically claim — prevents double SMS from concurrent requests
  if (!claimLeadForSending(id)) {
    sendError(res, 409, "lead_not_approvable", "Lead is already being sent or is no longer approvable");
    return;
  }

  try {
    await sendSms(lead.compressed_draft);
  } catch (err) {
    // Revert to previous status on SMS failure
    updateLead(id, { status: lead.status });
    console.error(`Lead ${id}: SMS send failed:`, err);
    sendError(res, 500, "sms_delivery_failed", "SMS delivery failed");
    return;
  }

  // Mark done + stamp sms_sent_at + schedule first follow-up atomically
  const updated = completeApproval(id, "approved_dashboard", new Date().toISOString());

  if (!updated) {
    sendError(res, 500, "approval_update_failed", "Failed to update lead after sending");
    return;
  }
  res.json(shapeLead(updated));
}));

// --- POST /api/leads/:id/edit ---

router.post("/api/leads/:id/edit", csrfGuard, asyncHandler(async (req: Request, res: Response) => {
  const id = parseLeadId(req, res);
  if (id === null) return;

  const { full_draft } = req.body;
  if (typeof full_draft !== "string" || !full_draft.trim()) {
    sendError(res, 400, "missing_full_draft", "full_draft is required");
    return;
  }
  if (full_draft.length > 50_000) {
    sendError(res, 400, "full_draft_too_long", "full_draft exceeds maximum length");
    return;
  }

  const lead = getLead(id);
  if (!lead) {
    sendError(res, 404, "lead_not_found", "Lead not found");
    return;
  }

  if (lead.edit_round >= 10) {
    sendError(res, 400, "edit_round_limit_reached", "Maximum edit rounds reached");
    return;
  }

  // Null out compressed_draft so approve is blocked until re-analyze
  const updated = updateLead(id, {
    full_draft: full_draft.trim(),
    compressed_draft: null,
    edit_round: lead.edit_round + 1,
  });

  if (!updated) {
    sendError(res, 500, "lead_update_failed", "Failed to update lead");
    return;
  }
  res.json(shapeLead(updated));
}));

// --- POST /api/leads/:id/outcome ---

const VALID_OUTCOMES = new Set<LeadOutcome>(LEAD_OUTCOMES);
const VALID_LOSS_REASONS = new Set<LossReason>(LOSS_REASONS);

router.post("/api/leads/:id/outcome", csrfGuard, (req: Request, res: Response) => {
  const id = parseLeadId(req, res);
  if (id === null) return;

  const lead = getLead(id);
  if (!lead) {
    sendError(res, 404, "lead_not_found", "Lead not found");
    return;
  }

  if (lead.status !== "done") {
    sendError(res, 400, "lead_not_done", "Lead must be in done status to set outcome");
    return;
  }

  if (!req.body || typeof req.body !== "object") {
    sendError(res, 400, "invalid_json_body", "Request body must be JSON");
    return;
  }

  const { outcome, actual_price, outcome_reason } = req.body;

  // outcome can be null (clearing) or a valid outcome string
  if (outcome !== null && (typeof outcome !== "string" || !(VALID_OUTCOMES as ReadonlySet<string>).has(outcome))) {
    sendError(res, 400, "invalid_outcome", "Invalid outcome. Must be booked, lost, no_reply, or null");
    return;
  }

  // Validate actual_price if provided
  if (actual_price !== undefined && actual_price !== null) {
    if (typeof actual_price !== "number" || !Number.isFinite(actual_price) || actual_price <= 0 || actual_price >= 100000) {
      sendError(res, 400, "invalid_actual_price", "actual_price must be a positive number under 100000");
      return;
    }
  }

  // Validate outcome_reason if provided
  if (outcome_reason !== undefined && outcome_reason !== null) {
    if (typeof outcome_reason !== "string" || !(VALID_LOSS_REASONS as ReadonlySet<string>).has(outcome_reason)) {
      sendError(res, 400, "invalid_outcome_reason", "Invalid outcome_reason. Must be price, competitor, cancelled, or other");
      return;
    }
  }

  // Reject inapplicable sub-fields
  if (actual_price != null && outcome !== "booked") {
    sendError(res, 400, "actual_price_requires_booked", "actual_price is only applicable when outcome is booked");
    return;
  }
  if (outcome_reason != null && outcome !== "lost") {
    sendError(res, 400, "outcome_reason_requires_lost", "outcome_reason is only applicable when outcome is lost");
    return;
  }

  const updated = setLeadOutcomeAndFreeze(id, outcome as LeadOutcome | null, {
    actual_price: actual_price ?? undefined,
    outcome_reason: outcome_reason as LossReason | undefined,
  });

  if (!updated) {
    sendError(res, 500, "outcome_update_failed", "Failed to update outcome");
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
    sendError(res, 400, "missing_text", "Missing 'text' field in request body");
    return;
  }
  if (text.length > 50_000) {
    sendError(res, 400, "text_too_long", "text exceeds maximum length");
    return;
  }

  if (req.query.format === "json") {
    try {
      const output = await runPipeline(text.trim());
      res.json(output);
    } catch (err: unknown) {
      console.error("Analyze pipeline failed:", err);
      sendError(res, 500, "analysis_failed", "Analysis failed — check server logs");
    }
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const heartbeat = setInterval(() => {
    res.write(":heartbeat\n\n");
  }, 15_000);

  try {
    const output = await runPipeline(text.trim(), (event) => {
      sendSSE(res, "stage", event);
    });
    sendSSE(res, "complete", output);
  } catch (err: unknown) {
    console.error("Analyze pipeline failed:", err);
    sendSSE(res, "error", { code: "analysis_failed", error: "Analysis failed — check server logs" });
  } finally {
    clearInterval(heartbeat);
    res.end();
  }
});

export default router;
