import { test } from "node:test";
import assert from "node:assert/strict";
import { collectView, restoreGigSaladUnread, type UnreadPage } from "./automation/portals/gigsalad-unread.js";

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
    listView: async (path) => { calls.push(`list ${path}`);
      return { ok: true, complete: true, ids: path.endsWith("inbox-unread") ? (clicked ? o.unreadAfter : []) : (clicked ? o.archivedAfter : []) }; },
  };
  return { page, calls };
}

test("gigsalad unread: the exact button is clicked once and the lead is proven back in Unread, not Archived", async () => {
  const { page, calls } = fakePage();
  assert.deepEqual(await restoreGigSaladUnread("business", "8", page), { status: "restored" });
  assert.deepEqual(calls, ["open https://www.gigsalad.com/promokit/gig/8", "click",
    "list /promokit/inbox-unread", "list /promokit/inbox-archive"]);
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

// Unread Codex round 1 P1: the proof read one page of each view and never checked where it landed.
// collectView walks a view page by page ("Next" within the same view), requires every page to be
// that view, and says whether it reached the end.
const pages = (map: Record<string, { landed?: string; ids: string[]; next?: string | null }>) => async (path: string) => {
  const p = map[path];
  if (!p) throw new Error(`unexpected load ${path}`);
  return { landedPath: p.landed ?? path, ids: p.ids, nextHref: p.next ?? null };
};

test("gigsalad unread: collectView walks every page of a view and reports a complete walk", async () => {
  const r = await collectView("/promokit/inbox-archive", pages({
    "/promokit/inbox-archive": { ids: ["1", "2"], next: "/promokit/inbox-archive/2" },
    "/promokit/inbox-archive/2": { ids: ["3"], next: null },
  }));
  assert.deepEqual(r, { ok: true, complete: true, ids: ["1", "2", "3"] });
});

test("gigsalad unread: collectView flags a redirect, a Next leaving the view, and a walk that never ends", async () => {
  const redirected = await collectView("/promokit/inbox-unread", pages({ "/promokit/inbox-unread": { landed: "/promokit/inbox", ids: ["8"] } }));
  assert.equal(redirected.ok, false);
  const leaves = await collectView("/promokit/inbox-unread", pages({ "/promokit/inbox-unread": { ids: [], next: "/promokit/inbox/2" } }));
  assert.equal(leaves.complete, false);
  const loop: Record<string, { ids: string[]; next: string }> = {};
  for (let i = 1; i <= 40; i++) loop[i === 1 ? "/promokit/inbox-archive" : `/promokit/inbox-archive/${i}`] = { ids: [], next: `/promokit/inbox-archive/${i + 1}` };
  const endless = await collectView("/promokit/inbox-archive", pages(loop));
  assert.equal(endless.complete, false);
});

test("gigsalad unread: restored only if found in Unread and the WHOLE Archived view was walked without it", async () => {
  const view = (unread: Awaited<ReturnType<typeof collectView>>, archived: Awaited<ReturnType<typeof collectView>>) => {
    const { page } = fakePage();
    page.listView = async (path) => (path.endsWith("inbox-unread") ? unread : archived);
    return page;
  };
  const yes = { ok: true, complete: true, ids: ["8"] }, none = { ok: true, complete: true, ids: [] as string[] };
  assert.deepEqual(await restoreGigSaladUnread("music", "8", view(yes, none)), { status: "restored" });
  const partialArchive = await restoreGigSaladUnread("music", "8", view(yes, { ok: true, complete: false, ids: [] }));
  assert.equal(partialArchive.status, "failed");
  assert.match(partialArchive.status === "failed" ? partialArchive.reason : "", /could not prove it was not archived/);
  const redirectedUnread = await restoreGigSaladUnread("music", "8", view({ ok: false, complete: false, ids: ["8"] }, none));
  assert.equal(redirectedUnread.status, "failed", "an 8 on a page that is not the Unread view proves nothing");
  const page2 = await restoreGigSaladUnread("music", "8", view({ ok: true, complete: true, ids: ["1", "8"] }, none));
  assert.deepEqual(page2, { status: "restored" });
});
