import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  validateSource,
  getRejectedEmailCount,
  incrementRejectedEmailCount,
} from "./automation/source-validator.js";

describe("validateSource — SPF/DKIM mandatory", () => {
  it("rejects matching sender with empty authenticationResults", () => {
    const result = validateSource("GigSalad <leads@gigsalad.com>", "");
    assert.equal(result.valid, false);
    assert.ok(result.reason?.includes("SPF/DKIM not verified"));
  });

  it("rejects matching sender when authenticationResults omitted", () => {
    const result = validateSource("GigSalad <leads@gigsalad.com>");
    assert.equal(result.valid, false);
    assert.ok(result.reason?.includes("SPF/DKIM not verified"));
  });

  it("rejects matching sender with spf=fail", () => {
    const result = validateSource(
      "GigSalad <leads@gigsalad.com>",
      "spf=fail; dkim=pass"
    );
    assert.equal(result.valid, false);
  });

  it("rejects matching sender with dkim=fail", () => {
    const result = validateSource(
      "GigSalad <leads@gigsalad.com>",
      "spf=pass; dkim=fail"
    );
    assert.equal(result.valid, false);
  });

  it("accepts matching sender with spf=pass and dkim=pass", () => {
    const result = validateSource(
      "GigSalad <leads@gigsalad.com>",
      "spf=pass; dkim=pass"
    );
    assert.equal(result.valid, true);
    assert.equal(result.platform, "gigsalad");
  });

  it("accepts Yelp sender with passing auth", () => {
    const result = validateSource(
      "Yelp <no-reply@yelp.com>",
      "spf=pass; dkim=pass"
    );
    assert.equal(result.valid, true);
    assert.equal(result.platform, "yelp");
  });

  it("accepts Squarespace sender with passing auth", () => {
    const result = validateSource(
      "Squarespace <form-submission@squarespace.com>",
      "spf=pass; dkim=pass"
    );
    assert.equal(result.valid, true);
    assert.equal(result.platform, "squarespace");
  });

  it("rejects unknown sender regardless of auth", () => {
    const result = validateSource(
      "Attacker <attacker@evil.com>",
      "spf=pass; dkim=pass"
    );
    assert.equal(result.valid, false);
    assert.ok(result.reason?.includes("Unknown sender"));
  });
});

// Regression suite for the 2026-08-07 outage: the Yelp allowlist pattern
// matched no live sender, so every Yelp lead was rejected as "Unknown sender".
// Each address below was OBSERVED in Alex's mailbox on 2026-08-07.
// See docs/brainstorms/2026-08-07-reply-detection-samples.md §4a.
const PASS = "spf=pass; dkim=pass";
const YELP_CONV = "reply+17de1e4965044590b37284774f71ee2d@messaging.yelp.com";

describe("validateSource — real observed senders", () => {
  it("accepts the live Yelp per-conversation address (the outage)", () => {
    const result = validateSource(`Yelp <${YELP_CONV}>`, PASS);
    assert.equal(result.valid, true);
    assert.equal(result.platform, "yelp");
    assert.equal(result.kind, "lead");
  });

  it("accepts a live GigSalad lead address", () => {
    const result = validateSource("GigSalad <leads@gigsalad.com>", PASS);
    assert.equal(result.valid, true);
    assert.equal(result.platform, "gigsalad");
    assert.equal(result.kind, "lead");
  });

  it("still enforces SPF/DKIM on the new Yelp pattern", () => {
    const result = validateSource(`Yelp <${YELP_CONV}>`, "spf=pass; dkim=fail");
    assert.equal(result.valid, false);
  });

  // Observed marketing/notification senders that must NOT become leads.
  for (const [label, addr] of [
    ["Yelp marketing", "no-reply@mail.yelp.com"],
    ["Yelp press", "press@yelp.com"],
    ["GigSalad marketing", "yourfriends@gigsalad.com"],
    // Payment/booking notices. Deliberately still rejected: accepting these
    // would turn every payment receipt into a phantom lead. They belong to
    // booked-detection, which does not exist yet.
    ["GigSalad payments", "gigs@gigsalad.com"],
  ] as const) {
    it(`rejects ${label} (${addr})`, () => {
      assert.equal(validateSource(`X <${addr}>`, PASS).valid, false);
    });
  }

  // Anchoring must survive: these are the spoof shapes the exact-match
  // policy exists to stop.
  for (const addr of [
    "reply+17de1e4965044590b37284774f71ee2d@messaging.yelp.com.evil.com",
    "attacker@notmessaging.yelp.com",
    "reply+short@messaging.yelp.com",
    "reply+17de1e4965044590b37284774f71ee2dEXTRA@messaging.yelp.com",
  ]) {
    it(`rejects lookalike ${addr}`, () => {
      assert.equal(validateSource(`X <${addr}>`, PASS).valid, false);
    });
  }
});

describe("validateSource — lead vs reply on the same address", () => {
  it("classifies a client reply by body marker, staying valid", () => {
    const result = validateSource(
      `Yelp <${YELP_CONV}>`,
      PASS,
      "RE: Alex Guillen Music's response to Kimberly S.",
      "Hi Alex Guillen Music G., Kimberly has replied to your message."
    );
    // Genuine mail — valid stays true so it is not counted as a rejection.
    assert.equal(result.valid, true);
    assert.equal(result.kind, "reply");
  });

  it("classifies by subject prefix when body copy changes", () => {
    const result = validateSource(
      `Yelp <${YELP_CONV}>`,
      PASS,
      "RE: Alex Guillen Music's response to Kimberly S.",
      "some future body wording"
    );
    assert.equal(result.kind, "reply");
  });

  it("treats the initial lead on the same address as a lead", () => {
    const result = validateSource(
      `Yelp <${YELP_CONV}>`,
      PASS,
      "Alex Guillen Music's response to Kimberly S.",
      "Kimberly requested a quote from Alex Guillen Music for a musicians."
    );
    assert.equal(result.kind, "lead");
  });

  it("defaults to lead when subject and body are unavailable", () => {
    assert.equal(validateSource(`Yelp <${YELP_CONV}>`, PASS).kind, "lead");
  });

  it("does not apply Yelp reply markers to GigSalad", () => {
    const result = validateSource(
      "GigSalad <leads@gigsalad.com>",
      PASS,
      "RE: something",
      "has replied to your message"
    );
    assert.equal(result.kind, "lead");
  });
});

describe("rejection counter", () => {
  it("incrementRejectedEmailCount increases getRejectedEmailCount", () => {
    const before = getRejectedEmailCount();
    incrementRejectedEmailCount();
    assert.equal(getRejectedEmailCount(), before + 1);
  });

  it("counter increments are cumulative", () => {
    const before = getRejectedEmailCount();
    incrementRejectedEmailCount();
    incrementRejectedEmailCount();
    assert.equal(getRejectedEmailCount(), before + 2);
  });
});
