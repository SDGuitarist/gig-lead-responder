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
