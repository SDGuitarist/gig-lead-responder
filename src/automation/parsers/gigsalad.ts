import type { GmailMessage } from "../gmail-watcher.js";
import type { GigSaladLead, ParseConfidence } from "../types.js";

/**
 * Parse a GigSalad lead notification email.
 *
 * GigSalad emails are HTML with a plain-text fallback.
 * Key fields: event type, date, time, location, budget, guest count,
 * genre, client message, quotes received, and a response link.
 *
 * NOTE: Selectors are based on known GigSalad email patterns.
 * Capture real emails to examples/emails/gigsalad-*.json and update
 * if the format changes.
 */
export function parseGigSaladEmail(msg: GmailMessage): GigSaladLead {
  const warnings: string[] = [];
  const body = msg.bodyText || msg.bodyHtml;

  if (!body) {
    return makeResult(msg, "", "low", ["Empty email body"]);
  }

  // Extract the response/portal URL from the email
  const portalUrl = extractPortalUrl(msg.bodyHtml || body);
  if (!portalUrl) {
    warnings.push("No portal URL found in email");
  }

  // Try to build a structured lead text from the email body
  // GigSalad plain text typically has labeled fields
  const rawText = extractLeadText(body);

  if (!rawText) {
    return makeResult(msg, body, "low", ["Could not extract structured lead text — using raw body"]);
  }

  const confidence: ParseConfidence = warnings.length > 0 ? "medium" : "high";
  return makeResult(msg, rawText, confidence, warnings, portalUrl);
}

function extractPortalUrl(html: string): string | undefined {
  // Look for GigSalad response links in the email
  // Common patterns: "View Lead", "Send Quote", "Respond Now"
  const patterns = [
    /href="(https:\/\/www\.gigsalad\.com\/leads\/respond\/[^"]+)"/i,
    /href="(https:\/\/www\.gigsalad\.com\/[^"]*lead[^"]+)"/i,
    /href="(https:\/\/www\.gigsalad\.com\/[^"]*quote[^"]+)"/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return match[1];
  }

  return undefined;
}

function extractLeadText(body: string): string {
  // GigSalad plain-text emails typically have this structure:
  //   Event Type: Quinceañera
  //   Date: Saturday, April 26, 2025
  //   Location: San Diego, CA
  //   ...
  //   Message: "We want something elegant..."
  //
  // Extract everything that looks like labeled fields + client message
  const lines = body.split("\n").map((l) => l.trim()).filter(Boolean);

  const labeledFields: string[] = [];
  let inMessage = false;
  const messageLines: string[] = [];

  for (const line of lines) {
    if (inMessage) {
      // Collect message text until we hit another labeled field or a CTA
      if (/^(View|Send|Respond|Quote|---)/i.test(line)) break;
      messageLines.push(line);
      continue;
    }

    // Check for labeled fields (Key: Value pattern)
    if (/^(Event|Date|Time|Location|Guest|Budget|Genre|Category|Equipment|Quotes|Duration|Additional)/i.test(line)) {
      labeledFields.push(line);
    }

    // Start of client message section
    if (/^(Message|Additional Notes|Client Message|Note)/i.test(line)) {
      inMessage = true;
      // The value might be on the same line after ":"
      const afterColon = line.split(":").slice(1).join(":").trim();
      if (afterColon) messageLines.push(afterColon);
    }
  }

  if (labeledFields.length === 0) {
    // Couldn't find structured fields — return empty to signal low confidence
    return "";
  }

  // Assemble into the format the pipeline expects
  const parts = [...labeledFields];
  if (messageLines.length > 0) {
    parts.push(`Additional Notes: ${messageLines.join(" ")}`);
  }

  return parts.join("\n");
}

function makeResult(
  msg: GmailMessage,
  rawText: string,
  parseConfidence: ParseConfidence,
  parseWarnings: string[],
  portalUrl?: string
): GigSaladLead {
  return {
    platform: "gigsalad",
    rawText,
    parseConfidence,
    parseWarnings,
    gmailMessageId: msg.id,
    threadId: msg.threadId,
    messageIdHeader: msg.messageIdHeader,
    receivedAt: new Date(msg.date),
    portalUrl: portalUrl || "",
  };
}
