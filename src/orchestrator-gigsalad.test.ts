import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { GmailMessage } from "./automation/gmail-watcher.js";
import type { AutomationConfig } from "./automation/config.js";
import type { GigSaladEnrichment } from "./automation/portals/gigsalad-enrich.js";

// GigSalad step 4 wiring: a real-format lead email is replaced by its lead page's details before
// the pipeline, or held with the reason. The enrichment is injected: no test opens a browser.
process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "glr-orch-gs-")), "leads.db");
const { processLead } = await import("./automation/orchestrator.js");
const { initDb } = await import("./db/migrate.js");
const { parseGigSaladLeadPage } = await import("./automation/parsers/gigsalad-page.js");

const config = { dryRun: true, autoSendEnabled: false, logPath: "/dev/null", edgeCaseBudgetThreshold: 3000 } as AutomationConfig;

const realFormat = (id: string): GmailMessage => ({
  id, threadId: "t-" + id, from: "GigSalad <leads@gigsalad.com>", to: "alex@example.com",
  subject: "New Lead: Birthday Party", date: "2026-10-04T10:00:00Z", replyTo: "", messageIdHeader: `<${id}@gigsalad.com>`,
  authenticationResults:
    "mx.google.com; dkim=pass header.i=@gigsalad.com; spf=pass smtp.mailfrom=gigsalad.com; dmarc=pass (p=NONE) header.from=gigsalad.com",
  bodyText: "Alex, you got a new lead!\n\nTesta would like a quote for a Birthday Party on August 1, 2026 from 6:00 pm to 9:00 pm.",
  bodyHtml: "",
});
const PAGE = parseGigSaladLeadPage({ title: "Gig Lead from Testa Q. | GigSalad", text:
  "Event info\nTesta Q.\nSat, August 1, 2026 View calendar\n6:00 PM – 9:00 PM (3 hours)\nSpringfield, CA 90001, US\nEvent type: Birthday Party\nNumber of guests: 40 guests\nBlock communication" });
const rowOf = (id: string) => initDb().prepare("SELECT status, error_message FROM leads WHERE mailgun_message_id = ?").get(id) as
  { status: string; error_message: string | null } | undefined;
const stop = new Error("stop after the call under test");

async function run(id: string, enrichment: GigSaladEnrichment, seen: string[]) {
  return processLead(realFormat(id), config, {} as never, {} as never, {} as never, {
    runPipeline: (async (text: string) => { seen.push(text); throw stop; }) as never,
    enrichGigSalad: async () => enrichment,
  });
}

test("gigsalad wiring: an enriched lead runs the pipeline on the page's details, not the email", async () => {
  const seen: string[] = [];
  await assert.rejects(run("gs-1", { status: "enriched", account: "music", gigId: "8", lead: PAGE }, seen), /stop after/);
  assert.equal(seen.length, 1);
  assert.equal(seen[0], PAGE.rawText);
  assert.match(seen[0], /^Number of guests: 40 guests$/m);
});

test("gigsalad wiring: a held lead never reaches the pipeline and its note carries the reason", async () => {
  const seen: string[] = [];
  await run("gs-2", { status: "hold", reason: "GigSalad: the app's business login has expired. Run: npm run gigsalad:login -- business" }, seen);
  assert.equal(seen.length, 0);
  assert.equal(rowOf("gs-2")?.status, "failed");
  assert.match(rowOf("gs-2")?.error_message ?? "", /npm run gigsalad:login -- business/);
});

test("gigsalad wiring: an email that is not GigSalad's lead sentence keeps the old email parse", async () => {
  const seen: string[] = [];
  const msg = { ...realFormat("gs-3"), bodyText: "Event Type: Wedding\nDate: April 15, 2027\nLocation: San Diego, CA\nGuest Count: 80" };
  await assert.rejects(processLead(msg, config, {} as never, {} as never, {} as never, {
    runPipeline: (async (text: string) => { seen.push(text); throw stop; }) as never,
    enrichGigSalad: async () => ({ status: "not_a_lead_email" }),
  }), /stop after/);
  assert.match(seen[0], /Event Type: Wedding/);
});

test("gigsalad wiring: a lead found while the other login expired still runs, and the notice is surfaced", async () => {
  const seen: string[] = [];
  const warned: string[] = [];
  const original = console.warn;
  console.warn = (...a: unknown[]) => { warned.push(a.join(" ")); };
  try {
    await assert.rejects(run("gs-4", { status: "enriched", account: "music", gigId: "8", lead: PAGE,
      notice: "GigSalad: the app's business login has expired. Run: npm run gigsalad:login -- business" }, seen), /stop after/);
  } finally { console.warn = original; }
  assert.equal(seen[0], PAGE.rawText);
  assert.ok(warned.some((w) => /gigsalad:login -- business/.test(w)), warned.join("\n"));
});

// Codex round 1 (GigSalad) P1: an email carrying an old-style www.gigsalad.com link gave the lead a
// portalUrl, so the never-verified submitReply path was reachable. Posting on GigSalad is Alex's
// decision (not built): the dispatch refuses, whatever the lead carries.
test("gigsalad send disarmed: dispatchReply never calls the GigSalad client, even with a portal address", async () => {
  const { dispatchReply } = await import("./automation/orchestrator.js");
  const client = { submitReply: async () => { throw new Error("GigSalad client must never be called"); } };
  const lead = { platform: "gigsalad", portalUrl: "https://www.gigsalad.com/leads/respond/123", rawText: "x",
    parseConfidence: "high", parseWarnings: [], gmailMessageId: "m", threadId: "t", messageIdHeader: "h", receivedAt: new Date() };
  const r = await dispatchReply(lead as never, "reply", {} as never, config, {} as never, client as never);
  assert.equal(r.status, "failed");
  assert.match(r.status === "failed" ? r.error : "", /disabled/);
});
