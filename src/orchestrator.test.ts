import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { handleAutoSendDecision, type AutoSendDeps } from "./automation/orchestrator.js";
import type { AutomationConfig } from "./automation/config.js";
import type { PipelineOutput } from "./types.js";
import type { ParsedLead, SendResult } from "./automation/types.js";
import type { LeadLogEntry } from "./automation/logger.js";
import type { OAuth2Client } from "google-auth-library";

// --- Fakes ---

function fakeConfig(overrides: Partial<AutomationConfig> = {}): AutomationConfig {
  return {
    dryRun: false,
    autoSendEnabled: false,
    gmail: { credentialsPath: "", tokenPath: "" },
    twilio: { accountSid: "", authToken: "", fromNumber: "", toNumber: "" },
    portalCredentials: {
      gigsalad: { email: "", password: "" },
      yelp: { email: "", password: "" },
    },
    edgeCaseBudgetThreshold: 3000,
    logPath: "/dev/null",
    pollIntervalMs: 60000,
    ...overrides,
  };
}

function fakeLead(): ParsedLead {
  return {
    platform: "gigsalad",
    portalUrl: "https://example.com/lead/1",
    rawText: "Looking for a guitarist",
    parseConfidence: "high",
    parseWarnings: [],
    gmailMessageId: "msg-1",
    threadId: "thread-1",
    messageIdHeader: "<msg-1@gmail>",
    receivedAt: new Date(),
  };
}

function fakeOutput(): PipelineOutput {
  return {
    classification: {
      mode: "evaluation",
      action: "quote",
      vagueness: "clear",
      competition_level: "medium",
      competition_quote_count: 3,
      stealth_premium: false,
      stealth_premium_signals: [],
      tier: "standard",
      rate_card_tier: "T2",
      lead_source_column: "P",
      price_point: "slight_premium",
      format_requested: "guitarist",
      format_recommended: "solo",
      duration_hours: 2,
      stated_budget: null,
      timeline_band: "comfortable",
      close_type: "soft_hold",
      cultural_context_active: false,
      cultural_tradition: null,
      planner_effort_active: false,
      social_proof_active: false,
      context_modifiers: [],
      event_date_iso: null,
      event_energy: null,
      flagged_concerns: [],
      venue_name: null,
      client_first_name: "Sarah",
    },
    pricing: {
      format: "solo",
      duration_hours: 2,
      tier_key: "T2P",
      anchor: 950,
      floor: 750,
      quote_price: 850,
      competition_position: "slight premium",
      budget: { tier: "none" },
    },
    drafts: {
      full_draft: "Hi Sarah, great event...",
      compressed_draft: "Hi Sarah, I'm available. Alex Guillen",
      compressed_word_count: 7,
    },
    gate: {
      validation_line: "You've got a great eye",
      best_line: "great event",
      concern_traceability: [],
      scene_quote: "",
      scene_type: "structural",
      competitor_test: false,
      gut_checks: {
        can_see_it: true, validated_them: true, named_fear: false,
        differentiated: true, preempted_questions: false, creates_relief: false,
        best_line_present: true, prose_flows: true, competitor_test: false,
        lead_specific_opening: true, budget_acknowledged: false,
        past_date_acknowledged: false, mariachi_pricing_format: false,
        cultural_vocabulary_used: false, sounds_like_alex: true,
        genre_default_stated: false, timeline_acknowledged: false,
        compressed_validation_present: false,
      },
      gate_status: "pass",
      fail_reasons: [],
    },
    verified: true,
    timing: { total: 100, classify: 50 },
    confidence_score: 80,
  };
}

// --- Spy helpers ---

function createSpyDeps() {
  const updateLeadCalls: Array<{ id: number; fields: Record<string, unknown> }> = [];
  const smsCalls: string[] = [];
  const logLeadCalls: LeadLogEntry[] = [];
  let dispatchReplyCalled = false;
  const completeApprovalCalls: Array<{ leadId: number; doneReason: string; smsSentAt?: string }> = [];

  const deps: AutoSendDeps = {
    updateLead: (id, fields) => { updateLeadCalls.push({ id, fields }); },
    sendSms: async (_config, msg) => { smsCalls.push(msg); },
    logLead: (entry) => { logLeadCalls.push(entry); },
    dispatchReply: async () => {
      dispatchReplyCalled = true;
      return { status: "sent", platform: "gigsalad", timestamp: new Date() } as SendResult;
    },
    completeApproval: (leadId, doneReason, smsSentAt) => {
      completeApprovalCalls.push({ leadId, doneReason, smsSentAt });
    },
  };

  return { deps, updateLeadCalls, smsCalls, logLeadCalls, completeApprovalCalls, isDispatchCalled: () => dispatchReplyCalled };
}

function baseOpts(configOverrides: Partial<AutomationConfig> = {}) {
  return {
    config: fakeConfig(configOverrides),
    leadId: 42,
    platform: "gigsalad",
    msgId: "msg-1",
    output: fakeOutput(),
    lead: fakeLead(),
    startTime: Date.now(),
    auth: {} as OAuth2Client,
    yelpClient: {} as any,
    gigsaladClient: {} as any,
  };
}

// ── Review-only mode (autoSendEnabled=false) ──

describe("handleAutoSendDecision — review-only mode", () => {
  it("does NOT call dispatchReply when autoSendEnabled=false", async () => {
    const { deps, isDispatchCalled } = createSpyDeps();
    await handleAutoSendDecision(
      baseOpts({ autoSendEnabled: false }),
      deps,
    );
    assert.equal(isDispatchCalled(), false);
  });

  it('stores lead with status "sent" and review-only done_reason', async () => {
    const { deps, updateLeadCalls } = createSpyDeps();
    await handleAutoSendDecision(
      baseOpts({ autoSendEnabled: false }),
      deps,
    );
    assert.equal(updateLeadCalls.length, 1);
    assert.equal(updateLeadCalls[0].id, 42);
    assert.equal(updateLeadCalls[0].fields.status, "sent");
    assert.ok(
      (updateLeadCalls[0].fields.done_reason as string).includes("review-only: would-auto-send"),
    );
  });

  it("sends REVIEW SMS when dryRun=false", async () => {
    const { deps, smsCalls } = createSpyDeps();
    await handleAutoSendDecision(
      baseOpts({ autoSendEnabled: false, dryRun: false }),
      deps,
    );
    assert.equal(smsCalls.length, 1);
    assert.ok(smsCalls[0].startsWith("REVIEW:"));
    assert.ok(smsCalls[0].includes("auto-send suppressed"));
  });

  it("does NOT send SMS when dryRun=true", async () => {
    const { deps, smsCalls } = createSpyDeps();
    await handleAutoSendDecision(
      baseOpts({ autoSendEnabled: false, dryRun: true }),
      deps,
    );
    assert.equal(smsCalls.length, 0);
  });

  it('logs with status "review-only" when dryRun=false', async () => {
    const { deps, logLeadCalls } = createSpyDeps();
    await handleAutoSendDecision(
      baseOpts({ autoSendEnabled: false, dryRun: false }),
      deps,
    );
    assert.equal(logLeadCalls.length, 1);
    assert.equal(logLeadCalls[0].status, "review-only");
  });

  it('logs with status "dry-run" when dryRun=true', async () => {
    const { deps, logLeadCalls } = createSpyDeps();
    await handleAutoSendDecision(
      baseOpts({ autoSendEnabled: false, dryRun: true }),
      deps,
    );
    assert.equal(logLeadCalls.length, 1);
    assert.equal(logLeadCalls[0].status, "dry-run");
  });
});

// ── Auto-send mode (autoSendEnabled=true) ──

describe("handleAutoSendDecision — auto-send mode", () => {
  it("calls dispatchReply when autoSendEnabled=true and dryRun=false", async () => {
    const { deps, isDispatchCalled } = createSpyDeps();
    await handleAutoSendDecision(
      baseOpts({ autoSendEnabled: true, dryRun: false }),
      deps,
    );
    assert.equal(isDispatchCalled(), true);
  });

  it("calls completeApproval with auto-sent done_reason after successful dispatch", async () => {
    const { deps, completeApprovalCalls } = createSpyDeps();
    await handleAutoSendDecision(
      baseOpts({ autoSendEnabled: true, dryRun: false }),
      deps,
    );
    assert.equal(completeApprovalCalls.length, 1);
    assert.equal(completeApprovalCalls[0].leadId, 42);
    assert.ok(completeApprovalCalls[0].doneReason.includes("auto-sent via"));
    assert.ok(completeApprovalCalls[0].smsSentAt); // timestamp provided
  });

  it("does NOT call dispatchReply when dryRun=true", async () => {
    const { deps, isDispatchCalled } = createSpyDeps();
    await handleAutoSendDecision(
      baseOpts({ autoSendEnabled: true, dryRun: true }),
      deps,
    );
    assert.equal(isDispatchCalled(), false);
  });
});
