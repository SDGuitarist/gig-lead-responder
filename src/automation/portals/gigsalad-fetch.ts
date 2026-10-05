/**
 * Read one GigSalad lead page with the app's saved login for the lead's account
 * (step 2 of GigSalad portal reading; docs/research/2026-10-04-gigsalad-lead-page.md).
 *
 * Read-only: opens the page, reads the "Event info" text, closes. Never clicks anything.
 * Three outcomes that never read the same: signed out (Alex runs the login command),
 * not a lead page (layout or address problem), a lead. Anything but "ok" holds the lead.
 */
import { parseGigSaladLeadPage, type GigSaladPageLead } from "../parsers/gigsalad-page.js";
import { gigsaladProfileDir, type GigSaladAccount } from "./gigsalad-accounts.js";

export interface FetchedPage { url: string; title: string; text: string }
/** Opens `url` with the browser profile at `profile` and returns what it landed on. Swappable in tests. */
export type PageOpener = (profile: string, url: string) => Promise<FetchedPage>;

export interface GigSaladFetchResult {
  status: "ok" | "signed_out" | "not_a_lead" | "error";
  message: string;
  lead: GigSaladPageLead | null;
}

/** The lead page address, built from a lead number only: never a link taken from an email. */
export function gigsaladLeadUrl(gigId: string): string {
  if (!/^\d{1,12}$/.test(gigId)) throw new Error(`Not a GigSalad lead number: "${gigId}"`);
  return `https://www.gigsalad.com/promokit/gig/${gigId}`;
}

export function readFetchedPage(account: GigSaladAccount, page: FetchedPage): GigSaladFetchResult {
  if (/\/(login|sign-in)\b/i.test(new URL(page.url).pathname) || /\b(log ?in|sign ?in)\b/i.test(page.title)) {
    return { status: "signed_out", lead: null,
      message: `The app's GigSalad ${account} login has expired. Run: npm run gigsalad:login -- ${account}` };
  }
  const lead = parseGigSaladLeadPage({ title: page.title, text: page.text });
  if (!lead.rawText) {
    return { status: "not_a_lead", lead: null,
      message: `GigSalad ${account}: "${page.title}" is not a lead page (wrong lead number, or GigSalad changed the layout)` };
  }
  return { status: "ok", lead, message: lead.warnings.join("; ") };
}

const playwrightOpener: PageOpener = async (profile, url) => {
  const { chromium } = await import("playwright");
  const context = await chromium.launchPersistentContext(profile, {
    headless: true, args: ["--disable-blink-features=AutomationControlled"],
  });
  try {
    const page = await context.newPage();
    await page.goto(url, { timeout: 30_000, waitUntil: "domcontentloaded" });
    const region = page.getByRole("region", { name: "Event info" });
    const found = await region.first().waitFor({ timeout: 10_000 }).then(() => true, () => false);
    const text = found ? await region.first().innerText() : await page.locator("body").innerText();
    return { url: page.url(), title: await page.title(), text };
  } finally {
    await context.close();
  }
};

export async function fetchGigSaladLead(
  account: GigSaladAccount, gigId: string, open: PageOpener = playwrightOpener,
): Promise<GigSaladFetchResult> {
  const url = gigsaladLeadUrl(gigId);
  try {
    return readFetchedPage(account, await open(gigsaladProfileDir(account), url));
  } catch (err) {
    return { status: "error", lead: null,
      message: `GigSalad ${account} lead ${gigId} could not be read: ${err instanceof Error ? err.message : String(err)}` };
  }
}
