import type { ParseResult } from "./types.js";

export interface EmailFields {
  from: string;
  subject: string;
  "body-plain": string;
  "body-html": string;
  "Message-Id"?: string;
}

/** Max body length before regex processing — defense-in-depth against ReDoS. */
const MAX_BODY_LENGTH = 200_000;

/** Validate that a token URL uses HTTPS and belongs to a known lead platform. */
function isValidTokenUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" &&
      (parsed.hostname.endsWith("gigsalad.com") || parsed.hostname.endsWith("thebash.com"));
  } catch { return false; }
}

// --- GigSalad ---

const GIGSALAD_LEAD_FROM = "leads@gigsalad.com";
const GIGSALAD_SKIP_FROM = "noreply@gigsalad.com";

function parseGigSalad(fields: EmailFields): ParseResult {
  const from = fields.from.toLowerCase();

  if (from.includes(GIGSALAD_SKIP_FROM)) {
    return { ok: false, reason: "skip", detail: "GigSalad status/reminder email (noreply)" };
  }

  if (!from.includes(GIGSALAD_LEAD_FROM)) {
    return { ok: false, reason: "skip", detail: `Not a GigSalad lead email: ${fields.from}` };
  }

  const plain = fields["body-plain"].slice(0, MAX_BODY_LENGTH);
  const html = fields["body-html"].slice(0, MAX_BODY_LENGTH);
  const subject = fields.subject;

  // external_id = Message-Id header
  const externalId = fields["Message-Id"];
  if (!externalId) {
    return { ok: false, reason: "parse_error", detail: "Missing Message-Id header" };
  }

  // event_type: "would like a quote for (.+?) on"
  const eventTypeMatch = plain.match(/would like a quote for (?:a |an )?(.+?) on/i);
  if (!eventTypeMatch) {
    return { ok: false, reason: "parse_error", detail: "Could not extract event_type from body" };
  }

  // event_date: "on (Month Day, Year)."
  const eventDateMatch = plain.match(/on ([A-Z][a-z]+ \d+, \d{4})\./);
  if (!eventDateMatch) {
    return { ok: false, reason: "parse_error", detail: "Could not extract event_date from body" };
  }

  // location: subject "in (.+)\)"
  const locationMatch = subject.match(/in (.+)\)/);
  const location = locationMatch ? locationMatch[1] : undefined;

  // token_url: href from "View the details & reply" anchor
  const tokenUrlMatch = html.match(/<a[^>]+href="([^"]+)"[^>]*>[^<]*View the details/i);
  if (!tokenUrlMatch) {
    return { ok: false, reason: "parse_error", detail: "Could not extract token_url from HTML body" };
  }
  if (!isValidTokenUrl(tokenUrlMatch[1])) {
    return { ok: false, reason: "parse_error", detail: "token_url failed scheme/domain validation" };
  }

  return {
    ok: true,
    lead: {
      platform: "gigsalad",
      external_id: externalId,
      event_type: eventTypeMatch[1],
      event_date: eventDateMatch[1],
      location,
      token_url: tokenUrlMatch[1],
      raw_text: plain,
    },
  };
}

// --- The Bash ---

const THEBASH_FROM = "info@thebash.com";

function parseTheBash(fields: EmailFields): ParseResult {
  const from = fields.from.toLowerCase();
  const subject = fields.subject;

  if (!from.includes(THEBASH_FROM)) {
    return { ok: false, reason: "skip", detail: `Not a The Bash email: ${fields.from}` };
  }

  if (!subject.includes("Gig Alert")) {
    return { ok: false, reason: "skip", detail: "The Bash email without Gig Alert — skipping" };
  }

  const html = fields["body-html"].slice(0, MAX_BODY_LENGTH);
  const plain = fields["body-plain"].slice(0, MAX_BODY_LENGTH);

  // external_id: Gig ID from subject — "Gig ID #(\d+)"
  const gigIdMatch = subject.match(/Gig ID #(\d+)/);
  if (!gigIdMatch) {
    return { ok: false, reason: "parse_error", detail: "Could not extract Gig ID from subject" };
  }

  // event_type: subject — "Gig Alert: (.+?) Lead!"
  const eventTypeMatch = subject.match(/Gig Alert: (.+?) Lead!/);
  if (!eventTypeMatch) {
    return { ok: false, reason: "parse_error", detail: "Could not extract event_type from subject" };
  }

  // event_date: HTML table — "EVENT DATE:" cell value
  const eventDateMatch = html.match(/EVENT DATE:[^<]*<td[^>]*>([^<]*)<\/td>/is);
  if (!eventDateMatch) {
    return { ok: false, reason: "parse_error", detail: "Could not extract event_date from HTML table" };
  }

  // token_url: href of "VIEW NOW" button
  const tokenUrlMatch = html.match(/<a[^>]+href="([^"]+)"[^>]*>[^<]*VIEW NOW/i);
  if (!tokenUrlMatch) {
    return { ok: false, reason: "parse_error", detail: "Could not extract token_url from HTML body" };
  }
  if (!isValidTokenUrl(tokenUrlMatch[1])) {
    return { ok: false, reason: "parse_error", detail: "token_url failed scheme/domain validation" };
  }

  return {
    ok: true,
    lead: {
      platform: "thebash",
      external_id: gigIdMatch[1],
      event_type: eventTypeMatch[1],
      event_date: eventDateMatch[1].trim(),
      token_url: tokenUrlMatch[1],
      raw_text: plain,
    },
  };
}

// --- Main parser ---

export function parseEmail(fields: EmailFields): ParseResult {
  const from = fields.from.toLowerCase();

  if (from.includes("gigsalad.com")) {
    return parseGigSalad(fields);
  }

  if (from.includes("thebash.com")) {
    return parseTheBash(fields);
  }

  return { ok: false, reason: "skip", detail: `Unknown sender: ${fields.from}` };
}
