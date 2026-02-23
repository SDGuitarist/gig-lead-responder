import { Router, type Request, type Response } from "express";
import { listLeadsFiltered, getLeadStats, getLead, updateLead } from "./leads.js";
import type { LeadStatus } from "./types.js";
import { basicAuth } from "./auth.js";
import { sendSms } from "./sms.js";

const router = Router();
router.use("/api/leads", basicAuth);
router.use("/api/stats", basicAuth);

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
  if (gutChecks) {
    const values = Object.values(gutChecks);
    gutCheckTotal = values.length;
    gutCheckPassed = values.filter(Boolean).length;
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
  };
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

  if (lead.status !== "received" && lead.status !== "sent") {
    res.status(400).json({ error: `Cannot approve lead with status "${lead.status}"` });
    return;
  }

  if (!lead.compressed_draft) {
    res.status(400).json({ error: "Lead has no draft to send" });
    return;
  }

  try {
    await sendSms(lead.compressed_draft);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: `SMS failed: ${message}` });
    return;
  }

  const updated = updateLead(id, {
    status: "done",
    done_reason: "approved_dashboard",
    sms_sent_at: new Date().toISOString(),
  });

  res.json(shapeLead(updated!));
});

export default router;
