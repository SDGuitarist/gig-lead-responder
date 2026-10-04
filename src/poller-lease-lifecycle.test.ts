import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { handlePollError, startLeaseRenewal, stopGmailPoller } from "./automation/poller.js";

// Codex round 1 (Phase 0 runtime): after invalid_grant the poller stopped polling
// but kept renewing the lease, so this process held it for as long as it lived;
// and a throwing renewal (SQLITE_BUSY in the IMMEDIATE transaction) escaped the timer.

test("poller lease lifecycle: invalid_grant stops lease renewal", async () => {
  mock.timers.enable({ apis: ["setInterval"] });
  try {
    let renewals = 0;
    startLeaseRenewal(() => { renewals += 1; return true; });
    mock.timers.tick(20_000);
    assert.equal(renewals, 1, "control: renewal runs while polling");
    handlePollError(new Error("invalid_grant: Token has been expired or revoked."));
    mock.timers.tick(60_000);
    assert.equal(renewals, 1, "no renewal after auth failure");
  } finally {
    mock.timers.reset();
    await stopGmailPoller();
  }
});

test("poller lease lifecycle: a non-auth poll error keeps renewing", async () => {
  mock.timers.enable({ apis: ["setInterval"] });
  try {
    let renewals = 0;
    startLeaseRenewal(() => { renewals += 1; return true; });
    handlePollError(new Error("ECONNRESET"));
    mock.timers.tick(40_000);
    assert.equal(renewals, 2, "overshoot control: only auth failure stops renewal");
  } finally {
    mock.timers.reset();
    await stopGmailPoller();
  }
});

test("poller lease lifecycle: a throwing renewal is caught and renewal goes on", async () => {
  mock.timers.enable({ apis: ["setInterval"] });
  try {
    let calls = 0;
    startLeaseRenewal(() => {
      calls += 1;
      if (calls === 1) throw Object.assign(new Error("database is locked"), { code: "SQLITE_BUSY" });
      return true;
    });
    assert.doesNotThrow(() => mock.timers.tick(20_000), "the error stays inside the timer");
    mock.timers.tick(20_000);
    assert.equal(calls, 2, "the next renewal still runs");
  } finally {
    mock.timers.reset();
    await stopGmailPoller();
  }
});
