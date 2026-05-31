import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Mirrors browser formatDoneReason() from dashboard.html — keep in sync manually.
// Returns raw text (not HTML). Caller escapes at interpolation site.
function formatDoneReason(reason: string | null): string {
  if (!reason) return '';
  if (reason.startsWith('auto-sent')) return 'auto-sent';
  if (reason.startsWith('review-only')) return 'review-only';
  if (reason === 'approved_dashboard') return 'approved';
  if (reason === 'approved') return 'approved (SMS)';
  if (reason === 'max_edits') return 'max edits';
  if (reason === 'pipeline_error') return 'error';
  return reason; // fallback: raw string — caller escapes via esc()
}

// Mirrors browser shouldShowDoneReason() from dashboard.html — keep in sync manually.
function shouldShowDoneReason(l: { done_reason: string | null; status: string }): boolean {
  return !!l.done_reason && (l.status === 'done' || l.status === 'failed' || l.status === 'sent');
}

describe("formatDoneReason", () => {
  it('returns "" for null', () => {
    assert.equal(formatDoneReason(null), '');
  });

  it('returns "" for empty string', () => {
    assert.equal(formatDoneReason(''), '');
  });

  it('returns "auto-sent" for "auto-sent via gigsalad"', () => {
    assert.equal(formatDoneReason('auto-sent via gigsalad'), 'auto-sent');
  });

  it('returns "auto-sent" for "auto-sent via thebash"', () => {
    assert.equal(formatDoneReason('auto-sent via thebash'), 'auto-sent');
  });

  it('returns "review-only" for review-only done_reason', () => {
    assert.equal(
      formatDoneReason('review-only: would-auto-send via gigsalad'),
      'review-only',
    );
  });

  it('returns "approved" for "approved_dashboard"', () => {
    assert.equal(formatDoneReason('approved_dashboard'), 'approved');
  });

  it('returns "approved (SMS)" for "approved"', () => {
    assert.equal(formatDoneReason('approved'), 'approved (SMS)');
  });

  it('returns "max edits" for "max_edits"', () => {
    assert.equal(formatDoneReason('max_edits'), 'max edits');
  });

  it('returns "error" for "pipeline_error"', () => {
    assert.equal(formatDoneReason('pipeline_error'), 'error');
  });

  it("returns raw string for unknown values (caller must escape)", () => {
    assert.equal(formatDoneReason('some_future_reason'), 'some_future_reason');
  });

  it("returns raw XSS payload for unknown values (caller must escape)", () => {
    const xss = '<script>alert(1)</script>';
    assert.equal(formatDoneReason(xss), xss);
  });
});

describe("shouldShowDoneReason", () => {
  it("returns true for done status with done_reason", () => {
    assert.equal(shouldShowDoneReason({ done_reason: "approved", status: "done" }), true);
  });

  it("returns true for sent status with done_reason", () => {
    assert.equal(shouldShowDoneReason({ done_reason: "review-only: ...", status: "sent" }), true);
  });

  it("returns true for failed status with done_reason", () => {
    assert.equal(shouldShowDoneReason({ done_reason: "pipeline_error", status: "failed" }), true);
  });

  it("returns false for received status with done_reason", () => {
    assert.equal(shouldShowDoneReason({ done_reason: "some_reason", status: "received" }), false);
  });

  it("returns false for sending status with done_reason", () => {
    assert.equal(shouldShowDoneReason({ done_reason: "some_reason", status: "sending" }), false);
  });

  it("returns false when done_reason is null", () => {
    assert.equal(shouldShowDoneReason({ done_reason: null, status: "done" }), false);
  });

  it("returns false when done_reason is empty string", () => {
    assert.equal(shouldShowDoneReason({ done_reason: "", status: "done" }), false);
  });
});
