/**
 * Parser fixture tests — scaffold.
 *
 * STATUS: Scaffold only. Real fixtures (captured emails) must be added to
 * examples/emails/ before these tests can pass. Each test currently skips
 * with a message explaining what fixture is needed.
 *
 * Run with: npx tsx tests/parsers/parser-tests.ts
 *
 * To add a fixture:
 *   1. Forward a real lead email to yourself
 *   2. Use Gmail API to fetch the raw message as JSON
 *   3. Save to examples/emails/gigsalad-001.json (strip personal info)
 *   4. Update the fixture path in the corresponding test below
 */
import { parseGigSaladEmail } from "../../src/automation/parsers/gigsalad.js";
import { parseYelpEmail } from "../../src/automation/parsers/yelp.js";
import { parseSquarespaceEmail } from "../../src/automation/parsers/squarespace.js";
import { existsSync, readFileSync } from "node:fs";
import type { GmailMessage } from "../../src/automation/gmail-watcher.js";

let passed = 0;
let skipped = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  PASS: ${name}`);
    passed++;
  } catch (err) {
    if (err instanceof SkipError) {
      console.log(`  SKIP: ${name} — ${err.message}`);
      skipped++;
    } else {
      console.error(`  FAIL: ${name} — ${err instanceof Error ? err.message : err}`);
      failed++;
    }
  }
}

class SkipError extends Error {}
function skip(reason: string): never { throw new SkipError(reason); }

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`Assertion failed: ${msg}`);
}

function loadFixture(path: string): GmailMessage {
  if (!existsSync(path)) {
    skip(`Fixture not found: ${path} — capture a real email first`);
  }
  return JSON.parse(readFileSync(path, "utf-8"));
}

// --- GigSalad Tests ---
console.log("\nGigSalad Parser:");

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
  assert(result.platform === "gigsalad", "platform should be gigsalad");
  assert(result.parseConfidence === "high", `confidence should be high, got ${result.parseConfidence}`);
  assert(result.portalUrl.includes("gigsalad.com"), "should extract portal URL");
  assert(result.rawText.includes("Wedding"), "rawText should contain event type");
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
  assert(result.parseConfidence === "low", "empty body should be low confidence");
});

test("parses real GigSalad fixture", () => {
  const msg = loadFixture("examples/emails/gigsalad-001.json");
  const result = parseGigSaladEmail(msg);
  assert(result.parseConfidence !== "low", "real fixture should not be low confidence");
});

// --- Yelp Tests ---
console.log("\nYelp Parser:");

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
  assert(result.platform === "yelp", "platform should be yelp");
  assert(result.parseConfidence === "low", "Yelp should always be low until enriched");
  assert(result.enriched === false, "should not be enriched from email alone");
});

test("parses real Yelp fixture", () => {
  const msg = loadFixture("examples/emails/yelp-001.json");
  const result = parseYelpEmail(msg);
  assert(result.parseConfidence === "low", "Yelp fixture should still be low (needs portal)");
});

// --- Squarespace Tests ---
console.log("\nSquarespace Parser:");

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
  assert(result.platform === "squarespace", "platform should be squarespace");
  assert(result.clientEmail === "client@example.com", `clientEmail should be client@example.com, got ${result.clientEmail}`);
  assert(result.parseConfidence === "high", "should be high with Reply-To present");
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
  assert(result.parseConfidence === "low", "missing Reply-To should be low confidence");
});

test("parses real Squarespace fixture", () => {
  const msg = loadFixture("examples/emails/squarespace-001.json");
  const result = parseSquarespaceEmail(msg);
  assert(result.parseConfidence !== "low", "real fixture should not be low confidence");
});

// --- Summary ---
console.log(`\n${"=".repeat(40)}`);
console.log(`Results: ${passed} passed, ${skipped} skipped, ${failed} failed`);
if (skipped > 0) {
  console.log(`\nSkipped tests need real email fixtures in examples/emails/`);
  console.log("Capture real leads and save as JSON to enable these tests.");
}
if (failed > 0) process.exit(1);
