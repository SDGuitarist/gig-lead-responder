/**
 * Validates that an email came from a known lead platform.
 * Uses exact sender patterns (not substring matching) plus
 * Gmail's DMARC result for the platform's domain to prevent spoofing.
 *
 * DMARC pass is MANDATORY — emails without Authentication-Results, or
 * without dmarc=pass for the platform's own domain, are rejected. This prevents spoofed emails from
 * consuming Claude API tokens.
 */

/** Platforms that can arrive via Gmail (subset of the shared Platform type in types.ts). */
export type GmailPlatform = "gigsalad" | "yelp" | "squarespace";

const ALLOWED_SENDERS: Record<GmailPlatform, RegExp> = {
  gigsalad: /^(leads|noreply|notifications)@gigsalad\.com$/i,
  // Yelp sends real lead and reply mail from a per-conversation address,
  // reply+<32 hex>@messaging.yelp.com — NOT from yelp.com. The original
  // no-reply/biz-alerts patterns matched no live traffic, so every Yelp
  // lead was rejected as "Unknown sender" (see
  // docs/brainstorms/2026-08-07-reply-detection-samples.md §4a).
  // Both alternatives stay individually anchored: exact matching is a
  // deliberate anti-spoofing control, not an oversight.
  yelp: /^(no-reply|biz-alerts)@yelp\.com$|^reply\+[0-9a-f]{32}@messaging\.yelp\.com$/i,
  squarespace: /^(form-submission|noreply)@squarespace\.(com|info)$/i,
};

/**
 * Yelp sends a client's REPLY from the same reply+<token> address as the
 * original lead notification, so the sender alone cannot tell them apart.
 * Without this check, every reply would be parsed as a brand-new lead —
 * one observed client sent 3 replies in 29 minutes, which would have
 * become 3 phantom leads, 3 Claude drafts and 3 SMS to Alex.
 *
 * The body marker is authoritative; the subject prefix is the fallback if
 * Yelp changes its body copy.
 */
const REPLY_MARKERS: Partial<Record<GmailPlatform, { subject: RegExp; body: RegExp }>> = {
  yelp: {
    subject: /^\s*re:\s/i,
    body: /has replied to your message/i,
  },
};

/** What an accepted message actually is. Only "lead" may enter the lead pipeline. */
export type MessageKind = "lead" | "reply";

export interface ValidationResult {
  valid: boolean;
  platform?: GmailPlatform;
  /** Present whenever valid is true. */
  kind?: MessageKind;
  reason?: string;
}

/** In-memory rejection counter — exposed via /health endpoint. */
let rejectedEmailCount = 0;

/** Read the current rejection count (for /health). */
export function getRejectedEmailCount(): number {
  return rejectedEmailCount;
}

/** Increment the rejection counter. */
export function incrementRejectedEmailCount(): void {
  rejectedEmailCount++;
}

/**
 * Extract the email address from a "Display Name <email>" format header.
 */
function extractEmail(fromHeader: string): string {
  const match = fromHeader.match(/<([^>]+)>/);
  return (match ? match[1] : fromHeader).trim().toLowerCase();
}

/**
 * The domain DMARC must pass for, per platform. DMARC reports the parent
 * domain: Yelp mail from messaging.yelp.com shows header.from=yelp.com.
 * Checked against real headers on 2026-10-03.
 */
const DMARC_DOMAINS: Record<GmailPlatform, string[]> = {
  gigsalad: ["gigsalad.com"],
  yelp: ["yelp.com"],
  squarespace: ["squarespace.com", "squarespace.info"],
};

/**
 * True only when Gmail's own Authentication-Results says DMARC passed for this
 * platform's domain. A bare dkim=pass proves nothing: every real platform mail
 * also carries a dkim=pass for its email vendor, and an attacker can get one
 * for any domain they own.
 *
 * Only a header whose authserv-id is mx.google.com counts. The caller reads
 * the first Authentication-Results header, which Gmail adds on receipt.
 */
function checkAuthHeaders(authResults: string, platform: GmailPlatform): boolean {
  if (!authResults) return false;
  let text = authResults;
  // Drop (comments), which can contain arbitrary text, before reading clauses.
  for (let prev = ""; prev !== text; ) {
    prev = text;
    text = text.replace(/\([^()]*\)/g, " ");
  }
  const [authservId, ...clauses] = text.split(";").map((c) => c.trim().toLowerCase());
  if (authservId !== "mx.google.com") return false;
  const dmarc = clauses.find((c) => /^dmarc=/.test(c));
  if (!dmarc || !/^dmarc=pass\b/.test(dmarc)) return false;
  const from = dmarc.match(/\bheader\.from=([a-z0-9.-]+)/)?.[1];
  return !!from && DMARC_DOMAINS[platform].includes(from);
}

/**
 * Validate an incoming email against the sender allowlist and auth headers.
 * DMARC pass for the platform's domain is mandatory.
 *
 * A reply to an existing conversation is still `valid: true` — it is genuine,
 * authenticated mail from a known platform. It is distinguished by `kind`
 * instead, so callers can tell "this is a reply" apart from "this was
 * rejected". Marking replies invalid would make legitimate client mail
 * indistinguishable from a spoofing attempt in the logs and the counter.
 *
 * @param fromHeader - The "From" header value (e.g., "GigSalad <leads@gigsalad.com>")
 * @param authenticationResults - Gmail's first "Authentication-Results" header (for DMARC)
 * @param subject - Message subject. Omit only when the kind is irrelevant to the caller.
 * @param body - Message body (text preferred). Same caveat as subject.
 */
export function validateSource(
  fromHeader: string,
  authenticationResults: string = "",
  subject: string = "",
  body: string = ""
): ValidationResult {
  const email = extractEmail(fromHeader);

  // Match against allowlist
  for (const [platform, pattern] of Object.entries(ALLOWED_SENDERS)) {
    if (pattern.test(email)) {
      // DMARC pass for the platform's domain is mandatory
      if (!checkAuthHeaders(authenticationResults, platform as GmailPlatform)) {
        return {
          valid: false,
          platform: platform as GmailPlatform,
          reason: `Sender ${email} matched ${platform} but DMARC did not pass for its domain`,
        };
      }
      return {
        valid: true,
        platform: platform as GmailPlatform,
        kind: classifyKind(platform as GmailPlatform, subject, body),
      };
    }
  }

  return { valid: false, reason: `Unknown sender: ${email}` };
}

/**
 * Decide whether an accepted message is a new lead or a reply to an existing
 * conversation. Biased toward "lead": a reply misread as a lead creates a
 * visible phantom lead, while a lead misread as a reply is silently dropped,
 * which is the exact failure this file was just fixed for.
 */
function classifyKind(platform: GmailPlatform, subject: string, body: string): MessageKind {
  const markers = REPLY_MARKERS[platform];
  if (!markers) return "lead";
  if (markers.body.test(body)) return "reply";
  if (markers.subject.test(subject)) return "reply";
  return "lead";
}
