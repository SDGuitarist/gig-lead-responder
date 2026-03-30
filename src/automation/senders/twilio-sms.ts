import type { AutomationConfig } from "../config.js";

/**
 * Send an SMS notification via Twilio.
 * Used for edge case holds, failure alerts, and system health checks.
 *
 * Keeps messages under 160 chars for single-segment SMS.
 * Does NOT include portal URLs (may be tokenized — Codex fix #6).
 */
export async function sendSms(
  config: AutomationConfig,
  body: string
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
    // Dynamic import — Twilio is optional until actually needed
    const twilio = (await import("twilio")).default;
    const client = twilio(config.twilio.accountSid, config.twilio.authToken, {
      autoRetry: true,
      maxRetries: 3,
    });

    const msg = await client.messages.create({
      to: config.twilio.toNumber,
      from: config.twilio.fromNumber,
      body: body.slice(0, 160), // Single SMS segment
    });

    console.log(`SMS sent: ${msg.sid}`);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Twilio error: ${message}`);
    return { success: false, error: message };
  }
}
