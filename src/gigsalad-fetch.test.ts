import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchGigSaladLead, gigsaladLeadUrl, readFetchedPage } from "./automation/portals/gigsalad-fetch.js";

// GigSalad step 2: read a lead page with the right account's saved login. A signed-out
// session, a page that is not a lead, and a lead must never read the same: the first two
// hold the lead with different instructions for Alex. No test here touches GigSalad.
const LEAD_TEXT = `Event info
Testa Q.
Thu, June 17, 2027 View calendar
10:00 PM – 10:45 PM (45 minutes)
Springfield, CA 90001, US
Event type: Personal Occasion
Number of guests: 100 guests
Block communication?`;

test("gigsalad fetch: the page address is built from a lead number only", () => {
  assert.equal(gigsaladLeadUrl("36309126"), "https://www.gigsalad.com/promokit/gig/36309126");
  for (const bad of ["", "abc", "123/../../login", "https://evil.example/gig/1", "12 34"]) {
    assert.throws(() => gigsaladLeadUrl(bad), /lead number/, bad);
  }
});

test("gigsalad fetch: a signed-out page holds the lead and names the sign-in command for that account", () => {
  const r = readFetchedPage("business", "1", { url: "https://www.gigsalad.com/login?next=/promokit/gig/1", title: "Log in | GigSalad", text: "Log in\nEmail\nPassword" });
  assert.equal(r.status, "signed_out");
  assert.match(r.message, /npm run gigsalad:login -- business/);
  assert.equal(r.lead, null);
});

test("gigsalad fetch: a page that is not a lead is held as a different problem from signed out", () => {
  const r = readFetchedPage("music", "1", { url: "https://www.gigsalad.com/promokit/gig/1", title: "Page Not Found | GigSalad", text: "Oh no, we can't find this page." });
  assert.equal(r.status, "not_a_lead");
  assert.doesNotMatch(r.message, /gigsalad:login/);
  assert.equal(r.lead, null);
});

test("gigsalad fetch: a lead page is parsed", () => {
  const r = readFetchedPage("music", "1", { url: "https://www.gigsalad.com/promokit/gig/1", title: "Gig Lead from Testa Q. | GigSalad", text: LEAD_TEXT });
  assert.equal(r.status, "ok");
  assert.equal(r.lead?.eventDate, "2027-06-17");
  assert.equal(r.lead?.clientFirstName, "Testa");
});

test("gigsalad fetch: the browser step uses the lead's own account profile and the built address", async () => {
  const opened: Array<{ profile: string; url: string }> = [];
  const r = await fetchGigSaladLead("business", "36423067", async (profile, url) => {
    opened.push({ profile, url });
    return { url, title: "Gig Lead from Testa Q. | GigSalad", text: LEAD_TEXT };
  });
  assert.deepEqual(opened, [{ profile: "data/browser/gigsalad-business", url: "https://www.gigsalad.com/promokit/gig/36423067" }]);
  assert.equal(r.status, "ok");
});

test("gigsalad fetch: a browser failure is reported as an error, never as a lead or as signed out", async () => {
  const r = await fetchGigSaladLead("music", "1", async () => { throw new Error("net::ERR_INTERNET_DISCONNECTED"); });
  assert.equal(r.status, "error");
  assert.match(r.message, /ERR_INTERNET_DISCONNECTED/);
  assert.equal(r.lead, null);
});

// Codex round 1 (GigSalad) P1: a redirect to another lead's page was accepted as the requested lead.
test("gigsalad fetch: the landed page must be exactly the requested lead on www.gigsalad.com", () => {
  const page = (url: string) => ({ url, title: "Gig Lead from Testa Q. | GigSalad", text: LEAD_TEXT });
  assert.equal(readFetchedPage("music", "8", page("https://www.gigsalad.com/promokit/gig/8")).status, "ok");
  assert.equal(readFetchedPage("music", "8", page("https://www.gigsalad.com/promokit/gig/8?tab=quote")).status, "ok");
  for (const wrong of ["https://www.gigsalad.com/promokit/gig/999", "https://www.gigsalad.com/promokit/gig/88",
    "https://evil.example/promokit/gig/8", "https://www.gigsalad.com/promokit/inbox"]) {
    const r = readFetchedPage("music", "8", page(wrong));
    assert.equal(r.status, "not_a_lead", wrong);
    assert.equal(r.lead, null, wrong);
  }
});
