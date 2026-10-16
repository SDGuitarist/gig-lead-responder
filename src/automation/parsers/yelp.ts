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

/** Stored and shown instead of any email text when a quote request is not provably a complete, recognized form. */
export const QUOTE_FORM_PLACEHOLDER = "(Yelp quote request: form not recognized, held for Alex)";

const FORM_LABELS = {
  date: "when do you require this service?",
  details: "are there any other details you'd like to share?",
  location: "in what location do you need the service?",
} as const;
const CANON = {
  date: "When do you require this service?",
  details: "Are there any other details you'd like to share?",
  location: "In what location do you need the service?",
} as const;
const NAME_CHARS = /^[\p{L}][\p{L} .'-]*$/u;

/** Tags removed and entities decoded; used only to read a message that has no plain-text part. */
function htmlToText(html: string): string {
  return decodeEntities(html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, "").replace(/<[^>]+>/g, "\n"));
}

/** Yelp's "requested a quote" notice (template request_a_quote_first_message_v4), as opposed to the older message and reply notices. */
function isQuoteRequest(msg: GmailMessage): boolean {
  const html = msg.bodyHtml || "";
  return /requested a quote from/i.test(msg.bodyText || "") || /requested a quote from/i.test(htmlToText(html)) || /request_a_quote/i.test(html);
}

/** "<Name> requested a quote from <business> for a <service>." -> validated name and service, or undefined. */
function readQuoteSentence(first: string): { name: string; service: string } | undefined {
  const m = first.match(/^(.{1,40}?) requested a quote from .+? for an? (.{1,40}?)\./);
  if (!m || !NAME_CHARS.test(m[1]) || !NAME_CHARS.test(m[2])) return undefined;
  return { name: m[1].trim(), service: m[2].trim() };
}

/** One paragraph per block, each line normalized; paragraphs that are empty after that are dropped. */
function toParagraphs(text: string): string[] {
  return text
    .replace(/\r\n?/g, "\n") // Gmail's plain text arrives with CRLF line ends (found by the real-email run, plan work step 6)
    .replace(/[\u034f\u200b\u200c\u200d\u00ad\ufeff]/g, "")
    .split(/\n[ \t]*\n/)
    .map((block) => block.split("\n").map((l) => normalizeLine(l.trim())).filter(Boolean).join("\n"))
    .filter(Boolean);
}

/**
 * The deterministic form contract (plan 2026-10-16, D1). Returns the lead text only when EVERY rule holds; any doubt returns undefined and the
 * caller stores a placeholder, so nothing outside the form (address, display name, counters, CTA, footer) can reach rawText.
 */
function parseQuoteForm(bodyText: string): { name: string; text: string } | undefined {
  if (!bodyText) return undefined;
  const paras = toParagraphs(bodyText);
  const sentence = paras.length ? readQuoteSentence(paras[0]) : undefined;
  if (!sentence) return undefined;

  const starts = paras.flatMap((p, i) => (/^you have a new .+ request\.?$/i.test(p) ? [i] : []));
  if (starts.length !== 1) return undefined;
  const start = starts[0];
  let end = -1;
  for (let i = start + 1; i + 2 < paras.length; i++) {
    // Yelp's three counters are small whole numbers ("0","0","0" on most mail, "0","4","0" and "0","1","0" seen on real mail).
    if (/^\d{1,3}$/.test(paras[i]) && /^\d{1,3}$/.test(paras[i + 1]) && /^\d{1,3}$/.test(paras[i + 2])) { end = i; break; }
  }
  if (end < 0) return undefined;

  const labelOf = (p: string): keyof typeof FORM_LABELS | undefined => {
    const key = p.replace(/\u2019/g, "'").trim().toLowerCase();
    return (Object.keys(FORM_LABELS) as Array<keyof typeof FORM_LABELS>).find((k) => FORM_LABELS[k] === key);
  };
  const found: Array<{ kind: keyof typeof FORM_LABELS; at: number }> = [];
  for (let i = start + 1; i < end; i++) {
    const kind = labelOf(paras[i]);
    if (kind) found.push({ kind, at: i });
  }
  const kinds = found.map((f) => f.kind);
  const ok = kinds.join(",") === "date,location" || kinds.join(",") === "date,details,location";
  if (!ok) return undefined;

  // The paragraph just before the counters must be the display name: evidence is a match with the name in the first sentence.
  const nameAt = end - 1;
  const loc = found[found.length - 1];
  if (nameAt <= loc.at) return undefined;
  const display = paras[nameAt];
  const first = sentence.name.toLowerCase();
  if (display.includes("\n") || display.length > 40 || !NAME_CHARS.test(display) || !(display.toLowerCase() === first || display.toLowerCase().startsWith(first))) return undefined;

  const answers = found.map((f, k) => {
    const to = k + 1 < found.length ? found[k + 1].at : nameAt;
    return { kind: f.kind, paras: paras.slice(f.at + 1, to) };
  });
  if (answers.some((a) => a.paras.length === 0)) return undefined;
  const locAnswer = answers[answers.length - 1].paras;
  if (locAnswer.length !== 1 || locAnswer[0].length > 80) return undefined;

  const body = answers.map((a) => `${CANON[a.kind]}\n${a.paras.join("\n\n")}`).join("\n\n");
  const text = stripCredentialUrls(`${sentence.name} requested a quote for a ${sentence.service}.\n\n${body}`);
  return { name: sentence.name, text };
}

export function parseYelpEmail(msg: GmailMessage): YelpLead {
  const portalUrl = extractYelpPortalUrl(msg.bodyHtml || msg.bodyText || "");
  const base = {
    platform: "yelp" as const,
    gmailMessageId: msg.id,
    threadId: msg.threadId,
    messageIdHeader: msg.messageIdHeader,
    receivedAt: new Date(msg.date),
    portalUrl: portalUrl || "",
  };

  if (isQuoteRequest(msg)) {
    const form = parseQuoteForm(msg.bodyText);
    if (form) {
      return { ...base, rawText: form.text, parseConfidence: "high", parseWarnings: [], enriched: true, clientName: form.name };
    }
    // Not provably complete: keep NO email text (a stored low-confidence lead still stores rawText before it is held).
    const first = toParagraphs(msg.bodyText || htmlToText(msg.bodyHtml || ""))[0] || "";
    return {
      ...base,
      rawText: QUOTE_FORM_PLACEHOLDER,
      parseConfidence: "low",
      parseWarnings: ["Yelp quote request: form not recognized, no email text kept"],
      enriched: false,
      clientName: readQuoteSentence(first)?.name,
    };
  }

  // Legacy path (message and reply notices). A message with no plain-text part is read from its HTML with the tags removed first.
  const warnings: string[] = ["Yelp emails truncate client messages — portal enrichment required"];
  const body = msg.bodyText || htmlToText(msg.bodyHtml || "");

  if (!portalUrl) {
    warnings.push("No portal URL found in email");
  }

  // Extract what we can from the truncated email
  const clientName = extractClientName(body || "");
  const truncatedText = extractTruncatedMessage(body || "");

  return {
    ...base,
    // Belt and braces: extractTruncatedMessage already drops URLs, but rawText
    // is what gets sent to the Claude API, so it is guarded again here.
    rawText: stripCredentialUrls(truncatedText || "(truncated — awaiting portal enrichment)"),
    parseConfidence: "low", // ALWAYS low until portal enrichment
    parseWarnings: warnings,
    enriched: false,
    clientName,
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
    // Only accept a messaging thread path or a leads_center lead path — never an arbitrary redirect.
    if (/^\/messaging\/[\w-]+\/thread\/[\w-]+\/?$/.test(path) || /^\/leads_center\/[\w-]+\/leads\/[\w-]+\/?$/.test(path)) {
      return `https://biz.yelp.com${path}`;
    }
  }

  // If Yelp ever sends a direct thread link, accept that too: the thread path only. The notice's "I'm not interested" and
  // "I already replied" links are also biz.yelp.com/messaging/... GET links (mark_as_replied_autosubmit) and must never match.
  for (const m of html.matchAll(/href="(https:\/\/biz\.yelp\.com\/messaging\/[^"]+)"/gi)) {
    const url = decodeEntities(m[1]);
    CREDENTIAL_URL.lastIndex = 0;
    const isCredential = CREDENTIAL_URL.test(url);
    CREDENTIAL_URL.lastIndex = 0;
    if (!isCredential && /^https:\/\/biz\.yelp\.com\/messaging\/[\w-]+\/thread\/[\w-]+\/?$/.test(url)) return url;
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
