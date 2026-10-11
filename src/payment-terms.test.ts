import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PAYMENT_SENTENCES, civilDay, paymentSentence, paymentTermsFor } from "./pipeline/payment-terms.js";
import type { Classification, PricingResult } from "./types.js";

// Payment terms by lead time (plan 2026-10-11, Alex's exact sentences). Every test injects today.
const { full, twoWeeks, twoMonths, noDate } = PAYMENT_SENTENCES;
const at = (event: string | null, today = "2026-10-11") => paymentSentence(event, today);

describe("payment sentence by lead time", () => {
  it("P1: 0, 1, 13 and 14 days out is full payment", () => {
    for (const d of ["2026-10-11", "2026-10-12", "2026-10-24", "2026-10-25"]) assert.equal(at(d), full, d);
  });

  it("P2: 15 days and exactly 2 months is the two-weeks sentence; 2 months + 1 day is two months", () => {
    assert.equal(at("2026-10-26"), twoWeeks);
    assert.equal(at("2026-12-11"), twoWeeks);
    assert.equal(at("2026-12-12"), twoMonths);
  });

  it("P3: days are calendar days, not hours (15 days across the March DST change)", () => {
    assert.equal(at("2026-03-23", "2026-03-08"), twoWeeks);
    assert.equal(at("2026-03-22", "2026-03-08"), full);
  });

  it("P4: two months from a month end clamps to the shorter month's last day", () => {
    assert.equal(at("2027-02-28", "2026-12-31"), twoWeeks);
    assert.equal(at("2027-03-01", "2026-12-31"), twoMonths);
    assert.equal(at("2028-02-29", "2027-12-31"), twoWeeks);
  });

  it("P5: no date, nonsense, impossible dates and past dates get the no-date sentence, without throwing", () => {
    for (const d of [null, "TBD", "2027-02-30", "2026-02-31", "2026-10-10", "2026-1-5"]) assert.equal(at(d), noDate, String(d));
    assert.equal(civilDay("2027-02-30"), null);
    assert.equal(civilDay("2026-03-23")! - civilDay("2026-03-08")!, 15);
  });
});

const c = (over: Partial<Classification> = {}) =>
  ({ action: "quote", format_recommended: "solo", lead_source_column: "D", event_date_iso: "2026-10-20", ...over }) as Classification;
const p = (over: Partial<PricingResult> = {}) => ({ budget: { tier: "none" }, ...over }) as PricingResult;
const T = "2026-10-11";

describe("paymentTermsFor: exclusions, then platform, then hand-run platform, then dated", () => {
  it("P6: clarification, no viable scope and residency get none, for direct and GigSalad leads alike", () => {
    for (const platform of [undefined, "gigsalad"] as const) {
      assert.deepEqual(paymentTermsFor(c({ platform, action: "one_question", format_recommended: "unresolved" }), p(), T), { kind: "none" });
      assert.deepEqual(paymentTermsFor(c({ platform }), p({ budget: { tier: "no_viable_scope" } as PricingResult["budget"] }), T), { kind: "none" });
      assert.deepEqual(paymentTermsFor(c({ platform }), p({ residency: {} as PricingResult["residency"] }), T), { kind: "none" });
    }
  });

  it("P6: GigSalad and The Bash (intake-set platform) get platform", () => {
    assert.deepEqual(paymentTermsFor(c({ platform: "gigsalad" }), p(), T), { kind: "platform" });
    assert.deepEqual(paymentTermsFor(c({ platform: "thebash", lead_source_column: "P" }), p(), T), { kind: "platform" });
  });

  it("P6: Yelp, Squarespace and direct get the dated sentence, whatever the model's column says", () => {
    for (const platform of ["yelp", "squarespace", "direct"] as const) {
      for (const col of ["P", "D"] as const) {
        assert.deepEqual(paymentTermsFor(c({ platform, lead_source_column: col }), p(), T), { kind: "sentence", sentence: full });
      }
    }
    assert.deepEqual(paymentTermsFor(c({ lead_source_column: "D" }), p(), T), { kind: "sentence", sentence: full });
  });

  it("P6: no intake platform and the model says platform is unknown_platform", () => {
    assert.deepEqual(paymentTermsFor(c({ lead_source_column: "P" }), p(), T), { kind: "unknown_platform" });
  });
});
