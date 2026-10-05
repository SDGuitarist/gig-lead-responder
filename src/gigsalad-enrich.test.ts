import { test } from "node:test";
import assert from "node:assert/strict";
import { enrichGigSaladLead } from "./automation/portals/gigsalad-enrich.js";
import { parseGigSaladEmailKey, type FindResult } from "./automation/portals/gigsalad-match.js";
import type { GigSaladFetchResult } from "./automation/portals/gigsalad-fetch.js";
import { parseGigSaladLeadPage } from "./automation/parsers/gigsalad-page.js";

// GigSalad step 4: a lead email becomes the lead page's details, or is held with the reason.
// The send address is never set here: posting on GigSalad is a separate decision for Alex.
const EMAIL = "Testa would like a quote for a Birthday Party on August 1, 2026 from 6:00 pm to 9:00 pm.";
const PAGE = parseGigSaladLeadPage({ title: "Gig Lead from Testa Q. | GigSalad", text:
  "Event info\nTesta Q.\nSat, August 1, 2026 View calendar\n6:00 PM – 9:00 PM (3 hours)\nSpringfield, CA 90001, US\nEvent type: Birthday Party\nBlock communication" });
const found = (r: FindResult) => async () => r;
const fetched = (r: GigSaladFetchResult) => async () => r;
const ok: GigSaladFetchResult = { status: "ok", message: "", lead: PAGE };

test("gigsalad enrich: one match whose page reads is enriched with that page's lead", async () => {
  const asked: Array<[string, string]> = [];
  const r = await enrichGigSaladLead(EMAIL, { find: found({ status: "matched", account: "business", gigId: "8" }),
    readPage: async (account, gigId) => { asked.push([account, gigId]); return ok; } });
  assert.deepEqual(asked, [["business", "8"]]);
  assert.equal(r.status, "enriched");
  assert.equal(r.status === "enriched" && r.lead.rawText, PAGE.rawText);
  assert.equal(r.status === "enriched" && r.account, "business");
  assert.equal(r.status === "enriched" && r.notice, undefined);
});

test("gigsalad enrich: a match found while the other login expired goes ahead and tells Alex", async () => {
  const r = await enrichGigSaladLead(EMAIL, { find: found({ status: "matched", account: "music", gigId: "8", unreadable: ["business"] }), readPage: fetched(ok) });
  assert.equal(r.status, "enriched");
  assert.match(r.status === "enriched" ? r.notice ?? "" : "", /npm run gigsalad:login -- business/);
});

test("gigsalad enrich: every other outcome holds the lead with a reason Alex can act on", async () => {
  const cases: Array<[FindResult, GigSaladFetchResult, RegExp]> = [
    [{ status: "signed_out", account: "music" }, ok, /npm run gigsalad:login -- music/],
    [{ status: "none" }, ok, /no inbox row/],
    [{ status: "ambiguous", candidates: [{ account: "music", gigId: "1" }, { account: "business", gigId: "2" }] }, ok, /2 inbox rows/],
    [{ status: "error", message: "inbox timeout" }, ok, /inbox timeout/],
    [{ status: "matched", account: "music", gigId: "1" }, { status: "signed_out", message: "Run: npm run gigsalad:login -- music", lead: null }, /gigsalad:login -- music/],
    [{ status: "matched", account: "music", gigId: "1" }, { status: "not_a_lead", message: "not a lead page", lead: null }, /not a lead page/],
  ];
  for (const [f, g, why] of cases) {
    const r = await enrichGigSaladLead(EMAIL, { find: found(f), readPage: fetched(g) });
    assert.equal(r.status, "hold", f.status);
    assert.match(r.status === "hold" ? r.reason : "", why, f.status);
  }
});

test("gigsalad enrich: an email without the lead sentence is left to the email parser", async () => {
  let fetchedAny = false;
  const r = await enrichGigSaladLead("Event Type: Wedding\nDate: April 15, 2027", {
    find: found({ status: "no_key" }), readPage: async () => { fetchedAny = true; return ok; } });
  assert.equal(r.status, "not_a_lead_email");
  assert.equal(fetchedAny, false);
});

test("gigsalad enrich: the email key reads HTML-only mail and ignores a hostile long body quickly", () => {
  assert.deepEqual(parseGigSaladEmailKey("<p>Testa would like a quote for a Funeral/Memorial Service on March 19, 2026.</p>"),
    { firstName: "Testa", eventType: "Funeral/Memorial Service", dateISO: "2026-03-19", timeWindow: null });
  const start = Date.now();
  parseGigSaladEmailKey("Testa would like a quote for " + "x on ".repeat(20_000));
  assert.ok(Date.now() - start < 200, `took ${Date.now() - start} ms`);
});

// Codex round 1 (GigSalad) P1: first name + event type + date can collide. After the page is read,
// its own date, event type, first name and (when the email gives one) time window must match the
// email; any mismatch holds the lead.
test("gigsalad enrich: the page must agree with the email (name, type, date, time window)", async () => {
  const page = (text: string, title = "Gig Lead from Testa Q. | GigSalad"): GigSaladFetchResult =>
    ({ status: "ok", message: "", lead: parseGigSaladLeadPage({ title, text }) });
  const base = "Event info\nTesta Q.\nSat, August 1, 2026 View calendar\n6:00 PM – 9:00 PM (3 hours)\nSpringfield, CA 90001, US\nEvent type: Birthday Party\nBlock communication";
  const go = (p: GigSaladFetchResult, email = EMAIL) =>
    enrichGigSaladLead(email, { find: found({ status: "matched", account: "music", gigId: "8" }), readPage: fetched(p) });
  assert.equal((await go(page(base))).status, "enriched");
  for (const [label, text, title] of [
    ["other time", base.replace("6:00 PM – 9:00 PM (3 hours)", "7:00 PM – 9:00 PM (2 hours)"), undefined],
    ["other date", base.replace("Sat, August 1, 2026", "Sun, August 2, 2026"), undefined],
    ["other type", base.replace("Event type: Birthday Party", "Event type: Wedding"), undefined],
    ["other name", base, "Gig Lead from Otherby Q. | GigSalad"],
  ] as const) {
    const r = await go(page(text, title));
    assert.equal(r.status, "hold", label);
    assert.match(r.status === "hold" ? r.reason : "", /does not match the email/, label);
  }
  // An email without a time window is checked on name, type and date only.
  const noTime = "Testa would like a quote for a Birthday Party on August 1, 2026.";
  assert.equal((await go(page(base.replace("6:00 PM – 9:00 PM (3 hours)", "7:00 PM – 9:00 PM (2 hours)")), noTime)).status, "enriched");
});
