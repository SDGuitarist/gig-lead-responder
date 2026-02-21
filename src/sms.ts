import twilio from "twilio";

let client: twilio.Twilio | null = null;

function getClient(): twilio.Twilio {
  if (client) return client;

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) {
    throw new Error("TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set");
  }

  client = twilio(sid, token);
  return client;
}

export async function sendSms(body: string): Promise<void> {
  const from = process.env.TWILIO_FROM_NUMBER;
  const to = process.env.ALEX_PHONE;
  if (!from || !to) {
    throw new Error("TWILIO_FROM_NUMBER and ALEX_PHONE must be set");
  }

  await getClient().messages.create({ body, from, to });
}
