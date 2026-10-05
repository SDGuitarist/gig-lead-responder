import { test } from "node:test";
import assert from "node:assert/strict";
import { restoreGigSaladUnread, type UnreadPage } from "./automation/portals/gigsalad-unread.js";

// Alex 2026-10-05 (option A): opening a GigSalad lead marks it read (measured), and until Module 1
// nothing else tells Alex it arrived. After reading, the app clicks that lead's own "Mark as unread"
// and proves it: the lead is in the Unread view AND not in the Archived view ("Archive" is a button
// in the same form). Anything doubtful means no click, or a loud failure. No test touches GigSalad.
function fakePage(over: Partial<{ landed: string; title: string; buttons: number; formAction: string | null;
  unreadAfter: string[]; archivedAfter: string[] }> = {}) {
  const o = { landed: "https://www.gigsalad.com/promokit/gig/8", title: "Gig Lead from Testa Q. | GigSalad", buttons: 1,
    formAction: "/promokit/modify-notifications-for-gig/8", unreadAfter: ["8"], archivedAfter: [], ...over };
  const calls: string[] = [];
  let clicked = false;
  const page: UnreadPage = {
    open: async (url) => { calls.push(`open ${url}`); return { url: o.landed, title: o.title }; },
    unreadButton: async () => ({ count: o.buttons, formAction: o.formAction }),
    clickUnread: async () => { calls.push("click"); clicked = true; },
    listGigIds: async (url) => { calls.push(`list ${url}`); return url.endsWith("inbox-unread") ? (clicked ? o.unreadAfter : []) : (clicked ? o.archivedAfter : []); },
  };
  return { page, calls };
}

test("gigsalad unread: the exact button is clicked once and the lead is proven back in Unread, not Archived", async () => {
  const { page, calls } = fakePage();
  assert.deepEqual(await restoreGigSaladUnread("business", "8", page), { status: "restored" });
  assert.deepEqual(calls, ["open https://www.gigsalad.com/promokit/gig/8", "click",
    "list https://www.gigsalad.com/promokit/inbox-unread", "list https://www.gigsalad.com/promokit/inbox-archive"]);
});

test("gigsalad unread: anything doubtful before the click means NO click", async () => {
  for (const [label, over, why] of [
    ["no button", { buttons: 0 }, /exactly one "Mark as unread" button, found 0/],
    ["two buttons", { buttons: 2 }, /exactly one "Mark as unread" button, found 2/],
    ["another lead's form", { formAction: "/promokit/modify-notifications-for-gig/9" }, /belongs to another lead/],
    ["no form", { formAction: null }, /belongs to another lead/],
    ["redirected elsewhere", { landed: "https://www.gigsalad.com/promokit/gig/9" }, /landed on/],
    ["signed out", { landed: "https://www.gigsalad.com/login", title: "Log in | GigSalad" }, /npm run gigsalad:login -- business/],
  ] as const) {
    const { page, calls } = fakePage(over);
    const r = await restoreGigSaladUnread("business", "8", page);
    assert.equal(r.status, "failed", label);
    assert.match(r.status === "failed" ? r.reason : "", why, label);
    assert.ok(!calls.includes("click"), `${label}: must not click`);
  }
});

test("gigsalad unread: a click that did not restore Unread, or that ARCHIVED the lead, is a loud failure", async () => {
  const notBack = await restoreGigSaladUnread("music", "8", fakePage({ unreadAfter: [] }).page);
  assert.equal(notBack.status, "failed");
  assert.match(notBack.status === "failed" ? notBack.reason : "", /did not come back as unread/);
  const archived = await restoreGigSaladUnread("music", "8", fakePage({ unreadAfter: [], archivedAfter: ["8"] }).page);
  assert.equal(archived.status, "archived");
  assert.match(archived.status === "archived" ? archived.reason : "", /ARCHIVED.*inbox-archive/);
});
