// The one place alerts to Alex go out (plan 0.3 → Module 1 §1.5).
//
// Twilio is removed: it was never registered for 10DLC, so it never delivered.
// The iMessage channel arrives in Module 1 and plugs in here. Until then every
// alert reports "not delivered", so no caller can record a send that never
// happened (post-pipeline marks a lead "sent" only after a successful alert).

export class AlertNotDeliveredError extends Error {
  constructor() {
    super("no alert channel");
    this.name = "AlertNotDeliveredError";
  }
}

function logUndelivered(body: string): void {
  console.warn(`[ALERT NOT DELIVERED] ${body.split("\n")[0].slice(0, 120)}`);
}

/** Throws when the alert is not delivered (replaces sendSms). */
export async function alertAlex(body: string): Promise<void> {
  logUndelivered(body);
  throw new AlertNotDeliveredError();
}

/** Never throws; reports delivery in the result (replaces sendSmsSafe). */
export async function alertAlexSafe(
  _config: { dryRun: boolean },
  body: string,
): Promise<{ success: boolean; error?: string }> {
  logUndelivered(body);
  return { success: false, error: "no alert channel" };
}
