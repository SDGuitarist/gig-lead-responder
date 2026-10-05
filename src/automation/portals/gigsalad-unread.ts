/**
 * Put a GigSalad lead back to unread after the app has read it (Alex 2026-10-05, option A).
 *
 * Measured: opening a lead page marks it read, and until Module 1 nothing else tells Alex a lead
 * arrived. The lead page has ONE form with two submit buttons, "Archive" and "Mark as unread", that
 * differ only by which is pressed (page script fills `notification_action`). So the app clicks only
 * an exact, single "Mark as unread" whose form belongs to this lead, and then PROVES the result: the
 * lead is in the Unread view and not in the Archived view. Anything doubtful: no click, or a loud
 * failure. This is the app's only GigSalad click (pinned in src/send-surface.test.ts).
 */
import { BROWSER_PROCESSES, gigsaladProfileDir, withGigSaladProfile, type GigSaladAccount } from "./gigsalad-accounts.js";
import { gigsaladLeadUrl } from "./gigsalad-fetch.js";

const UNREAD_VIEW = "/promokit/inbox-unread";
const ARCHIVE_VIEW = "/promokit/inbox-archive";
/** A view longer than this is not walked to its end (and so proves nothing about absence). */
const MAX_VIEW_PAGES = 25;

/** One inbox view, walked: ok = every page was that view; complete = reached a page with no Next. */
export interface ViewWalk { ok: boolean; complete: boolean; ids: string[] }

/**
 * Walk an inbox view page by page (unread Codex round 1): GigSalad pages views by path
 * ("/promokit/inbox-archive", then "/promokit/inbox-archive/2", ...) with a "Next" link. Every page
 * must land exactly on the path asked for (a redirect proves nothing), Next must stay inside the
 * view, and the walk stops after MAX_VIEW_PAGES. Pure: the loader is the browser in real use.
 */
export async function collectView(
  viewPath: string,
  load: (path: string) => Promise<{ landedPath: string; ids: string[]; nextHref: string | null }>,
  maxPages = MAX_VIEW_PAGES,
): Promise<ViewWalk> {
  const inView = (p: string) => p === viewPath || (p.startsWith(`${viewPath}/`) && /^\d{1,4}$/.test(p.slice(viewPath.length + 1)));
  const ids: string[] = [];
  let path = viewPath;
  for (let i = 0; i < maxPages; i++) {
    const page = await load(path);
    if (page.landedPath !== path) return { ok: false, complete: false, ids };
    ids.push(...page.ids);
    if (!page.nextHref) return { ok: true, complete: true, ids };
    if (!inView(page.nextHref)) return { ok: true, complete: false, ids };
    path = page.nextHref;
  }
  return { ok: true, complete: false, ids };
}

/** The browser steps, swappable in tests. */
export interface UnreadPage {
  open(url: string): Promise<{ url: string; title: string }>;
  /** How many buttons are named exactly "Mark as unread", and the form action of the one there is. */
  unreadButton(): Promise<{ count: number; formAction: string | null }>;
  clickUnread(): Promise<void>;
  /** A whole inbox view (every page), walked by collectView. */
  listView(path: string): Promise<ViewWalk>;
}

export type UnreadResult =
  | { status: "restored" }
  | { status: "failed"; reason: string }
  | { status: "archived"; reason: string };

export async function restoreGigSaladUnread(account: GigSaladAccount, gigId: string, page: UnreadPage): Promise<UnreadResult> {
  const fail = (reason: string): UnreadResult => ({ status: "failed", reason: `GigSalad ${account} lead ${gigId}: ${reason}` });
  const landed = await page.open(gigsaladLeadUrl(gigId));
  const at = new URL(landed.url);
  if (/\/(login|sign-in)\b/i.test(at.pathname) || /\b(log ?in|sign ?in)\b/i.test(landed.title)) {
    return fail(`the app's login has expired; not marked unread. Run: npm run gigsalad:login -- ${account}`);
  }
  if (at.hostname !== "www.gigsalad.com" || at.pathname !== `/promokit/gig/${gigId}`) {
    return fail(`landed on ${at.hostname}${at.pathname}; not marked unread`);
  }
  const button = await page.unreadButton();
  if (button.count !== 1) return fail(`expected exactly one "Mark as unread" button, found ${button.count}; nothing clicked`);
  if (button.formAction !== `/promokit/modify-notifications-for-gig/${gigId}`) {
    return fail(`the "Mark as unread" form belongs to another lead (${button.formAction ?? "no form"}); nothing clicked`);
  }
  await page.clickUnread();
  const unread = await page.listView(UNREAD_VIEW);
  const archived = await page.listView(ARCHIVE_VIEW);
  if (archived.ok && archived.ids.includes(gigId)) {
    return { status: "archived", reason: `GigSalad ${account} lead ${gigId} was ARCHIVED instead of marked unread. ` +
      `Find it in https://www.gigsalad.com${ARCHIVE_VIEW} and move it back.` };
  }
  // "Restored" needs proof both ways: found in the Unread view, and the WHOLE Archived view read without it.
  if (!archived.ok || !archived.complete) return fail("clicked \"Mark as unread\" but could not prove it was not archived (Archived view not fully read)");
  if (!unread.ok) return fail("clicked \"Mark as unread\" but the Unread view could not be read (landed elsewhere)");
  if (!unread.ids.includes(gigId)) {
    return fail(unread.complete ? "clicked \"Mark as unread\" but it did not come back as unread"
      : "clicked \"Mark as unread\" but it was not found in the Unread pages that could be read");
  }
  return { status: "restored" };
}

/** The real browser, with the account's own login, one job per profile at a time. */
export function restoreGigSaladUnreadInBrowser(account: GigSaladAccount, gigId: string): Promise<UnreadResult> {
  return withGigSaladProfile(account, async () => {
    const { chromium } = await import("playwright");
    const context = await chromium.launchPersistentContext(gigsaladProfileDir(account), {
      headless: true, args: ["--disable-blink-features=AutomationControlled"],
    });
    try {
      const tab = await context.newPage();
      const button = () => tab.getByRole("button", { name: "Mark as unread", exact: true });
      const page: UnreadPage = {
        open: async (url) => {
          await tab.goto(url, { timeout: 30_000, waitUntil: "domcontentloaded" });
          return { url: tab.url(), title: await tab.title() };
        },
        unreadButton: async () => {
          const count = await button().count();
          const formAction = count === 1
            ? await button().evaluate((b) => b.closest("form")?.getAttribute("action") ?? null) : null;
          return { count, formAction };
        },
        clickUnread: async () => {
          await button().click();
          await tab.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
        },
        listView: (path) => collectView(path, async (p) => {
          await tab.goto(`https://www.gigsalad.com${p}`, { timeout: 30_000, waitUntil: "domcontentloaded" });
          await tab.locator('a[href^="/promokit/gig/"]').first().waitFor({ timeout: 5_000 }).catch(() => {});
          const ids = await tab.locator('a[href^="/promokit/gig/"]').evaluateAll((links) =>
            links.map((a) => a.getAttribute("href")?.split("/").pop() ?? ""));
          // "Next" links: exactly one distinct target, else the walk cannot be trusted (reads as incomplete).
          const nexts = [...new Set(await tab.locator("a").evaluateAll((links) =>
            links.filter((a) => (a.textContent ?? "").trim() === "Next").map((a) => a.getAttribute("href") ?? "")))];
          return { landedPath: new URL(tab.url()).pathname, ids, nextHref: nexts.length === 0 ? null : nexts.length === 1 ? nexts[0] : "?" };
        }),
      };
      return await restoreGigSaladUnread(account, gigId, page);
    } finally {
      await context.close();
    }
  }, undefined, BROWSER_PROCESSES);
}
