import { Router } from "express";
import type { Request, Response } from "express";
import { getLead, approveFollowUp, skipFollowUp, snoozeFollowUp, markClientReplied } from "./leads.js";
import { shapeLead } from "./api.js";
import { sessionAuth, csrfGuard } from "./auth.js";
import { followUpActionLimiter } from "./rate-limit.js";
import type { SnoozeRequestBody } from "./types.js";

const router = Router();

// All follow-up endpoints: auth + CSRF + rate limit
router.use(sessionAuth);

// --- POST /api/leads/:id/follow-up/approve ---

router.post("/api/leads/:id/follow-up/approve", followUpActionLimiter, csrfGuard, (req: Request, res: Response) => {
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

  const updated = approveFollowUp(id);
  if (!updated) {
    res.status(409).json({ error: "Lead is not in a valid state for approval" });
    return;
  }

  const shaped = shapeLead(updated);
  if (!shaped) { res.status(500).json({ error: "Failed to shape lead response" }); return; }
  res.json({ success: true, lead: shaped });
});

// --- POST /api/leads/:id/follow-up/skip ---

router.post("/api/leads/:id/follow-up/skip", followUpActionLimiter, csrfGuard, (req: Request, res: Response) => {
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

  const updated = skipFollowUp(id);
  if (!updated) {
    res.status(409).json({ error: "Lead is not in a valid state for skipping" });
    return;
  }

  const shaped = shapeLead(updated);
  if (!shaped) { res.status(500).json({ error: "Failed to shape lead response" }); return; }
  res.json({ success: true, lead: shaped });
});

// --- POST /api/leads/:id/follow-up/snooze ---

router.post("/api/leads/:id/follow-up/snooze", followUpActionLimiter, csrfGuard, (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid lead ID" });
    return;
  }

  const { until } = req.body as SnoozeRequestBody;

  // Validate: must be a string
  if (typeof until !== "string" || !until.trim()) {
    res.status(400).json({ error: "until is required (ISO date string)" });
    return;
  }

  // Validate: must be valid ISO date
  const snoozeDate = new Date(until);
  if (isNaN(snoozeDate.getTime())) {
    res.status(400).json({ error: "until must be a valid ISO date string" });
    return;
  }

  // Validate: must be in the future
  if (snoozeDate.getTime() <= Date.now()) {
    res.status(400).json({ error: "Snooze date must be in the future" });
    return;
  }

  // Validate: max 90 days
  const maxDate = Date.now() + 90 * 24 * 60 * 60 * 1000;
  if (snoozeDate.getTime() > maxDate) {
    res.status(400).json({ error: "Snooze date must be within 90 days" });
    return;
  }

  const lead = getLead(id);
  if (!lead) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }

  const updated = snoozeFollowUp(id, snoozeDate.toISOString());
  if (!updated) {
    res.status(409).json({ error: "Lead is not in a valid state for snoozing" });
    return;
  }

  const shaped = shapeLead(updated);
  if (!shaped) { res.status(500).json({ error: "Failed to shape lead response" }); return; }
  res.json({ success: true, lead: shaped });
});

// --- POST /api/leads/:id/follow-up/replied ---

router.post("/api/leads/:id/follow-up/replied", followUpActionLimiter, csrfGuard, (req: Request, res: Response) => {
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

  const updated = markClientReplied(id);
  if (!updated) {
    res.status(409).json({ error: "Lead is not in a valid state for marking as replied" });
    return;
  }

  const shaped = shapeLead(updated);
  if (!shaped) { res.status(500).json({ error: "Failed to shape lead response" }); return; }
  res.json({ success: true, lead: shaped });
});

export default router;
