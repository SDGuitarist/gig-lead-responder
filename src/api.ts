import { Router, type Request, type Response } from "express";
import { listLeadsFiltered, getLeadStats, getLead, updateLead, claimLeadForSending } from "./leads.js";
import type { LeadStatus } from "./types.js";
import { basicAuth } from "./auth.js";
import { sendSms } from "./sms.js";
import { runPipeline } from "./run-pipeline.js";

const router = Router();
router.use(basicAuth);

// --- Helpers ---

function safeJsonParse(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function shapeLead(lead: ReturnType<typeof getLead>) {
  if (!lead) return null;

  const cl = safeJsonParse(lead.classification_json);
  const pr = safeJsonParse(lead.pricing_json);
  const gt = safeJsonParse(lead.gate_json);

  const gutChecks = gt?.gut_checks as Record<string, boolean> | undefined;
  let gutCheckPassed: number | null = null;
  let gutCheckTotal: number | null = null;
  const failedChecks: string[] = [];
  if (gutChecks) {
    const entries = Object.entries(gutChecks);
    gutCheckTotal = entries.length;
    gutCheckPassed = entries.filter(([, v]) => v).length;
    for (const [name, passed] of entries) {
      if (!passed) failedChecks.push(name);
    }
  }

  return {
    id: lead.id,
    status: lead.status,
    event_type: lead.event_type,
    event_date: lead.event_date,
    venue: lead.venue,
    client_name: lead.client_name,
    confidence_score: lead.confidence_score,
    edit_round: lead.edit_round,
    created_at: lead.created_at,
    updated_at: lead.updated_at,
    full_draft: lead.full_draft,
    compressed_draft: lead.compressed_draft,
    error_message: lead.error_message,
    // classification
    format_recommended: cl?.format_recommended ?? null,
    duration_hours: cl?.duration_hours ?? null,
    tier: cl?.tier ?? null,
    competition_level: cl?.competition_level ?? null,
    // pricing
    quote_price: pr?.quote_price ?? null,
    anchor: pr?.anchor ?? null,
    floor: pr?.floor ?? null,
    // gate
    gate_passed: lead.gate_passed,
    gut_check_passed: gutCheckPassed,
    gut_check_total: gutCheckTotal,
    fail_reasons: (gt?.fail_reasons as string[]) ?? null,
    failed_checks: failedChecks,
  };
}

function sendSSE(res: Response, event: string, data: unknown) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

// --- GET /api/leads ---

const VALID_STATUSES = new Set(["received", "sent", "done", "failed"]);
const VALID_SORTS = new Set(["date", "score", "event"]);

router.get("/api/leads", (_req: Request, res: Response) => {
  const status = typeof _req.query.status === "string" && VALID_STATUSES.has(_req.query.status)
    ? (_req.query.status as LeadStatus)
    : undefined;
  const sort = typeof _req.query.sort === "string" && VALID_SORTS.has(_req.query.sort)
    ? (_req.query.sort as "date" | "score" | "event")
    : undefined;

  const leads = listLeadsFiltered({ status, sort });
  res.json(leads.map(shapeLead));
});

// --- GET /api/stats ---

router.get("/api/stats", (_req: Request, res: Response) => {
  res.json(getLeadStats());
});

// --- POST /api/leads/:id/approve ---

router.post("/api/leads/:id/approve", async (req: Request, res: Response) => {
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
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: `SMS failed: ${message}` });
    return;
  }

  const updated = updateLead(id, {
    status: "done",
    done_reason: "approved_dashboard",
    sms_sent_at: new Date().toISOString(),
  });

  if (!updated) {
    res.status(500).json({ error: "Failed to update lead after sending" });
    return;
  }
  res.json(shapeLead(updated));
});

// --- POST /api/leads/:id/edit ---

router.post("/api/leads/:id/edit", async (req: Request, res: Response) => {
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

  const lead = getLead(id);
  if (!lead) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }

  // Null out compressed_draft so approve is blocked until re-analyze
  const updated = updateLead(id, {
    full_draft: full_draft.trim(),
    compressed_draft: null as unknown as string,
    edit_round: lead.edit_round + 1,
  });

  if (!updated) {
    res.status(500).json({ error: "Failed to update lead" });
    return;
  }
  res.json(shapeLead(updated));
});

// --- POST /api/analyze ---

router.post("/api/analyze", async (req: Request, res: Response) => {
  const { text } = req.body;
  if (!text || typeof text !== "string" || !text.trim()) {
    res.status(400).json({ error: "Missing 'text' field in request body" });
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
    const message = err instanceof Error ? err.message : String(err);
    sendSSE(res, "error", { error: message });
  } finally {
    res.end();
  }
});

export default router;
