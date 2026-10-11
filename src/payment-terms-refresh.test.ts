import { test } from "node:test";
import assert from "node:assert/strict";
import { PAYMENT_SENTENCES, paymentTermsFor, refreshPaymentSentence } from "./pipeline/payment-terms.js";
import type { Classification, PricingResult } from "./types.js";

// Payment terms plan Revision 4 (Alex 2026-10-11): swap the sentence at send time. P15, P16.
const { full, twoWeeks, twoMonths, noDate } = PAYMENT_SENTENCES;
const c = (over: Partial<Classification> = {}) =>
  ({ action: "quote", format_recommended: "solo", lead_source_column: "D", event_date_iso: "2026-10-25", ...over }) as Classification;
const p = { budget: { tier: "none" } } as PricingResult;
const draft = (s: string) => `Hi Sarah,\nSolo guitar, $650, 2 hours.\n${s} Want me to hold it?\nAlex Guillen`;

test("P15: written 16 days out (two weeks), approved at 13 days: the full-payment sentence goes out, nothing else changes", () => {
  const r = refreshPaymentSentence(draft(twoWeeks), paymentTermsFor(c(), p, "2026-10-12"));
  assert.deepEqual(r, { text: draft(full) });
});

test("P15: already right, or a GigSalad lead: unchanged; a line break inside the sentence still matches", () => {
  assert.deepEqual(refreshPaymentSentence(draft(full), paymentTermsFor(c(), p, "2026-10-12")), { text: draft(full) });
  const gig = draft("Looking forward to it.");
  assert.deepEqual(refreshPaymentSentence(gig, paymentTermsFor(c({ platform: "gigsalad" }), p, "2026-10-12")), { text: gig });
  const wrapped = draft(twoMonths.replace(" the balance", "\nthe balance"));
  assert.deepEqual(refreshPaymentSentence(wrapped, paymentTermsFor(c(), p, "2026-10-12")), { text: draft(full) });
});

test("P15: the no-date sentence is not part of the longer ones (\"date.\" vs \"date, and\"), so it is never double-counted", () => {
  assert.deepEqual(refreshPaymentSentence(draft(twoWeeks), { kind: "sentence", sentence: noDate }), { text: draft(noDate) });
});

test("P16: no known sentence, or two, is an error (nothing to swap safely)", () => {
  for (const d of [draft("A deposit secures your date."), draft(`${full} ${twoWeeks}`)]) {
    assert.ok("error" in refreshPaymentSentence(d, paymentTermsFor(c(), p, "2026-10-12")), d);
  }
});
