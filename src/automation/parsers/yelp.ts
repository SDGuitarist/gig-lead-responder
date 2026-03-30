import type { GmailMessage } from "../gmail-watcher.js";
import type { YelpLead } from "../types.js";

/**
 * Parse a Yelp lead notification email.
 *
 * IMPORTANT: Yelp truncates the client's message in the email notification.
 * This parser extracts what it can (portal URL, client name, truncated text)
 * and always returns parseConfidence: "low" with enriched: false.
 *
 * The orchestrator must call YelpPortalClient.fetchLeadDetails() to get
 * the full message before running the pipeline.
 */
export function parseYelpEmail(msg: GmailMessage): YelpLead {
  const warnings: string[] = ["Yelp emails truncate client messages — portal enrichment required"];
  const body = msg.bodyText || msg.bodyHtml;

  // Extract the portal URL from the email
  const portalUrl = extractYelpPortalUrl(msg.bodyHtml || body || "");

  if (!portalUrl) {
    warnings.push("No portal URL found in email");
  }

  // Extract what we can from the truncated email
  const clientName = extractClientName(body || "");
  const truncatedText = extractTruncatedMessage(body || "");

  return {
    platform: "yelp",
    rawText: truncatedText || "(truncated — awaiting portal enrichment)",
    parseConfidence: "low", // ALWAYS low until portal enrichment
    parseWarnings: warnings,
    enriched: false,
    clientName,
    gmailMessageId: msg.id,
    threadId: msg.threadId,
    messageIdHeader: msg.messageIdHeader,
    receivedAt: new Date(msg.date),
    portalUrl: portalUrl || "",
  };
}

function extractYelpPortalUrl(html: string): string | undefined {
  // Yelp notification emails link to the business messaging portal
  const patterns = [
    /href="(https:\/\/biz\.yelp\.com\/[^"]*message[^"]+)"/i,
    /href="(https:\/\/biz\.yelp\.com\/[^"]*lead[^"]+)"/i,
    /href="(https:\/\/biz\.yelp\.com\/[^"]+)"/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return match[1];
  }

  return undefined;
}

function extractClientName(body: string): string | undefined {
  // Yelp emails often include "Message from [Name]" or "[Name] sent you a message"
  const patterns = [
    /message from\s+([A-Z][a-z]+(?:\s+[A-Z]\.?)?)/i,
    /([A-Z][a-z]+(?:\s+[A-Z]\.?)?)\s+sent you/i,
    /new message from\s+([A-Z][a-z]+(?:\s+[A-Z]\.?)?)/i,
  ];

  for (const pattern of patterns) {
    const match = body.match(pattern);
    if (match) return match[1].trim();
  }

  return undefined;
}

function extractTruncatedMessage(body: string): string {
  // Try to get whatever partial message Yelp includes
  // This is usually a few lines before "View message" or "Reply on Yelp"
  const lines = body.split("\n").map((l) => l.trim()).filter(Boolean);

  const messageLines: string[] = [];
  let capturing = false;

  for (const line of lines) {
    // Stop at CTA buttons
    if (/^(View|Reply|Respond|See full|Read more)/i.test(line)) break;

    // Start capturing after "sent you a message" or similar
    if (/sent you|new message|wrote:/i.test(line)) {
      capturing = true;
      continue;
    }

    if (capturing && line.length > 10) {
      messageLines.push(line);
    }
  }

  return messageLines.join("\n");
}
