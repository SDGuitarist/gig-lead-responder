/**
 * Parse the visible text of a GigSalad lead page (https://www.gigsalad.com/promokit/gig/<id>).
 *
 * Real GigSalad lead emails hold only a first name, event type, date and a tracking link;
 * the details live on this page (docs/research/2026-10-04-gigsalad-lead-page.md). Pure:
 * the portal client hands in the page title and text, nothing here touches the network.
 *
 * Contact data never leaves this function: the phone line (masked or not) is skipped, and
 * any phone number or email typed into a free-text field becomes "[contact removed]".
 */
export interface GigSaladPageLead {
  clientFirstName: string | null;
  eventDate: string | null; // YYYY-MM-DD
  durationMinutes: number | null;
  /** "6:00 PM-9:00 PM" (start-end), to compare with the email's window; null if not shown. */
  timeWindow: string | null;
  location: string | null;
  zip: string | null;
  /** Every "Label: value" in the Event info block, in page order (labels without the colon). */
  fields: Record<string, string>;
  /** Quotes other members sent; null when the page shows no count (business account): unknown, never 0. */
  quotesSent: number | null;
  membersResponded: number | null;
  /** Labeled lines for the pipeline's classify step; "" when the page is not a lead page. */
  rawText: string;
  warnings: string[];
}

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september",
  "october", "november", "december"];
// Any run of digits joined by spaces, dots, dashes or brackets (optionally +) with 7+ digits is
// treated as a phone, any country (Codex round 1, GigSalad, P1). Fail-closed: "1500-2000" typed
// into Details is removed too; "$500 – $1,000", "100 guests" and "6:00 PM" survive.
const PHONE = /\+?\(?\d[\d\s().-]{5,}\d/g;
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const PHONE_LINE = /^\(?[\d*]{3}\)?[\s.-]*[\d*]{3}[\s.-]*[\d*]{4}$/;
const SKIP_LINES = /^(Phone number( revealed after booking)?|Upgrade to see it now|View calendar)$/i;
const DATE = /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*,\s+([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})/;
const TIME = /^(\d{1,2}:\d{2})\s*([AP]M)\s*[–—-]\s*(\d{1,2}:\d{2})\s*([AP]M)\s*\(([^)]+)\)$/i;
const LOCATION = /,\s*[A-Z]{2}\s+(\d{5})(?:-\d{4})?,\s*US$/;
const LABEL = /^([A-Z][A-Za-z /&'-]{1,40}):\s*(.*)$/;

/** "YYYY-MM-DD" only for a real calendar day (no February 31); monthIndex is 0-11. */
export function calendarDate(year: number, monthIndex: number, day: number): string | null {
  const d = new Date(Date.UTC(year, monthIndex, day));
  if (monthIndex < 0 || d.getUTCFullYear() !== year || d.getUTCMonth() !== monthIndex || d.getUTCDate() !== day) return null;
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const scrub = (s: string): string => s.replace(EMAIL, "[contact removed]").replace(PHONE, (m) =>
  (m.match(/\d/g)?.length ?? 0) >= 7 ? "[contact removed]" : m).trim();

/** First word of a name, only if it looks like a name: never an email, a number or symbols. */
const firstName = (s: string | undefined): string | null => {
  const word = s?.trim().split(/\s+/)[0] ?? "";
  return /^[\p{L}][\p{L}'’-]{0,39}$/u.test(word) ? word : null;
};

function durationMinutes(text: string): number | null {
  const h = /(\d+(?:\.\d+)?)\s*hours?/i.exec(text);
  const m = /(\d+)\s*minutes?/i.exec(text);
  if (!h && !m) return null;
  return Math.round((h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0));
}

export function parseGigSaladLeadPage(page: { title: string; text: string }): GigSaladPageLead {
  const warnings: string[] = [];
  const lead: GigSaladPageLead = {
    clientFirstName: null,
    eventDate: null, durationMinutes: null, timeWindow: null, location: null, zip: null, fields: {},
    quotesSent: null, membersResponded: null, rawText: "", warnings,
  };
  // Bounded: a real Event info block is a few hundred characters (Codex round 1, GigSalad, P2).
  const lines = page.text.slice(0, 20_000).split("\n").map((l) => l.trim()).filter(Boolean);
  const start = lines.findIndex((l) => l === "Event info");
  if (start < 0) {
    warnings.push("No Event info block: not a GigSalad lead page (logged out, or the layout changed)");
    return lead;
  }

  let dateText: string | null = null;
  let timeText: string | null = null;
  let pendingLabel: string | null = null;
  let lastLabel: string | null = null;
  let nameLine: string | null = null;
  for (const line of lines.slice(start + 1)) {
    if (/^Block communication/i.test(line)) break;
    if (pendingLabel) {
      lead.fields[pendingLabel] = scrub(line);
      lastLabel = pendingLabel;
      pendingLabel = null;
      continue;
    }
    if (PHONE_LINE.test(line) || SKIP_LINES.test(line)) continue;
    let m: RegExpExecArray | null;
    if ((m = /^(\d+) members? responded$/i.exec(line))) { lead.membersResponded = Number(m[1]); continue; }
    if ((m = /^(\d+) members? sent (?:a )?quotes?$/i.exec(line))) { lead.quotesSent = Number(m[1]); continue; }
    if (/^\d+ (?:have active quotes|quotes? (?:are|is) active)$/i.test(line)) continue;
    if (!lead.eventDate && (m = DATE.exec(line))) {
      const iso = calendarDate(Number(m[3]), MONTHS.indexOf(m[1].toLowerCase()), Number(m[2]));
      if (iso) {
        lead.eventDate = iso;
        dateText = m[0]; // only the matched date: nothing else on that line reaches rawText
      }
      continue;
    }
    if (!timeText && (m = TIME.exec(line))) {
      timeText = line;
      lead.timeWindow = `${m[1]} ${m[2].toUpperCase()}-${m[3]} ${m[4].toUpperCase()}`;
      lead.durationMinutes = durationMinutes(m[5]);
      continue;
    }
    if ((m = LOCATION.exec(line))) {
      if (!lead.location) { lead.location = scrub(line); lead.zip = m[1]; }
      continue;
    }
    if ((m = LABEL.exec(line))) {
      if (m[2]) { lead.fields[m[1]] = scrub(m[2]); lastLabel = m[1]; } else pendingLabel = m[1];
      continue;
    }
    // An unlabeled line: the client's name before the details begin, else the rest of the
    // previous field's value (a multi-line Details).
    if (!lastLabel && !lead.eventDate && !nameLine) nameLine = line;
    else if (lastLabel) lead.fields[lastLabel] = scrub(`${lead.fields[lastLabel]} ${line}`);
  }
  const titleName = /Gig Lead from\s+(.+?)\s*\|/.exec(page.title)?.[1];
  lead.clientFirstName = titleName !== undefined ? firstName(titleName) : firstName(nameLine ?? undefined);

  if (!lead.eventDate) warnings.push("No event date found on the lead page");
  if (!lead.location) warnings.push("No location with a zip found on the lead page");

  const out = ["Platform: GigSalad"];
  if (lead.clientFirstName) out.push(`Client: ${lead.clientFirstName}`);
  if (lead.fields["Event type"]) out.push(`Event type: ${lead.fields["Event type"]}`);
  if (lead.eventDate) out.push(`Date: ${lead.eventDate} (${dateText})`);
  if (timeText) out.push(`Time: ${timeText}`);
  if (lead.location) out.push(`Location: ${lead.location}`);
  for (const [label, value] of Object.entries(lead.fields)) if (label !== "Event type") out.push(`${label}: ${value}`);
  out.push(lead.quotesSent === null
    ? "Competition: not shown on this GigSalad page (unknown)"
    : `Competition: ${lead.quotesSent} quotes sent by other members${lead.membersResponded === null ? "" : ` (${lead.membersResponded} members responded)`}`);
  // Final pass over everything that reaches the pipeline (Codex round 2, GigSalad, P1): phones and
  // emails, every line. Date and Time are built only from regex captures (a date, a time window), so
  // they are left whole: a phone scrub would eat the ISO date.
  lead.rawText = out.map((l) => (/^(Date|Time): /.test(l) ? l : scrub(l))).join("\n");
  return lead;
}
