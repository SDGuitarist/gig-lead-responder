import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { shapeLead } from "./utils/shape-lead.js";
import type { LeadRecord } from "./types.js";

function makeLeadRecord(overrides: Partial<LeadRecord> = {}): LeadRecord {
  return {
    id: 1,
    source_platform: "gigsalad",
    mailgun_message_id: "msg-1",
    raw_email: "Lead text",
    client_name: "Sarah",
    event_date: null,
    event_type: null,
    venue: null,
    guest_count: null,
    budget_note: null,
    status: "done",
    classification_json: null,
    pricing_json: null,
    full_draft: "Hi Sarah, ...",
    compressed_draft: "Hi Sarah, ...",
    gate_passed: true,
    gate_json: null,
    confidence_score: 80,
    error_message: null,
    pipeline_completed_at: null,
    sms_sent_at: null,
    edit_round: 0,
    edit_instructions: null,
    done_reason: null,
    outcome: null,
    outcome_reason: null,
    actual_price: null,
    outcome_at: null,
    follow_up_status: null,
    follow_up_count: 0,
    follow_up_due_at: null,
    follow_up_draft: null,
    snoozed_until: null,
    created_at: "2026-05-31T00:00:00Z",
    updated_at: "2026-05-31T00:00:00Z",
    ...overrides,
  };
}

describe("shapeLead — done_reason", () => {
  it("returns done_reason when set", () => {
    const lead = makeLeadRecord({ done_reason: "auto-sent via gigsalad" });
    const shaped = shapeLead(lead);
    assert.equal(shaped.done_reason, "auto-sent via gigsalad");
  });

  it("returns null when done_reason is null", () => {
    const lead = makeLeadRecord({ done_reason: null });
    const shaped = shapeLead(lead);
    assert.equal(shaped.done_reason, null);
  });

  it("returns null when done_reason is undefined", () => {
    const lead = makeLeadRecord();
    delete (lead as any).done_reason;
    const shaped = shapeLead(lead);
    assert.equal(shaped.done_reason, null);
  });

  it("preserves review-only done_reason", () => {
    const lead = makeLeadRecord({ done_reason: "review-only: would-auto-send via gigsalad" });
    const shaped = shapeLead(lead);
    assert.equal(shaped.done_reason, "review-only: would-auto-send via gigsalad");
  });
});
