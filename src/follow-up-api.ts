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

/** Shared handler: parse ID, validate lead exists, run action, return shaped lead. */
function handleAction(
  req: Request,
  res: Response,
  actionFn: (id: number) => ReturnType<typeof approveFollowUp>,
  errorMsg: string,
): void {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid lead ID" }); return; }
  if (!getLead(id)) { res.status(404).json({ error: "Lead not found" }); return; }

  const updated = actionFn(id);
  if (!updated) { res.status(409).json({ error: errorMsg }); return; }

  res.json(shapeLead(updated));
}

router.post("/api/leads/:id/follow-up/approve", followUpActionLimiter, csrfGuard, (req: Request, res: Response) => {
  handleAction(req, res, approveFollowUp, "Lead is not in a valid state for approval");
});

router.post("/api/leads/:id/follow-up/skip", followUpActionLimiter, csrfGuard, (req: Request, res: Response) => {
  handleAction(req, res, skipFollowUp, "Lead is not in a valid state for skipping");
});

router.post("/api/leads/:id/follow-up/snooze", followUpActionLimiter, csrfGuard, (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid lead ID" }); return; }

  if (!req.body || typeof req.body !== "object") {
    res.status(400).json({ error: "Request body must be JSON" });
    return;
  }

  const { until } = req.body as SnoozeRequestBody;

  if (typeof until !== "string" || !until.trim()) {
    res.status(400).json({ error: "until is required (ISO date string)" });
    return;
  }

  const snoozeDate = new Date(until);
  if (isNaN(snoozeDate.getTime())) {
    res.status(400).json({ error: "until must be a valid ISO date string" });
    return;
  }

  if (snoozeDate.getTime() <= Date.now()) {
    res.status(400).json({ error: "Snooze date must be in the future" });
    return;
  }

  const maxDate = Date.now() + 90 * 24 * 60 * 60 * 1000;
  if (snoozeDate.getTime() > maxDate) {
    res.status(400).json({ error: "Snooze date must be within 90 days" });
    return;
  }

  if (!getLead(id)) { res.status(404).json({ error: "Lead not found" }); return; }

  const updated = snoozeFollowUp(id, snoozeDate.toISOString());
  if (!updated) { res.status(409).json({ error: "Lead is not in a valid state for snoozing" }); return; }

  res.json(shapeLead(updated));
});

router.post("/api/leads/:id/follow-up/replied", followUpActionLimiter, csrfGuard, (req: Request, res: Response) => {
  handleAction(req, res, markClientReplied, "Lead is not in a valid state for marking as replied");
});

export default router;
