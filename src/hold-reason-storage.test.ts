// Todo 097 plan S1-S5: a held lead is stored as status 'sent' WITH the router's reasons; nothing else gets a reason.
// processLead against a temporary SQLite database and an injected pipeline: no network, no model call.
// Fixture shape copies src/yelp-quote-parser.test.ts (invented names and tokens, real line structure).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { GmailMessage } from "./automation/gmail-watcher.js";
import type { AutomationConfig } from "./automation/config.js";

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "glr-holdstore-")), "leads.db");
const { processLead, handleAutoSendDecision } = await import("./automation/orchestrator.js");
const { getLeadByMessageId, insertLead } = await import("./db/leads.js");
const { initDb } = await import("./db/migrate.js");

const TOKEN = "MLA" + "0".repeat(29) + "abc";
const LEADS_PATH = "%2Fleads_center%2FlGwoYFACL339026pNoq5LQ%2Fleads%2FmMH7xkZ-sbMCaBHq8SqnaQ";
const LOGIN_URL = `https://biz.yelp.com/login/passwordless/redirect/${TOKEN}?return_url=${LEADS_PATH}&ytl_=zz&utm_medium=email`;
const MARK = "https://biz.yelp.com/messaging/mark_as_replied_autosubmit/b61e5f2f068d4be78e9d1f11649c37c4";
const DATE_Q = "When do you require this service?";
const LOC_Q = "In what location do you need the service?";
const FOOTER = "Don't miss out on future leads — stay responsive!";
const YELP_REASON = "Yelp portal reply not verified live (todo 094): Alex sends from Yelp";

function paragraphs(nameP: string): string[] {
  return [
    "Jordan requested a quote from Alex Guillen Music for a musicians. Reply to stay eligible for leads and keep your response rate up!",
    "͏ ͏ ͏ ͏ ͏ ͏ ͏ ͏", "## You have a new musicians request.",
    `[Reply to Jordan on Yelp Biz](${LOGIN_URL})`, "Sent to Alex Guillen Music", "444 Anita St Chula Vista, CA 91911",
    DATE_Q, "2026-10-30", LOC_Q, "92104", nameP, "0", "0", "0",
    `[Reply to Jordan on Yelp Biz](${LOGIN_URL})`, `[I'm not interested](${MARK}?reply_type=NOT_NEEDED&ytl_=zz)`, FOOTER,
  ];
}
function yelpMsg(id: string, nameP = "Jordan T."): GmailMessage {
  return {
    id, threadId: id,
    from: "Yelp Inbox <reply+b61e5f2f068d4be78e9d1f11649c37c4@messaging.yelp.com>", to: "alex@example.com",
    subject: "Alex Guillen Music's response to Jordan", date: "2026-10-16T19:17:17Z", replyTo: "",
    messageIdHeader: `<${id}@messaging.yelp.com>`,
    authenticationResults: "mx.google.com; dkim=pass header.i=@yelp.com; dmarc=pass (p=REJECT) header.from=yelp.com",
    bodyText: paragraphs(nameP).join("\n\n"),
    bodyHtml: `<html><body><a href="${LOGIN_URL.replace(/&/g, "&amp;")}">Reply to Jordan on Yelp Biz</a></body></html>`,
  } as GmailMessage;
}

const cfg = { dryRun: true, autoSendEnabled: false, logPath: "/dev/null", edgeCaseBudgetThreshold: 3000 } as AutomationConfig;
const pipelineOutput = () => ({
  classification: { flagged_concerns: [], format_requested: "solo", format_recommended: "solo", vagueness: "clear", action: "quote", stealth_premium: false, client_first_name: "Jordan", venue_name: null, event_date_iso: null },
  pricing: { quote_price: 700 }, drafts: { full_draft: "Hi", compressed_draft: "Hi", compressed_word_count: 1 },
  gate: { gate_status: "pass" }, verified: true, confidence_score: 80,
});
const runPipeline = (async () => pipelineOutput()) as never;
const mustNotRun = (async () => { throw new Error("must not run"); }) as never;
const yelpClient = { fetchLeadDetails: async () => ({ success: false, fullMessage: "" }) } as never;
const count = (msgId: string): number => (initDb().prepare("SELECT COUNT(*) c FROM leads WHERE mailgun_message_id = ?").get(msgId) as { c: number }).c;

describe("hold_reason storage (todo 097)", () => {
  it("S1 a held Yelp lead is stored as status 'sent' with the router's reason", async () => {
    await processLead(yelpMsg("hold-s1"), cfg, {} as never, yelpClient, {} as never, { runPipeline });
    const row = getLeadByMessageId("hold-s1");
    assert.ok(row);
    assert.equal(row.status, "sent");
    assert.equal(row.hold_reason, YELP_REASON);
  });

  it("S2 ingesting the same message again skips it and leaves the row unchanged", async () => {
    await processLead(yelpMsg("hold-s2"), cfg, {} as never, yelpClient, {} as never, { runPipeline });
    const before = getLeadByMessageId("hold-s2");
    assert.ok(before && before.hold_reason === YELP_REASON);
    await processLead(yelpMsg("hold-s2"), cfg, {} as never, yelpClient, {} as never, { runPipeline: mustNotRun });
    const after = getLeadByMessageId("hold-s2");
    assert.deepEqual(after, before);
    assert.equal(count("hold-s2"), 1);
  });

  it("S2b (ARTIFICIAL: the processed-email marker is deleted by hand) the existing-row guard still leaves the held row unchanged", async () => {
    await processLead(yelpMsg("hold-s2b"), cfg, {} as never, yelpClient, {} as never, { runPipeline });
    const before = getLeadByMessageId("hold-s2b");
    assert.ok(before && before.hold_reason === YELP_REASON);
    initDb().prepare("DELETE FROM processed_emails WHERE external_id = ?").run("hold-s2b"); // artificial reset, not a production path
    await processLead(yelpMsg("hold-s2b"), cfg, {} as never, yelpClient, {} as never, { runPipeline: mustNotRun });
    assert.deepEqual(getLeadByMessageId("hold-s2b"), before);
    assert.equal(count("hold-s2b"), 1);
  });

  it("S3 the review-only writer on a fresh row stores 'sent' + the review-only done_reason and NO hold reason (the router allowed it; only configuration suppressed the send)", async () => {
    const row = insertLead({ raw_email: "x", source_platform: "squarespace", mailgun_message_id: "hold-s3" });
    await handleAutoSendDecision(
      { config: cfg, leadId: row.id, platform: "squarespace", msgId: "hold-s3", output: pipelineOutput() as never, lead: { parseConfidence: "high" } as never, startTime: Date.now(), auth: {} as never, yelpClient: {} as never, gigsaladClient: {} as never },
      { updateLead: (await import("./db/leads.js")).updateLead, sendSms: async () => ({ success: true }), logLead: () => {}, dispatchReply: (async () => { throw new Error("must not send"); }) as never, completeApproval: (() => { throw new Error("must not complete"); }) as never },
    );
    const after = getLeadByMessageId("hold-s3");
    assert.ok(after);
    assert.equal(after.status, "sent");
    assert.equal(after.done_reason, "review-only: would-auto-send via squarespace");
    assert.equal(after.hold_reason, null);
  });

  it("S4 an unfinished 'received' row for the message is resumed (same row id, one row) and then gets the reason", async () => {
    const pre = insertLead({ raw_email: "half done", source_platform: "yelp", mailgun_message_id: "hold-s4" });
    assert.equal(pre.status, "received");
    await processLead(yelpMsg("hold-s4"), cfg, {} as never, yelpClient, {} as never, { runPipeline });
    const row = getLeadByMessageId("hold-s4");
    assert.ok(row);
    assert.equal(row.id, pre.id);
    assert.equal(count("hold-s4"), 1);
    assert.equal(row.status, "sent");
    assert.equal(row.hold_reason, YELP_REASON);
  });

  it("S5 a low-confidence lead keeps its own path: 'failed' + error_message, and NO hold reason", async () => {
    await processLead(yelpMsg("hold-s5", "San Diego"), cfg, {} as never, yelpClient, {} as never, { runPipeline: mustNotRun });
    const row = getLeadByMessageId("hold-s5");
    assert.ok(row);
    assert.equal(row.status, "failed");
    assert.match(row.error_message ?? "", /Low parse confidence/);
    assert.equal(row.hold_reason, null);
  });
});
