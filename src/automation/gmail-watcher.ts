/**
 * Gmail API poller — checks for new lead emails every 60 seconds.
 *
 * Requires: credentials.json + data/gmail-token.json (run scripts/gmail-auth.ts first)
 * Uses: googleapis npm package
 */
import { google, type gmail_v1 } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import type { AutomationConfig } from "./config.js";

/**
 * Load OAuth2 client from stored credentials and token.
 * Token auto-refreshes via the googleapis library.
 */
export function loadAuthClient(config: AutomationConfig): OAuth2Client {
  if (!existsSync(config.gmail.credentialsPath)) {
    throw new Error(
      `Gmail credentials not found at ${config.gmail.credentialsPath}. ` +
      `Download from Google Cloud Console.`
    );
  }
  if (!existsSync(config.gmail.tokenPath)) {
    throw new Error(
      `Gmail token not found at ${config.gmail.tokenPath}. ` +
      `Run: npx tsx scripts/gmail-auth.ts`
    );
  }

  const { installed } = JSON.parse(readFileSync(config.gmail.credentialsPath, "utf-8"));
  const client = new google.auth.OAuth2(
    installed.client_id,
    installed.client_secret,
    "http://localhost:3001"
  );

  const token = JSON.parse(readFileSync(config.gmail.tokenPath, "utf-8"));
  client.setCredentials(token);

  // Auto-save refreshed tokens
  client.on("tokens", (newTokens) => {
    const merged = { ...token, ...newTokens };
    writeFileSync(config.gmail.tokenPath, JSON.stringify(merged, null, 2), { mode: 0o600 });
    console.log("Gmail token refreshed and saved.");
  });

  return client;
}

/** Gmail uses base64url encoding — decode to UTF-8 */
function decodeBase64Url(encoded: string): string {
  return Buffer.from(encoded, "base64url").toString("utf-8");
}

/** Recursively extract text/plain and text/html from MIME parts */
function extractBody(payload: gmail_v1.Schema$MessagePart | undefined): {
  text: string;
  html: string;
} {
  let text = "";
  let html = "";

  function walk(part: gmail_v1.Schema$MessagePart | undefined): void {
    if (!part) return;
    if (part.body?.data) {
      const decoded = decodeBase64Url(part.body.data);
      if (part.mimeType === "text/plain") text = decoded;
      if (part.mimeType === "text/html") html = decoded;
    }
    part.parts?.forEach(walk);
  }

  walk(payload);
  return { text, html };
}

/** Extract a header value by name (case-insensitive) */
function getHeader(
  headers: gmail_v1.Schema$MessagePartHeader[] | undefined,
  name: string
): string {
  const h = headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase());
  return h?.value || "";
}

/** Parsed Gmail message with extracted fields */
export interface GmailMessage {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  replyTo: string;
  messageIdHeader: string;
  authenticationResults: string;
  bodyText: string;
  bodyHtml: string;
}

/** Fetch and parse a single Gmail message by ID */
/** The id of a fetched message: it must be the id we asked for (Codex round 1, Phase 0 runtime). */
export function fetchedMessageId(requested: string, got: string | null | undefined): string {
  // No ids in the message: the poller reads "401" in any error text as an auth failure.
  if (got !== requested) throw new Error("Gmail message fetch returned a different or missing id");
  return got;
}

async function fetchMessage(
  gmail: gmail_v1.Gmail,
  messageId: string
): Promise<GmailMessage> {
  const res = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "full",
  });

  const msg = res.data;
  const headers = msg.payload?.headers;
  const { text, html } = extractBody(msg.payload);

  return {
    id: fetchedMessageId(messageId, msg.id),
    threadId: msg.threadId || "",
    from: getHeader(headers, "From"),
    to: getHeader(headers, "To"),
    subject: getHeader(headers, "Subject"),
    date: getHeader(headers, "Date"),
    replyTo: getHeader(headers, "Reply-To"),
    messageIdHeader: getHeader(headers, "Message-ID"),
    authenticationResults: getHeader(headers, "Authentication-Results"),
    bodyText: text,
    bodyHtml: html,
  };
}

type ListPage = { messages?: { id?: string | null }[] | null; nextPageToken?: string | null };

// Gmail ids are short hex strings; this accepts any URL-safe token and nothing else.
const GMAIL_ID = /^[A-Za-z0-9_-]+$/;

/**
 * Parses one Gmail list page ONCE into trusted ids and the next token, or throws
 * (the poll fails and the cursor holds). Codex round 1, Phase 0 runtime.
 */
function parseListPage(page: unknown): { ids: string[]; next: string | undefined } {
  const bad = (what: string): never => { throw new Error(`Gmail list page invalid: ${what}`); };
  if (typeof page !== "object" || page === null || Array.isArray(page)) return bad("not an object");
  const { messages, nextPageToken } = page as Record<string, unknown>;
  if (messages !== undefined && messages !== null && !Array.isArray(messages)) bad("messages is not an array");
  const ids = ((messages as unknown[] | null | undefined) ?? []).map((m, i) => {
    const id = typeof m === "object" && m !== null ? (m as Record<string, unknown>).id : undefined;
    return typeof id === "string" && GMAIL_ID.test(id) ? id : bad(`messages[${i}] has no valid id`);
  });
  if (nextPageToken !== undefined && nextPageToken !== null && typeof nextPageToken !== "string") bad("nextPageToken is not a string");
  return { ids, next: (nextPageToken as string | null | undefined) || undefined };
}

/**
 * Every inbox message id after the timestamp (2-minute overlap for safety),
 * following page tokens so a long gap is read in full.
 */
export async function listMessageIdsSince(
  list: (params: { q: string; pageToken?: string }) => Promise<ListPage | unknown>,
  afterTimestamp: number
): Promise<string[]> {
  const q = `in:inbox after:${afterTimestamp - 120}`;
  const ids: string[] = [];
  const seen = new Set<string>();
  let pageToken: string | undefined;
  do {
    const { ids: pageIds, next } = parseListPage(await list({ q, pageToken }));
    ids.push(...pageIds);
    if (next && seen.has(next)) throw new Error("Gmail list page invalid: page token repeated");
    if (next) seen.add(next);
    pageToken = next;
  } while (pageToken);
  return ids;
}

/**
 * Poll Gmail for new messages since the last check.
 * Returns full parsed messages for any new emails found.
 */
export async function pollForNewMessages(
  auth: OAuth2Client,
  afterTimestamp: number
): Promise<GmailMessage[]> {
  const gmail = google.gmail({ version: "v1", auth });

  const ids = await listMessageIdsSince(
    async ({ q, pageToken }) =>
      (await gmail.users.messages.list({ userId: "me", q, maxResults: 100, pageToken })).data,
    afterTimestamp
  );

  const messages: GmailMessage[] = [];
  for (const id of ids) {
    messages.push(await fetchMessage(gmail, id));
  }
  return messages;
}

/**
 * Send an email via Gmail API.
 * Used for Squarespace lead replies.
 */
export async function sendGmailReply(
  auth: OAuth2Client,
  options: {
    to: string;
    subject: string;
    body: string;
    threadId?: string;
    inReplyTo?: string;
  }
): Promise<string> {
  const gmail = google.gmail({ version: "v1", auth });

  const emailLines = [
    `To: ${options.to}`,
    `Subject: ${options.subject}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    ...(options.inReplyTo
      ? [`In-Reply-To: ${options.inReplyTo}`, `References: ${options.inReplyTo}`]
      : []),
    "",
    options.body,
  ];

  const raw = Buffer.from(emailLines.join("\r\n")).toString("base64url");

  const res = await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw,
      threadId: options.threadId,
    },
  });

  return res.data.id || "";
}
