import { test } from "node:test";
import assert from "node:assert/strict";
import { pollNow } from "./automation/poller.js";
import { kickFollowUpScheduler } from "./follow-up-scheduler.js";

// On wake, server.ts calls both. Before either loop has started they must do
// nothing (a Mac without Gmail configured must not start polling on wake).
test("wake catch-up wiring: does nothing before the poller and scheduler start", async () => {
  assert.equal(await pollNow(), false);
  assert.equal(kickFollowUpScheduler(), false);
});
