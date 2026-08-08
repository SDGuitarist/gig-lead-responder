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
/**
 * Yelp's "Respond Now" button is a PASSWORDLESS LOGIN URL — a bearer
 * credential. It must never reach the database, the dashboard, or the model
 * prompt. Stripped defensively here regardless of which extractor found it.
 */
const CREDENTIAL_URL = /https?:\/\/[^\s)"']*\/login\/passwordless\/[^\s)"']*/gi;

/** Any absolute URL. Removed from captured message text before it is stored. */
const ANY_URL = /https?:\/\/[^\s)"']+/gi;

/** Lines that mark the end of the client's message. */
const STOP_LINE = /^(View|Reply|Respond|See full|Read more|Or simply respond)/i;

/** Remove passwordless login URLs wherever they appear. Exported for tests. */
export function stripCredentialUrls(text: string): string {
  return text.replace(CREDENTIAL_URL, "[redacted-login-url]");
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&nbsp;/gi, " ");
}

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
    // Belt and braces: extractTruncatedMessage already drops URLs, but rawText
    // is what gets sent to the Claude API, so it is guarded again here.
    rawText: stripCredentialUrls(truncatedText || "(truncated — awaiting portal enrichment)"),
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

/**
 * Build a clean thread URL for the Yelp business portal.
 *
 * Yelp does not send a usable portal link. The only biz.yelp.com hrefs in a
 * real notification are a passwordless login URL, plus settings and
 * unsubscribe. The genuine thread path is carried INSIDE the login URL's
 * `return_url` parameter, so take the path and discard the token.
 *
 * The previous implementation matched `biz.yelp.com/[^"]*message[^"]+`, which
 * matched the login URL itself because `return_url=%2Fmessaging%2F...`
 * contains "messag". That stored a live credential as portalUrl.
 */
function extractYelpPortalUrl(html: string): string | undefined {
  const returnUrl = html.match(/return_url=([^"&\s]+)/i);
  if (returnUrl) {
    let path: string;
    try {
      path = decodeURIComponent(decodeEntities(returnUrl[1]));
    } catch {
      path = "";
    }
    // Only accept a messaging thread path — never an arbitrary redirect.
    if (/^\/messaging\/[\w-]+\/thread\/[\w-]+\/?$/.test(path)) {
      return `https://biz.yelp.com${path}`;
    }
  }

  // If Yelp ever sends a direct thread link, accept that too.
  const direct = html.match(/href="(https:\/\/biz\.yelp\.com\/messaging\/[^"]+)"/i);
  if (direct && !CREDENTIAL_URL.test(direct[1])) {
    CREDENTIAL_URL.lastIndex = 0; // regex is /g — reset after .test()
    return decodeEntities(direct[1]);
  }
  CREDENTIAL_URL.lastIndex = 0;

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

/**
 * Strip markdown and table decoration so stop-word checks see real words.
 *
 * Yelp's plaintext part is markdown-ish, so the CTA arrives as
 * `| [ Respond Now ](https://biz.yelp.com/login/passwordless/...)`. A
 * `^`-anchored stop check never matched that, capture ran past the CTA, and
 * the login URL landed inside the stored message.
 */
function normalizeLine(line: string): string {
  return line
    .replace(ANY_URL, "")
    .replace(/\[([^\]]*)\]\(\s*\)/g, "$1") // markdown link whose URL we just removed
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // any remaining markdown link
    .replace(/^[\s|>*_#\-]+/, "")
    .replace(/[\s|*_]+$/, "")
    .trim();
}

function extractTruncatedMessage(body: string): string {
  // Try to get whatever partial message Yelp includes
  // This is usually a few lines before "View message" or "Reply on Yelp"
  const lines = body.split("\n").map((l) => l.trim()).filter(Boolean);

  const messageLines: string[] = [];
  let capturing = false;

  for (const raw of lines) {
    const line = normalizeLine(raw);
    if (!line) continue;

    // Stop at CTA buttons — checked against the NORMALIZED line so markdown
    // and table pipes cannot smuggle the CTA (and its URL) past the guard.
    if (STOP_LINE.test(line)) break;

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
