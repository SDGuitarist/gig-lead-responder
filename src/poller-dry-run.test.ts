import { test } from "node:test";
import assert from "node:assert/strict";
import { resolvePollerDryRun } from "./automation/poller.js";
import type { AutomationConfig } from "./automation/config.js";

// Before Twilio was removed, missing Twilio creds were the only thing forcing
// the poller into dry-run. Until Module 1 ships an alert channel to Alex, the
// poller must stay dry-run no matter what DRY_RUN says.
test("poller stays dry-run without twilio, even when DRY_RUN=false", () => {
  assert.equal(resolvePollerDryRun({ dryRun: false } as AutomationConfig), true);
  assert.equal(resolvePollerDryRun({ dryRun: true } as AutomationConfig), true);
});
