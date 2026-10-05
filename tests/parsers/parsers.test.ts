/**
 * Parser fixture tests.
 *
 * The "real fixture" tests skip until a captured email exists in
 * examples/emails/. To add one:
 *   1. Forward a real lead email to yourself
 *   2. Use Gmail API to fetch the raw message as JSON
 *   3. Save to examples/emails/gigsalad-001.json (strip personal info)
 */
import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { parseGigSaladEmail } from "../../src/automation/parsers/gigsalad.js";
import { parseGigSaladEmailKey } from "../../src/automation/portals/gigsalad-match.js";
import { parseYelpEmail } from "../../src/automation/parsers/yelp.js";
import { parseSquarespaceEmail } from "../../src/automation/parsers/squarespace.js";
import { existsSync, readFileSync } from "node:fs";
import type { GmailMessage } from "../../src/automation/gmail-watcher.js";

function loadFixture(t: TestContext, path: string): GmailMessage | null {
  if (!existsSync(path)) {
    t.skip(`Fixture not found: ${path} — capture a real email first`);
    return null;
  }
  return JSON.parse(readFileSync(path, "utf-8"));
}

// --- GigSalad Tests ---
test("parses mock GigSalad email with all fields", () => {
  const msg: GmailMessage = {
    id: "gs-001", threadId: "t-001",
    from: "GigSalad <leads@gigsalad.com>", to: "test@test.com",
    subject: "New Lead: Wedding in San Diego", date: "2026-03-29T10:00:00Z",
    replyTo: "", messageIdHeader: "<abc@gigsalad.com>",
    authenticationResults: "spf=pass dkim=pass",
    bodyText: "Event Type: Wedding\nDate: April 15, 2026\nLocation: San Diego, CA\nBudget: $500\nGuest Count: 80\nGenre Request: Spanish guitar\nMessage: Looking for a guitarist.",
    bodyHtml: '<a href="https://www.gigsalad.com/leads/respond/12345">Respond</a>',
  };
  const result = parseGigSaladEmail(msg);
  assert.ok(result.platform === "gigsalad", "platform should be gigsalad");
  assert.ok(result.parseConfidence === "high", `confidence should be high, got ${result.parseConfidence}`);
  assert.ok(result.portalUrl.includes("gigsalad.com"), "should extract portal URL");
  assert.ok(result.rawText.includes("Wedding"), "rawText should contain event type");
});

test("returns low confidence for empty body", () => {
  const msg: GmailMessage = {
    id: "gs-002", threadId: "t-002",
    from: "GigSalad <leads@gigsalad.com>", to: "test@test.com",
    subject: "New Lead", date: "2026-03-29T10:00:00Z",
    replyTo: "", messageIdHeader: "", authenticationResults: "",
    bodyText: "", bodyHtml: "",
  };
  const result = parseGigSaladEmail(msg);
  assert.ok(result.parseConfidence === "low", "empty body should be low confidence");
});

// Real GigSalad lead email (decided 2026-10-04, Alex: option A). The email holds only the
// client's first name, event type, date and time plus tracking links, so the email parser
// rates it low ON PURPOSE; the details come from the lead page (orchestrator step 4b,
// src/automation/portals/gigsalad-enrich.ts). What the email must give is the match key.
test("real GigSalad fixture: the email is low on its own and gives the match key for the page", (t) => {
  const msg = loadFixture(t, "examples/emails/gigsalad-001.json");
  if (!msg) return;
  assert.equal(parseGigSaladEmail(msg).parseConfidence, "low");
  assert.deepEqual(parseGigSaladEmailKey(msg.bodyText || msg.bodyHtml),
    { firstName: "Client", eventType: "Birthday Party", dateISO: "2026-08-01", timeWindow: "6:00 PM-9:00 PM" });
});

// --- Yelp Tests ---
test("always returns low confidence (truncated email)", () => {
  const msg: GmailMessage = {
    id: "y-001", threadId: "t-003",
    from: "Yelp <no-reply@yelp.com>", to: "test@test.com",
    subject: "New message from Sarah M.", date: "2026-03-29T11:00:00Z",
    replyTo: "", messageIdHeader: "", authenticationResults: "",
    bodyText: "Sarah M. sent you a message\nHi, I need a guitarist\nView message",
    bodyHtml: '<a href="https://biz.yelp.com/message/abc">View</a>',
  };
  const result = parseYelpEmail(msg);
  assert.ok(result.platform === "yelp", "platform should be yelp");
  assert.ok(result.parseConfidence === "low", "Yelp should always be low until enriched");
  assert.ok(result.enriched === false, "should not be enriched from email alone");
});

test("parses real Yelp fixture", (t) => {
  const msg = loadFixture(t, "examples/emails/yelp-001.json");
  if (!msg) return;
  const result = parseYelpEmail(msg);
  assert.ok(result.parseConfidence === "low", "Yelp fixture should still be low (needs portal)");
});

// --- Squarespace Tests ---
test("extracts client email from Reply-To header", () => {
  const msg: GmailMessage = {
    id: "sq-001", threadId: "t-004",
    from: "Squarespace <form-submission@squarespace.com>", to: "test@test.com",
    subject: "Form Submission", date: "2026-03-29T12:00:00Z",
    replyTo: "client@example.com", messageIdHeader: "", authenticationResults: "",
    bodyText: "Name: John Smith\nEmail: client@example.com\nMessage: Need a guitarist for our event.",
    bodyHtml: "",
  };
  const result = parseSquarespaceEmail(msg);
  assert.ok(result.platform === "squarespace", "platform should be squarespace");
  assert.ok(result.clientEmail === "client@example.com", `clientEmail should be client@example.com, got ${result.clientEmail}`);
  assert.ok(result.parseConfidence === "high", "should be high with Reply-To present");
});

test("returns low confidence without Reply-To", () => {
  const msg: GmailMessage = {
    id: "sq-002", threadId: "t-005",
    from: "Squarespace <form-submission@squarespace.com>", to: "test@test.com",
    subject: "Form Submission", date: "2026-03-29T12:00:00Z",
    replyTo: "", messageIdHeader: "", authenticationResults: "",
    bodyText: "Name: Someone\nMessage: Hello", bodyHtml: "",
  };
  const result = parseSquarespaceEmail(msg);
  assert.ok(result.parseConfidence === "low", "missing Reply-To should be low confidence");
});

test("parses real Squarespace fixture", (t) => {
  const msg = loadFixture(t, "examples/emails/squarespace-001.json");
  if (!msg) return;
  const result = parseSquarespaceEmail(msg);
  assert.ok(result.parseConfidence !== "low", "real fixture should not be low confidence");
});
