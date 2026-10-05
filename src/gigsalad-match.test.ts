import { test } from "node:test";
import assert from "node:assert/strict";
import { matchGigSaladLead, parseGigSaladEmailKey, parseInboxRow } from "./automation/portals/gigsalad-match.js";

// GigSalad step 3 (Alex 2026-10-04, option A): find a lead email's page by matching first name +
// event type + date against BOTH accounts' inbox rows. Exactly one match is used; none or more
// than one holds the lead. Shapes from the real email and the real inbox row (masked probe).
const EMAIL = `Alex, you got a new lead!

Testa would like a quote for a Birthday Party on August 1, 2026 from 6:00 pm to 9:00 pm.

View the details &amp; reply: https://tracking.gigsalad.com/tracking/click?d=REDACTED`;

const row = (name: string, type: string, date: string) =>
  `${name}\nSep 26\n${type}\n•\nLatin Band\nSpringfield, CA\n•\n${date}\nMessage read`;

test("gigsalad match: the email gives first name, event type and date", () => {
  assert.deepEqual(parseGigSaladEmailKey(EMAIL), { firstName: "Testa", eventType: "Birthday Party", dateISO: "2026-08-01" });
  assert.deepEqual(parseGigSaladEmailKey(EMAIL.replace("a Birthday Party", "an Anniversary Party")),
    { firstName: "Testa", eventType: "Anniversary Party", dateISO: "2026-08-01" });
  assert.equal(parseGigSaladEmailKey("Your weekly GigSalad summary"), null);
});

test("gigsalad match: an inbox row gives lead number, first name, event type and date (short month)", () => {
  assert.deepEqual(parseInboxRow("/promokit/gig/36309126", row("Testa Q.", "Birthday Party", "Sat, Aug 1, 2026")),
    { gigId: "36309126", firstName: "Testa", eventType: "Birthday Party", dateISO: "2026-08-01" });
  assert.equal(parseInboxRow("/promokit/gig/1", "Testa Q.\nonly two lines"), null);
  assert.equal(parseInboxRow("/somewhere/else", row("Testa Q.", "Birthday Party", "Sat, Aug 1, 2026")), null);
});

const key = { firstName: "Testa", eventType: "Birthday Party", dateISO: "2026-08-01" };
const r = (gigId: string, firstName = "Testa", eventType = "Birthday Party", dateISO = "2026-08-01") =>
  ({ gigId, firstName, eventType, dateISO });

test("gigsalad match: exactly one match across both accounts is used, with its account", () => {
  assert.deepEqual(matchGigSaladLead(key, { music: [r("1", "Other"), r("2")], business: [r("3", "Testa", "Wedding")] }),
    { status: "matched", account: "music", gigId: "2" });
  assert.deepEqual(matchGigSaladLead(key, { music: [], business: [r("9", "testa", "birthday party")] }),
    { status: "matched", account: "business", gigId: "9" });
});

test("gigsalad match: no match or two matches hold the lead; a lead is never guessed", () => {
  assert.equal(matchGigSaladLead(key, { music: [r("1", "Testa", "Birthday Party", "2026-08-02")], business: [] }).status, "none");
  const two = matchGigSaladLead(key, { music: [r("1")], business: [r("2")] });
  assert.equal(two.status, "ambiguous");
  assert.equal(matchGigSaladLead(key, { music: [r("1"), r("4")], business: [] }).status, "ambiguous");
});
