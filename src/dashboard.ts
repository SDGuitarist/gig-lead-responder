import { Router, type Request, type Response, type NextFunction } from "express";
import { listLeads, getLead } from "./leads.js";
import type { LeadRecord } from "./types.js";

const router = Router();

// --- Inline Basic Auth middleware ---

function basicAuth(req: Request, res: Response, next: NextFunction): void {
  const user = process.env.DASHBOARD_USER;
  const pass = process.env.DASHBOARD_PASS;

  // If either env var is missing, skip auth (local dev convenience)
  if (!user || !pass) {
    next();
    return;
  }

  const header = req.headers.authorization;
  if (!header || !header.startsWith("Basic ")) {
    res.setHeader("WWW-Authenticate", 'Basic realm="Gig Lead Dashboard"');
    res.status(401).send("Authentication required");
    return;
  }

  const decoded = Buffer.from(header.slice(6), "base64").toString();
  const [u, p] = decoded.split(":");

  if (u === user && p === pass) {
    next();
  } else {
    res.setHeader("WWW-Authenticate", 'Basic realm="Gig Lead Dashboard"');
    res.status(401).send("Invalid credentials");
  }
}

router.use("/leads", basicAuth);

// --- Helpers ---

function esc(str: string | null | undefined): string {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function statusBadge(status: string): string {
  const colors: Record<string, string> = {
    received: "#3b82f6",  // blue
    sent: "#f59e0b",      // amber
    done: "#22c55e",      // green
    failed: "#ef4444",    // red
  };
  const bg = colors[status] || "#6b7280";
  return `<span style="background:${bg};color:#fff;padding:2px 8px;border-radius:4px;font-size:0.85em;">${esc(status)}</span>`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function layout(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} — Gig Leads</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, system-ui, sans-serif; background: #f8fafc; color: #1e293b; padding: 1.5rem; max-width: 960px; margin: 0 auto; }
  h1 { font-size: 1.4rem; margin-bottom: 1rem; }
  a { color: #2563eb; text-decoration: none; }
  a:hover { text-decoration: underline; }
  table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
  th, td { padding: 0.6rem 0.8rem; text-align: left; border-bottom: 1px solid #e2e8f0; font-size: 0.9rem; }
  th { background: #f1f5f9; font-weight: 600; }
  tr:last-child td { border-bottom: none; }
  .unparsed { background: #fef3c7; }
  .back { display: inline-block; margin-bottom: 1rem; font-size: 0.9rem; }
  .detail-card { background: #fff; border-radius: 8px; padding: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 1rem; }
  .detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem 1.5rem; }
  .detail-grid dt { font-weight: 600; font-size: 0.85rem; color: #64748b; }
  .detail-grid dd { margin-bottom: 0.5rem; }
  .draft-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 1rem; white-space: pre-wrap; font-size: 0.9rem; line-height: 1.5; margin-top: 0.5rem; cursor: pointer; position: relative; }
  .draft-box:hover { border-color: #2563eb; }
  .copy-hint { font-size: 0.75rem; color: #94a3b8; margin-top: 0.25rem; }
  .section-title { font-size: 1.1rem; font-weight: 600; margin: 1.5rem 0 0.5rem; }
  .error-msg { color: #ef4444; font-weight: 600; }
</style>
</head>
<body>
${body}
</body>
</html>`;
}

// --- GET /leads ---

router.get("/leads", (_req: Request, res: Response) => {
  const leads = listLeads();

  const rows = leads.map((l: LeadRecord) => {
    const unparsed = l.client_name === null;
    const rowClass = unparsed ? ' class="unparsed"' : "";
    return `<tr${rowClass}>
      <td><a href="/leads/${l.id}">#${l.id}</a></td>
      <td>${statusBadge(l.status)}</td>
      <td>${esc(l.event_type) || '<em style="color:#94a3b8">unknown</em>'}</td>
      <td>${esc(l.event_date) || "—"}</td>
      <td>${esc(l.venue) || "—"}</td>
      <td>${esc(l.client_name) || '<em style="color:#d97706">unparsed</em>'}</td>
      <td>${l.edit_round}</td>
      <td>${l.confidence_score ?? "—"}</td>
      <td>${formatDate(l.created_at)}</td>
    </tr>`;
  }).join("\n");

  const body = `
    <h1>Gig Leads</h1>
    <table>
      <thead>
        <tr>
          <th>ID</th>
          <th>Status</th>
          <th>Event</th>
          <th>Date</th>
          <th>Venue</th>
          <th>Client</th>
          <th>Edits</th>
          <th>Score</th>
          <th>Received</th>
        </tr>
      </thead>
      <tbody>
        ${leads.length === 0 ? '<tr><td colspan="9" style="text-align:center;color:#94a3b8;padding:2rem;">No leads yet</td></tr>' : rows}
      </tbody>
    </table>`;

  res.send(layout("All Leads", body));
});

// --- GET /leads/:id ---

router.get("/leads/:id", (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) {
    res.status(400).send(layout("Error", "<h1>Invalid lead ID</h1>"));
    return;
  }

  const lead = getLead(id);
  if (!lead) {
    res.status(404).send(layout("Not Found", `<h1>Lead #${id} not found</h1><a href="/leads" class="back">&larr; Back to leads</a>`));
    return;
  }

  const unparsedNote = lead.client_name === null
    ? '<p style="background:#fef3c7;padding:0.5rem 0.8rem;border-radius:4px;margin-bottom:1rem;font-size:0.85rem;">Email could not be fully parsed. Check raw email below.</p>'
    : "";

  const errorSection = lead.error_message
    ? `<p class="error-msg" style="margin-bottom:1rem;">Error: ${esc(lead.error_message)}</p>`
    : "";

  const draftSection = lead.full_draft
    ? `<div class="section-title">Full Draft (click to copy)</div>
       <div class="draft-box" onclick="navigator.clipboard.writeText(this.innerText).then(()=>this.style.borderColor='#22c55e')">${esc(lead.full_draft)}</div>
       <div class="copy-hint">Click the box to copy to clipboard</div>`
    : '<p style="color:#94a3b8;margin-top:1rem;">No draft generated yet.</p>';

  const compressedSection = lead.compressed_draft
    ? `<div class="section-title">Compressed Draft (SMS)</div>
       <div class="draft-box" onclick="navigator.clipboard.writeText(this.innerText).then(()=>this.style.borderColor='#22c55e')">${esc(lead.compressed_draft)}</div>
       <div class="copy-hint">Click the box to copy to clipboard</div>`
    : "";

  const body = `
    <a href="/leads" class="back">&larr; Back to leads</a>
    <h1>Lead #${lead.id} ${statusBadge(lead.status)}</h1>
    ${unparsedNote}
    ${errorSection}

    <div class="detail-card">
      <div class="detail-grid">
        <dt>Client</dt><dd>${esc(lead.client_name) || '<em style="color:#d97706">unparsed</em>'}</dd>
        <dt>Platform</dt><dd>${esc(lead.source_platform) || "—"}</dd>
        <dt>Event Type</dt><dd>${esc(lead.event_type) || "—"}</dd>
        <dt>Event Date</dt><dd>${esc(lead.event_date) || "—"}</dd>
        <dt>Venue</dt><dd>${esc(lead.venue) || "—"}</dd>
        <dt>Guests</dt><dd>${lead.guest_count ?? "—"}</dd>
        <dt>Budget</dt><dd>${esc(lead.budget_note) || "—"}</dd>
        <dt>Edit Round</dt><dd>${lead.edit_round}</dd>
        <dt>Gate Passed</dt><dd>${lead.gate_passed === null ? "—" : lead.gate_passed ? "Yes" : "No"}</dd>
        <dt>Confidence</dt><dd>${lead.confidence_score ?? "—"}</dd>
        <dt>Done Reason</dt><dd>${esc(lead.done_reason) || "—"}</dd>
        <dt>Received</dt><dd>${formatDate(lead.created_at)}</dd>
        <dt>Updated</dt><dd>${formatDate(lead.updated_at)}</dd>
        <dt>Pipeline Done</dt><dd>${formatDate(lead.pipeline_completed_at)}</dd>
        <dt>SMS Sent</dt><dd>${formatDate(lead.sms_sent_at)}</dd>
      </div>
    </div>

    ${draftSection}
    ${compressedSection}

    <div class="section-title">Raw Email</div>
    <div class="draft-box" style="font-family:monospace;font-size:0.8rem;max-height:400px;overflow-y:auto;">${esc(lead.raw_email)}</div>`;

  res.send(layout(`Lead #${lead.id}`, body));
});

export default router;
