import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { GmailMessage } from "./automation/gmail-watcher.js";
import type { AutomationConfig } from "./automation/config.js";

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "glr-orch-retry-")), "leads.db");
const { processLead } = await import("./automation/orchestrator.js");
const { insertLead, updateLead, isEmailProcessed } = await import("./db/index.js");
const { initDb } = await import("./db/migrate.js");

const config = { dryRun: true, autoSendEnabled: false, logPath: "/dev/null", edgeCaseBudgetThreshold: 3000 } as AutomationConfig;

function gigsalad(id: string): GmailMessage {
  return {
    id,
    threadId: "t-" + id,
    from: "GigSalad <leads@gigsalad.com>",
    to: "alex@example.com",
    subject: "New Lead: Wedding in San Diego",
    date: "2026-10-03T10:00:00Z",
    replyTo: "",
    messageIdHeader: `<${id}@gigsalad.com>`,
    authenticationResults:
      "mx.google.com; dkim=pass header.i=@gigsalad.com; spf=pass smtp.mailfrom=gigsalad.com; dmarc=pass (p=NONE) header.from=gigsalad.com",
    bodyText:
      "Event Type: Wedding\nDate: April 15, 2027\nLocation: San Diego, CA\nBudget: $500\nGuest Count: 80\nGenre Request: Spanish guitar\nMessage: Looking for a guitarist.",
    bodyHtml: '<a href="https://www.gigsalad.com/leads/respond/12345">Respond</a>',
  };
}

const rowsFor = (id: string) =>
  initDb().prepare("SELECT id FROM leads WHERE mailgun_message_id = ?").all(id) as { id: number }[];

test("retry resumes a half-done lead: reuses the row instead of a duplicate insert", async () => {
  // State a crash leaves behind: row inserted, pipeline never finished, not marked done.
  const half = insertLead({ raw_email: "x", source_platform: "gigsalad", mailgun_message_id: "retry-1" });
  let calls = 0;
  await processLead(gigsalad("retry-1"), config, {} as never, {} as never, {} as never, {
    runPipeline: (async () => {
      calls++;
      throw new Error("stop after resume");
    }) as never,
  });
  assert.equal(calls, 1);
  assert.deepEqual(rowsFor("retry-1"), [{ id: half.id }]);
});

test("retry resumes a half-done lead: a row past the pipeline is not redone", async () => {
  const done = insertLead({ raw_email: "x", source_platform: "gigsalad", mailgun_message_id: "retry-2" });
  updateLead(done.id, { pipeline_completed_at: new Date().toISOString() });
  let calls = 0;
  await processLead(gigsalad("retry-2"), config, {} as never, {} as never, {} as never, {
    runPipeline: (async () => {
      calls++;
      throw new Error("must not run");
    }) as never,
  });
  assert.equal(calls, 0);
  assert.equal(isEmailProcessed("retry-2"), true);
  assert.equal(rowsFor("retry-2").length, 1);
});
