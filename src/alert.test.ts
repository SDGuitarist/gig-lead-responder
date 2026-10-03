import { test } from "node:test";
import assert from "node:assert/strict";
import { alertAlex, alertAlexSafe, AlertNotDeliveredError } from "./alert.js";

// Twilio is removed (plan 0.3) and the iMessage channel is Module 1. Until
// then an alert must report "not delivered": callers mark a lead "sent" only
// when the alert call succeeds, so a fake success would be a false record.
test("alert without a channel reports not delivered", async () => {
  await assert.rejects(alertAlex("Lead #1 — test"), AlertNotDeliveredError);
  const r = await alertAlexSafe({ dryRun: false }, "Lead #1 — test");
  assert.deepEqual(r, { success: false, error: "no alert channel" });
});
