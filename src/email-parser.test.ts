import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseEmail } from "./email-parser.js";

// --- Synthetic fixtures based on confirmed real formats ---

const GIGSALAD_FIELDS = {
  from: "GigSalad Leads <leads@gigsalad.com>",
  subject: "New lead (03/19/2026 in San Diego, CA)",
  "body-plain":
    "Eilynn would like a quote for a Funeral/Memorial Service on March 19, 2026.\n\nView the details and reply on GigSalad.",
  "body-html":
    '<p>Eilynn would like a quote for a Funeral/Memorial Service on March 19, 2026.</p>' +
    '<a href="https://www.gigsalad.com/leads/abc123?token=xyz">View the details &amp; reply</a>',
  "Message-Id": "<abc123@gigsalad.com>",
};

const THEBASH_FIELDS = {
  from: "The Bash <info@thebash.com>",
  subject: "Gig Alert: Anniversary Party Lead! (Gig ID #4980144)",
  "body-plain":
    "You have a new gig alert!\n\nAnniversary Party\nSaturday, February 28, 2026\n\nView now on The Bash.",
  "body-html":
    "<table><tr><td>EVENT DATE:</td><td>Saturday, February 28, 2026</td></tr></table>" +
    '<a href="https://www.thebash.com/gig/4980144?ref=alert">VIEW NOW</a>',
  "Message-Id": "<def456@thebash.com>",
};

// --- GigSalad tests ---

describe("parseEmail — GigSalad", () => {
  it("extracts all fields from a valid lead email", () => {
    const result = parseEmail(GIGSALAD_FIELDS);
    assert.equal(result.ok, true);
    if (!result.ok) return;

    assert.equal(result.lead.platform, "gigsalad");
    assert.equal(result.lead.external_id, "<abc123@gigsalad.com>");
    assert.equal(result.lead.event_type, "Funeral/Memorial Service");
    assert.equal(result.lead.event_date, "March 19, 2026");
    assert.equal(result.lead.location, "San Diego, CA");
    assert.equal(result.lead.token_url, "https://www.gigsalad.com/leads/abc123?token=xyz");
    assert.ok(result.lead.raw_text.includes("Eilynn"));
  });

  it("skips noreply@gigsalad.com emails", () => {
    const result = parseEmail({
      ...GIGSALAD_FIELDS,
      from: "GigSalad <noreply@gigsalad.com>",
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "skip");
    assert.ok(result.detail.includes("noreply"));
  });

  it("returns parse_error when Message-Id is missing", () => {
    const { "Message-Id": _, ...noMessageId } = GIGSALAD_FIELDS;
    const result = parseEmail(noMessageId as any);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "parse_error");
    assert.ok(result.detail.includes("Message-Id"));
  });

  it("returns parse_error when body has no event_type match", () => {
    const result = parseEmail({
      ...GIGSALAD_FIELDS,
      "body-plain": "Some unrelated email body with no quote request.",
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "parse_error");
    assert.ok(result.detail.includes("event_type"));
  });

  it("handles 'an' article before event type", () => {
    const result = parseEmail({
      ...GIGSALAD_FIELDS,
      "body-plain":
        "Eilynn would like a quote for an Anniversary Party on March 19, 2026.\n\nView the details.",
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.lead.event_type, "Anniversary Party");
  });

  it("handles subject without location gracefully", () => {
    const result = parseEmail({
      ...GIGSALAD_FIELDS,
      subject: "New lead (03/19/2026)",
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.lead.location, undefined);
  });
});

// --- The Bash tests ---

describe("parseEmail — The Bash", () => {
  it("extracts all fields from a valid Gig Alert email", () => {
    const result = parseEmail(THEBASH_FIELDS);
    assert.equal(result.ok, true);
    if (!result.ok) return;

    assert.equal(result.lead.platform, "thebash");
    assert.equal(result.lead.external_id, "4980144");
    assert.equal(result.lead.event_type, "Anniversary Party");
    assert.equal(result.lead.event_date, "Saturday, February 28, 2026");
    assert.equal(result.lead.token_url, "https://www.thebash.com/gig/4980144?ref=alert");
    assert.ok(result.lead.raw_text.includes("gig alert"));
    assert.equal(result.lead.location, undefined);
  });

  it("skips The Bash emails without Gig Alert in subject", () => {
    const result = parseEmail({
      ...THEBASH_FIELDS,
      subject: "Your booking confirmation #12345",
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "skip");
    assert.ok(result.detail.includes("Gig Alert"));
  });

  it("parses Birthday Party (Adult) with parentheses in event_type", () => {
    const result = parseEmail({
      ...THEBASH_FIELDS,
      subject: "Gig Alert: Birthday Party (Adult) Lead! (Gig ID #4979625)",
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.lead.event_type, "Birthday Party (Adult)");
    assert.equal(result.lead.external_id, "4979625");
  });

  it("parses Funeral with single-word event type", () => {
    const result = parseEmail({
      ...THEBASH_FIELDS,
      subject: "Gig Alert: Funeral Lead! (Gig ID #4984318)",
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.lead.event_type, "Funeral");
    assert.equal(result.lead.external_id, "4984318");
  });

  it("returns parse_error when Gig ID is missing from subject", () => {
    const result = parseEmail({
      ...THEBASH_FIELDS,
      subject: "Gig Alert: Wedding Lead!",
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "parse_error");
    assert.ok(result.detail.includes("Gig ID"));
  });

  it("EVENT DATE regex does not backtrack on malicious input", () => {
    // Regression test for March 5 ReDoS fix (finding 001).
    // Input that caused a 27-second hang with the old .*? pattern.
    const maliciousHtml =
      "EVENT DATE:" + "<td".repeat(10_000);
    const result = parseEmail({
      ...THEBASH_FIELDS,
      "body-html": maliciousHtml,
    });
    // Must return quickly (parse_error, not hang). If this test times out,
    // the regex has regressed to a backtracking-vulnerable pattern.
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.reason, "parse_error");
    }
  });
});

// --- ReDoS regression tests ---
// All patterns are safe by construction (single quantifiers, negated character
// classes), but these tests guard against future regex changes that could
// introduce catastrophic backtracking. Each input targets the specific
// quantifier structure of its pattern. If any test hangs, the regex has
// regressed to a vulnerable pattern.

describe("parseEmail — ReDoS regression", () => {
  it("event_type regex (.+?) does not backtrack on repeated ' on' near-matches", () => {
    // Pattern: /would like a quote for (?:a |an )?(.+?) on/i
    // .+? before " on" — input has many " on" occurrences
    const result = parseEmail({
      ...GIGSALAD_FIELDS,
      "body-plain": "would like a quote for " + "x on".repeat(10_000),
    });
    // May match first "x on" quickly or fail — either way, must not hang
    assert.equal(typeof result.ok, "boolean");
  });

  it("event_date regex does not backtrack on repeated near-match dates", () => {
    // Pattern: /on ([A-Z][a-z]+ \d+, \d{4})\./
    // Disjoint character classes — inherently safe, but guard the property
    const result = parseEmail({
      ...GIGSALAD_FIELDS,
      "body-plain":
        "would like a quote for a Wedding on March 19, 2026.\n" +
        "on " + "January 1".repeat(10_000),
    });
    assert.equal(typeof result.ok, "boolean");
  });

  it("location regex (.+) does not backtrack on long subject without ')'", () => {
    // Pattern: /in (.+)\)/
    // Single greedy .+ without ) — linear backward scan, not exponential
    const result = parseEmail({
      ...GIGSALAD_FIELDS,
      subject: "New lead (03/19/2026 in " + "a".repeat(50_000),
    });
    assert.equal(typeof result.ok, "boolean");
  });

  it("GigSalad token_url regex does not backtrack on many HTML attributes", () => {
    // Pattern: /<a[^>]+href="([^"]+)"[^>]*>[^<]*View the details/i
    // Negated char classes [^>], [^"], [^<] — inherently safe
    const maliciousHtml = "<a " + 'x="y" '.repeat(10_000) + 'href="';
    const result = parseEmail({
      ...GIGSALAD_FIELDS,
      "body-html": maliciousHtml,
    });
    assert.equal(result.ok, false);
  });

  it("Gig Alert event_type regex (.+?) does not backtrack on repeated ' Lead' near-matches", () => {
    // Pattern: /Gig Alert: (.+?) Lead!/
    // .+? before " Lead!" — input has " Lead" without "!" many times
    const result = parseEmail({
      ...THEBASH_FIELDS,
      subject: "Gig Alert: " + "x Lead".repeat(10_000) + " (Gig ID #123)",
    });
    assert.equal(typeof result.ok, "boolean");
  });
});

// --- Unknown sender ---

describe("parseEmail — unknown sender", () => {
  it("skips emails from unknown senders", () => {
    const result = parseEmail({
      ...GIGSALAD_FIELDS,
      from: "someone@example.com",
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "skip");
    assert.ok(result.detail.includes("Unknown sender"));
  });
});
