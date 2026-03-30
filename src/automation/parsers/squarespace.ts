import type { GmailMessage } from "../gmail-watcher.js";
import type { ParseConfidence, SquarespaceLead } from "../types.js";

/**
 * Parse a Squarespace form submission email.
 *
 * Squarespace contact form notifications include:
 * - Client's email in the Reply-To header (primary source)
 * - Form field values in the body (Name, Email, Message, etc.)
 *
 * This is the simplest parser — replies go via Gmail API, not portal.
 */
export function parseSquarespaceEmail(msg: GmailMessage): SquarespaceLead {
  const warnings: string[] = [];
  const body = msg.bodyText || msg.bodyHtml;

  // Extract client email from Reply-To header (Codex fix #5)
  const clientEmail = extractEmailFromHeader(msg.replyTo);
  if (!clientEmail) {
    warnings.push("No Reply-To header — cannot determine client email");
    return makeResult(msg, body || "", "low", warnings, "", msg.replyTo);
  }

  // Extract form fields from the body
  const rawText = extractFormFields(body || "");
  if (!rawText) {
    warnings.push("Could not extract form fields from email body");
    return makeResult(msg, body || "", "medium", warnings, clientEmail, msg.replyTo);
  }

  const clientName = extractClientName(rawText);
  const confidence: ParseConfidence = warnings.length > 0 ? "medium" : "high";

  return {
    ...makeResult(msg, rawText, confidence, warnings, clientEmail, msg.replyTo),
    clientName,
  };
}

function extractEmailFromHeader(header: string): string {
  if (!header) return "";
  // Handle "Display Name <email>" or plain "email" format
  const match = header.match(/<([^>]+)>/);
  const email = (match ? match[1] : header).trim().toLowerCase();
  // Basic email format check
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function extractFormFields(body: string): string {
  // Squarespace form emails have labeled fields like:
  //   Name: John Smith
  //   Email: john@example.com
  //   Phone: 555-1234
  //   Message: We're looking for a guitarist...
  //   Event Date: April 15, 2026
  const lines = body.split("\n").map((l) => l.trim()).filter(Boolean);

  const fields: string[] = [];
  let inMessage = false;
  const messageLines: string[] = [];

  for (const line of lines) {
    if (inMessage) {
      // Stop at footer/signature markers
      if (/^(sent via|powered by|squarespace|---|\*)/i.test(line)) break;
      messageLines.push(line);
      continue;
    }

    // Capture labeled fields
    if (/^(Name|Email|Phone|Event|Date|Location|Budget|Guest|Service|Message|Subject|Type)/i.test(line) && line.includes(":")) {
      fields.push(line);
    }

    // Start message capture
    if (/^Message:/i.test(line)) {
      inMessage = true;
      const afterColon = line.split(":").slice(1).join(":").trim();
      if (afterColon) messageLines.push(afterColon);
    }
  }

  if (fields.length === 0) return "";

  const parts = [...fields];
  if (messageLines.length > 0 && !fields.some((f) => f.startsWith("Message:"))) {
    parts.push(`Message: ${messageLines.join(" ")}`);
  }

  return parts.join("\n");
}

function extractClientName(rawText: string): string | undefined {
  const match = rawText.match(/^Name:\s*(.+)$/im);
  return match ? match[1].trim() : undefined;
}

function makeResult(
  msg: GmailMessage,
  rawText: string,
  parseConfidence: ParseConfidence,
  parseWarnings: string[],
  clientEmail: string,
  replyToHeader: string
): SquarespaceLead {
  return {
    platform: "squarespace",
    rawText,
    parseConfidence,
    parseWarnings,
    clientEmail,
    replyToHeader,
    gmailMessageId: msg.id,
    threadId: msg.threadId,
    messageIdHeader: msg.messageIdHeader,
    receivedAt: new Date(msg.date),
  };
}
