import Twilio from "twilio";

// --- Config ---

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const FROM_NUMBER = process.env.TWILIO_PHONE_NUMBER;
const ALEX_PHONE = process.env.ALEX_PHONE_NUMBER;
const BASE_URL = (process.env.BASE_URL || "").replace(/\/+$/, ""); // strip trailing slash

let client: Twilio.Twilio;

function getClient(): Twilio.Twilio {
  if (!client) {
    if (!ACCOUNT_SID || !AUTH_TOKEN) {
      throw new Error("Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN");
    }
    client = Twilio(ACCOUNT_SID, AUTH_TOKEN);
  }
  return client;
}

// --- Core send ---

export async function sendSms(body: string): Promise<string> {
  if (!FROM_NUMBER || !ALEX_PHONE) {
    throw new Error("Missing TWILIO_PHONE_NUMBER or ALEX_PHONE_NUMBER");
  }

  const message = await getClient().messages.create({
    body,
    from: FROM_NUMBER,
    to: ALEX_PHONE,
  });

  return message.sid;
}

// --- Outbound message helpers ---

export async function sendLeadDraft(
  leadId: number,
  compressedDraft: string,
): Promise<string> {
  const body = `Lead #${leadId}\n\n${compressedDraft}\n\nReply YES or YES-${leadId} to approve.\nReply with edits to revise.`;
  return sendSms(body);
}

export async function sendApprovalConfirmation(
  leadId: number,
): Promise<string> {
  const body = `Lead #${leadId} approved. Full draft:\n${BASE_URL}/leads/${leadId}`;
  return sendSms(body);
}

export async function sendReviewNeeded(
  leadId: number,
  reason: string,
): Promise<string> {
  const body = `[REVIEW NEEDED] Lead #${leadId} failed: ${reason}\n${BASE_URL}/leads/${leadId}`;
  return sendSms(body);
}

export async function sendMaxRevisions(leadId: number): Promise<string> {
  const body = `[MAX REVISIONS] Lead #${leadId} reached 3 edit rounds.\nFull draft: ${BASE_URL}/leads/${leadId}`;
  return sendSms(body);
}
