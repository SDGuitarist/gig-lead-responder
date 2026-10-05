import { test } from "node:test";
import assert from "node:assert/strict";
import { findGigSaladLead, matchGigSaladLead, parseGigSaladEmailKey, parseInboxRow, type InboxRead } from "./automation/portals/gigsalad-match.js";

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

// findGigSaladLead reads BOTH inboxes, then matches. An inbox that cannot be read must
// never turn into "no match": the lead may be in it. That account's problem is reported.
const fakeInboxes = (music: InboxRead, business: InboxRead) => async (account: "music" | "business") =>
  (account === "music" ? music : business);
const rows = (...r: Array<[string, string]>): InboxRead => ({ status: "ok", links: r.map(([href, text]) => ({ href, text })) });

test("gigsalad find: reads both inboxes and returns the one match with its account", async () => {
  const found = await findGigSaladLead(EMAIL, fakeInboxes(rows(["/promokit/gig/7", row("Other Q.", "Birthday Party", "Sat, Aug 1, 2026")]),
    rows(["/promokit/gig/8", row("Testa Q.", "Birthday Party", "Sat, Aug 1, 2026")])));
  assert.deepEqual(found, { status: "matched", account: "business", gigId: "8" });
});

test("gigsalad find: an unreadable or signed-out inbox holds the lead, never reads as no match", async () => {
  const signedOut = await findGigSaladLead(EMAIL, fakeInboxes(rows(), { status: "signed_out" }));
  assert.deepEqual(signedOut, { status: "signed_out", account: "business" });
  const broken = await findGigSaladLead(EMAIL, fakeInboxes({ status: "error", message: "timeout" }, rows()));
  assert.equal(broken.status, "error");
  // Even with a unique match in the readable account: the other inbox might hold the same key.
  const partial = await findGigSaladLead(EMAIL, fakeInboxes(rows(["/promokit/gig/8", row("Testa Q.", "Birthday Party", "Sat, Aug 1, 2026")]),
    { status: "signed_out" }));
  assert.equal(partial.status, "signed_out");
});

test("gigsalad find: an email that is not a lead notice is reported, not matched", async () => {
  assert.deepEqual(await findGigSaladLead("Your weekly GigSalad summary", fakeInboxes(rows(), rows())), { status: "no_key" });
});
