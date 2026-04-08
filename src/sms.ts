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

/** Send SMS using env-var credentials. Throws on failure. Used by server-side callers. */
export async function sendSms(body: string): Promise<void> {
  const from = process.env.TWILIO_FROM_NUMBER;
  const to = process.env.ALEX_PHONE;
  if (!from || !to) {
    throw new Error("TWILIO_FROM_NUMBER and ALEX_PHONE must be set");
  }

  await getClient().messages.create({ body, from, to });
}

/** Config-based SMS for automation — supports dry-run, never throws. */
export async function sendSmsSafe(
  config: { dryRun: boolean; twilio: { accountSid: string; authToken: string; fromNumber: string; toNumber: string } },
  body: string,
): Promise<{ success: boolean; error?: string }> {
  if (!config.twilio.accountSid || !config.twilio.authToken) {
    console.warn("Twilio not configured — SMS skipped:", body);
    return { success: false, error: "Twilio not configured" };
  }

  if (config.dryRun) {
    console.log(`[DRY-RUN] Would send SMS: ${body.slice(0, 160)}`);
    return { success: true };
  }

  try {
    const c = twilio(config.twilio.accountSid, config.twilio.authToken, {
      autoRetry: true,
      maxRetries: 3,
    });

    const msg = await c.messages.create({
      to: config.twilio.toNumber,
      from: config.twilio.fromNumber,
      body: body.slice(0, 160),
    });

    console.log(`SMS sent: ${msg.sid}`);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Twilio error: ${message}`);
    return { success: false, error: message };
  }
}
