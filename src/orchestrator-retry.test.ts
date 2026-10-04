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
  // A first pipeline failure now rethrows so the poller retries it (Alex 2026-10-04).
  await assert.rejects(processLead(gigsalad("retry-1"), config, {} as never, {} as never, {} as never, {
    runPipeline: (async () => {
      calls++;
      throw new Error("stop after resume");
    }) as never,
  }), /stop after resume/);
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

// Codex round 1 (Phase 0 runtime), finding 1: a pipeline failure was marked failed and
// processed at once, so it was never retried. Alex 2026-10-04: retry once, then hold.
const statusOf = (id: string) =>
  initDb().prepare("SELECT status, error_message, pipeline_completed_at FROM leads WHERE mailgun_message_id = ?").get(id) as
    { status: string; error_message: string | null; pipeline_completed_at: string | null };

test("pipeline failure retried once: the first failure rethrows and leaves the lead retryable", async () => {
  let calls = 0;
  const failing = { runPipeline: (async () => { calls++; throw new Error("model timeout"); }) as never };
  await assert.rejects(processLead(gigsalad("pf-1"), config, {} as never, {} as never, {} as never, failing), /model timeout/);
  assert.equal(calls, 1);
  assert.equal(isEmailProcessed("pf-1"), false, "not marked done, so the next poll retries it");
  assert.equal(statusOf("pf-1").status, "received");
  assert.equal(statusOf("pf-1").pipeline_completed_at, null);

  // Second attempt: the pipeline runs again on the same row; failing again is final.
  await processLead(gigsalad("pf-1"), config, {} as never, {} as never, {} as never, failing);
  assert.equal(calls, 2, "the retry reran the pipeline");
  assert.equal(rowsFor("pf-1").length, 1, "one lead row");
  assert.equal(statusOf("pf-1").status, "failed");
  assert.equal(isEmailProcessed("pf-1"), true);

  // Overshoot control: a terminal failure is not retried again.
  await processLead(gigsalad("pf-1"), config, {} as never, {} as never, {} as never, failing);
  assert.equal(calls, 2, "no third run");
});

test("pipeline failure retried once: a retry that succeeds clears the failure note", async () => {
  const { GUT_CHECK_KEYS } = await import("./types.js");
  const output = {
    classification: { mode: "evaluation", action: "quote", vagueness: "clear", competition_level: "medium",
      competition_quote_count: 0, stealth_premium: false, stealth_premium_signals: [], tier: "standard",
      rate_card_tier: "T2", lead_source_column: "P", price_point: "slight_premium", format_requested: "guitarist",
      format_recommended: "solo", duration_hours: 2, stated_budget: null, timeline_band: "comfortable",
      close_type: "soft_hold", cultural_context_active: false, cultural_tradition: null, planner_effort_active: false,
      social_proof_active: false, context_modifiers: [], event_date_iso: null, event_energy: null,
      flagged_concerns: [], venue_name: null, client_first_name: "Sarah" },
    pricing: { format: "solo", duration_hours: 2, tier_key: "T2P", anchor: 595, floor: 550, quote_price: 595,
      competition_position: "at anchor", budget: { tier: "none" } },
    drafts: { full_draft: "Hi Sarah", compressed_draft: "Hi Sarah. Alex Guillen", compressed_word_count: 4,
      strategic_reserve: ["Her sister is the maid of honor and sings"] },
    gate: { validation_line: "", best_line: "", concern_traceability: [], scene_quote: "", scene_type: "structural",
      competitor_test: true, gut_checks: Object.fromEntries(GUT_CHECK_KEYS.map((k) => [k, true])),
      gate_status: "pass", fail_reasons: [] },
    verified: true, timing: { total: 1 }, confidence_score: 80,
  };
  let calls = 0;
  const flaky = { runPipeline: (async () => { calls++; if (calls === 1) throw new Error("blip"); return output; }) as never };
  await assert.rejects(processLead(gigsalad("pf-ok"), config, {} as never, {} as never, {} as never, flaky), /blip/);
  assert.match(statusOf("pf-ok").error_message ?? "", /^pipeline attempt 1 failed: blip/, "control: the note is written");
  await processLead(gigsalad("pf-ok"), config, {} as never, {} as never, {} as never, flaky);
  assert.equal(calls, 2);
  assert.equal(statusOf("pf-ok").error_message, null);
  // Port manifest R018: the poller path saves the reserve on the lead.
  const saved = initDb().prepare("SELECT strategic_reserve_json AS r FROM leads WHERE mailgun_message_id = ?").get("pf-ok") as { r: string };
  assert.equal(saved.r, '["Her sister is the maid of honor and sings"]');
  assert.ok(statusOf("pf-ok").pipeline_completed_at);
  assert.equal(isEmailProcessed("pf-ok"), true);
});
