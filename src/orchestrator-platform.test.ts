import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { GmailMessage } from "./automation/gmail-watcher.js";
import type { AutomationConfig } from "./automation/config.js";

// processLead writes to SQLite, so point it at a throwaway DB before the DB
// module loads (it reads DATABASE_PATH at import time).
process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "glr-orch-")), "leads.db");
const { processLead } = await import("./automation/orchestrator.js");

const config = {
  dryRun: true,
  autoSendEnabled: false,
  logPath: "/dev/null",
  edgeCaseBudgetThreshold: 3000,
} as AutomationConfig;

const gigsaladMsg: GmailMessage = {
  id: "orch-platform-1",
  threadId: "t-1",
  from: "GigSalad <leads@gigsalad.com>",
  to: "alex@example.com",
  subject: "New Lead: Wedding in San Diego",
  date: "2026-10-03T10:00:00Z",
  replyTo: "",
  messageIdHeader: "<orch-platform-1@gigsalad.com>",
  authenticationResults:
    "mx.google.com; dkim=pass header.i=@gigsalad.com; spf=pass smtp.mailfrom=gigsalad.com; dmarc=pass (p=NONE) header.from=gigsalad.com",
  bodyText:
    "Event Type: Wedding\nDate: April 15, 2027\nLocation: San Diego, CA\nBudget: $500\nGuest Count: 80\nGenre Request: Spanish guitar\nMessage: Looking for a guitarist.",
  bodyHtml: '<a href="https://www.gigsalad.com/leads/respond/12345">Respond</a>',
};

test("orchestrator passes platform into runPipeline", async () => {
  const seen: unknown[] = [];
  const fakeRunPipeline = async (...args: unknown[]) => {
    seen.push(args[2]);
    throw new Error("stop after the call under test");
  };
  await processLead(gigsaladMsg, config, {} as never, {} as never, {} as never, {
    runPipeline: fakeRunPipeline as never,
  });
  assert.deepEqual(seen, ["gigsalad"]);
});
