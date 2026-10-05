/**
 * GigSalad step 4: turn a lead email into the lead page's details, or a hold with the reason.
 * Joins findGigSaladLead (which account, which lead) and fetchGigSaladLead (read the page).
 *
 * Never sets a send address: the orchestrator's GigSalad reply path stays disarmed (it only
 * refuses today because real leads have no portal URL). Posting on GigSalad is Alex's call.
 */
import type { GigSaladPageLead } from "../parsers/gigsalad-page.js";
import type { GigSaladAccount } from "./gigsalad-accounts.js";
import { fetchGigSaladLead } from "./gigsalad-fetch.js";
import { findGigSaladLead, parseGigSaladEmailKey, type LeadKey } from "./gigsalad-match.js";

export type GigSaladEnrichment =
  /** notice: an account whose login expired while this lead was found in the other one. */
  | { status: "enriched"; account: GigSaladAccount; gigId: string; lead: GigSaladPageLead; notice?: string }
  | { status: "hold"; reason: string }
  /** Not GigSalad's new-lead sentence: leave the lead to the email parser, as before. */
  | { status: "not_a_lead_email" };

export async function enrichGigSaladLead(
  emailBody: string,
  deps: { find: typeof findGigSaladLead; readPage: typeof fetchGigSaladLead } = { find: findGigSaladLead, readPage: fetchGigSaladLead },
): Promise<GigSaladEnrichment> {
  const found = await deps.find(emailBody);
  switch (found.status) {
    case "no_key":
      return { status: "not_a_lead_email" };
    case "signed_out":
      return { status: "hold", reason: `GigSalad: the app's ${found.account} login has expired. Run: npm run gigsalad:login -- ${found.account}` };
    case "error":
      return { status: "hold", reason: `GigSalad: ${found.message}` };
    case "none":
      return { status: "hold", reason: "GigSalad: no inbox row in either account matches this lead (first name, event type, date)" };
    case "ambiguous":
      return { status: "hold", reason: `GigSalad: ${found.candidates.length} inbox rows match this lead; Alex picks the right one` };
  }
  const page = await deps.readPage(found.account, found.gigId);
  if (page.status !== "ok" || !page.lead) return { status: "hold", reason: `GigSalad: ${page.message}` };
  const key = parseGigSaladEmailKey(emailBody);
  const mismatch = key ? pageMismatch(key, page.lead) : "the email's key could not be read";
  if (mismatch) return { status: "hold", reason: `GigSalad: lead ${found.gigId} (${found.account}) does not match the email: ${mismatch}` };
  const notice = found.unreadable?.map((a) => `GigSalad: the app's ${a} login has expired. Run: npm run gigsalad:login -- ${a}`).join(" ");
  return { status: "enriched", account: found.account, gigId: found.gigId, lead: page.lead, ...(notice ? { notice } : {}) };
}

/**
 * After the page is read, its own name, event type, date and time window must agree with the email
 * (Codex round 1, GigSalad, P1: the inbox key alone can collide). Returns what differs, or null.
 */
function pageMismatch(key: LeadKey, lead: GigSaladPageLead): string | null {
  const same = (a: string | null | undefined, b: string) => (a ?? "").trim().toLowerCase() === b.trim().toLowerCase();
  const diffs: string[] = [];
  if (!same(lead.clientFirstName, key.firstName)) diffs.push("first name");
  if (!same(lead.fields["Event type"], key.eventType)) diffs.push("event type");
  if (lead.eventDate !== key.dateISO) diffs.push("date");
  if (key.timeWindow && lead.timeWindow !== key.timeWindow) diffs.push("time window");
  return diffs.length ? diffs.join(", ") : null;
}
