import type { OAuth2Client } from "google-auth-library";
import type { SquarespaceLead, SendResult } from "../types.js";
import { sendGmailReply as sendViaGmail } from "../gmail-watcher.js";

/**
 * Send a reply to a Squarespace lead via Gmail API.
 * Preserves thread context so the reply appears in the same conversation.
 */
export async function sendSquarespaceReply(
  auth: OAuth2Client,
  lead: SquarespaceLead,
  replyBody: string
): Promise<SendResult> {
  try {
    const messageId = await sendViaGmail(auth, {
      to: lead.clientEmail,
      subject: "Re: Your Event Inquiry — Alex Guillen Music",
      body: replyBody,
      threadId: lead.threadId,
      inReplyTo: lead.messageIdHeader,
    });

    console.log(`Gmail reply sent to ${lead.clientEmail} (ID: ${messageId})`);
    return { status: "sent", platform: "squarespace", timestamp: new Date() };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Gmail send failed: ${message}`);
    return { status: "failed", platform: "squarespace", error: message, timestamp: new Date() };
  }
}
