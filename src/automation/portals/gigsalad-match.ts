/**
 * Match a GigSalad lead email to its lead page (step 3, Alex 2026-10-04: option A).
 *
 * The email holds only "<First> would like a quote for a <Event type> on <Month D, YYYY>".
 * The match key (first name + event type + date) is looked up in BOTH accounts' inbox rows:
 * exactly one row is used, and it also says which account owns the lead. None or several
 * hold the lead for Alex; a lead is never guessed. Everything here is pure except the default
 * inbox reader, which opens each account's inbox read-only with its saved app login.
 */
import { GIGSALAD_ACCOUNTS, gigsaladProfileDir, type GigSaladAccount } from "./gigsalad-accounts.js";

export interface LeadKey { firstName: string; eventType: string; dateISO: string }
export interface InboxRow extends LeadKey { gigId: string }
export type GigSaladMatch =
  | { status: "matched"; account: GigSaladAccount; gigId: string }
  | { status: "none" }
  | { status: "ambiguous"; candidates: Array<{ account: GigSaladAccount; gigId: string }> };

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** "August 1, 2026" or "Aug 1, 2026" → "2026-08-01"; null if it is not a date. */
function isoDate(month: string, day: string, year: string): string | null {
  const m = MONTHS.indexOf(month.slice(0, 3).toLowerCase());
  return m < 0 ? null : `${year}-${String(m + 1).padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export function parseGigSaladEmailKey(body: string): LeadKey | null {
  // HTML-only mail ("<p>Name would like ...") and a bounded scan: the sentence is near the top.
  const text = body.slice(0, 5000).replace(/<[^>]*>/g, "\n");
  const m = /^\s*(\S+) would like a quote for an? ([^\n]{1,80}?) on ([A-Za-z]+) (\d{1,2}), (\d{4})\b/m.exec(text);
  if (!m) return null;
  const dateISO = isoDate(m[3], m[4], m[5]);
  return dateISO ? { firstName: m[1], eventType: m[2].trim(), dateISO } : null;
}

/**
 * One inbox row link: name, received, event type, "•", category, city, "•", date, status.
 * Read by the two bullets so a missing status or received line does not shift the fields.
 */
export function parseInboxRow(href: string, text: string): InboxRow | null {
  const gigId = /^\/promokit\/gig\/(\d{1,12})$/.exec(href)?.[1];
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const b1 = lines.indexOf("•");
  const b2 = lines.indexOf("•", b1 + 1);
  if (!gigId || b1 < 1 || b2 < 0) return null;
  const date = /^(?:[A-Za-z]{3}),\s+([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})$/.exec(lines[b2 + 1] ?? "");
  const dateISO = date ? isoDate(date[1], date[2], date[3]) : null;
  const firstName = lines[0].split(/\s+/)[0];
  if (!dateISO || !firstName) return null;
  return { gigId, firstName, eventType: lines[b1 - 1], dateISO };
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function matchGigSaladLead(key: LeadKey, rows: Record<GigSaladAccount, InboxRow[]>): GigSaladMatch {
  const candidates = (Object.entries(rows) as Array<[GigSaladAccount, InboxRow[]]>).flatMap(([account, list]) =>
    list.filter((r) => same(r.firstName, key.firstName) && same(r.eventType, key.eventType) && r.dateISO === key.dateISO)
      .map((r) => ({ account, gigId: r.gigId })));
  if (candidates.length === 1) return { status: "matched", ...candidates[0] };
  return candidates.length === 0 ? { status: "none" } : { status: "ambiguous", candidates };
}

export type InboxRead =
  | { status: "ok"; links: Array<{ href: string; text: string }> }
  | { status: "signed_out" }
  | { status: "error"; message: string };
export type InboxReader = (account: GigSaladAccount) => Promise<InboxRead>;
export type FindResult =
  | GigSaladMatch
  | { status: "no_key" }
  | { status: "signed_out"; account: GigSaladAccount }
  | { status: "error"; message: string };

const INBOX = "https://www.gigsalad.com/promokit/inbox";

const playwrightInboxReader: InboxReader = async (account) => {
  let context;
  try {
    const { chromium } = await import("playwright");
    context = await chromium.launchPersistentContext(gigsaladProfileDir(account), {
      headless: true, args: ["--disable-blink-features=AutomationControlled"],
    });
    const page = await context.newPage();
    await page.goto(INBOX, { timeout: 30_000, waitUntil: "domcontentloaded" });
    if (!page.url().startsWith(INBOX)) return { status: "signed_out" };
    const links = page.locator('a[href^="/promokit/gig/"]');
    await links.first().waitFor({ timeout: 10_000 }).catch(() => {});
    const out: Array<{ href: string; text: string }> = [];
    for (let i = 0, n = await links.count(); i < n; i++) {
      out.push({ href: (await links.nth(i).getAttribute("href")) ?? "", text: await links.nth(i).innerText() });
    }
    return { status: "ok", links: out };
  } catch (err) {
    return { status: "error", message: `GigSalad ${account} inbox could not be read: ${err instanceof Error ? err.message : String(err)}` };
  } finally {
    await context?.close();
  }
};

/**
 * Find a lead email's page in BOTH accounts. An inbox that cannot be read is reported
 * (signed_out names the account), never treated as "no match": the lead may be in it.
 */
export async function findGigSaladLead(emailBody: string, read: InboxReader = playwrightInboxReader): Promise<FindResult> {
  const key = parseGigSaladEmailKey(emailBody);
  if (!key) return { status: "no_key" };
  const rows = {} as Record<GigSaladAccount, InboxRow[]>;
  for (const account of GIGSALAD_ACCOUNTS) {
    const inbox = await read(account);
    if (inbox.status === "signed_out") return { status: "signed_out", account };
    if (inbox.status === "error") return { status: "error", message: inbox.message };
    rows[account] = inbox.links.map((l) => parseInboxRow(l.href, l.text)).filter((r): r is InboxRow => r !== null);
  }
  return matchGigSaladLead(key, rows);
}
