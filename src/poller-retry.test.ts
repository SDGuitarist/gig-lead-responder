import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { GmailMessage } from "./automation/gmail-watcher.js";

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "glr-retry-")), "leads.db");

const msg = (id: string) => ({ id }) as GmailMessage;
const T0 = 1_791_000_000;

// A lead that fails partway must not be skipped for good: the cursor stays
// put so the next poll fetches it again (the done-list skips the rest).
test("poller retries a failed lead: the cursor holds until it succeeds", async () => {
  const { pollOnce } = await import("./automation/poller.js");
  const { savePollSuccess, getPollerState } = await import("./db/poller-state.js");
  savePollSuccess(T0, new Date(T0 * 1000).toISOString());

  let failB = true;
  const handle = async (m: GmailMessage) => {
    if (m.id === "b" && failB) throw new Error("yelp portal timeout");
  };
  const fetchSince = async () => [msg("a"), msg("b")];

  await pollOnce({ fetchSince, handle, now: () => (T0 + 600) * 1000 });
  assert.equal(getPollerState().cursorTs, T0, "cursor must not pass a failed lead");

  failB = false;
  await pollOnce({ fetchSince, handle, now: () => (T0 + 1200) * 1000 });
  assert.equal(getPollerState().cursorTs, T0 + 1200 - 300);
});

test("poller retries a failed lead: gives up after 3 attempts so one bad email can't freeze polling", async () => {
  const { pollOnce } = await import("./automation/poller.js");
  const { savePollSuccess, getPollerState } = await import("./db/poller-state.js");
  savePollSuccess(T0, new Date(T0 * 1000).toISOString());

  const attempts: string[] = [];
  const deps = (t: number) => ({
    fetchSince: async () => [msg("poison")],
    handle: async (m: GmailMessage) => {
      attempts.push(m.id);
      throw new Error("parse crash");
    },
    now: () => t * 1000,
  });

  await pollOnce(deps(T0 + 60));
  await pollOnce(deps(T0 + 120));
  assert.equal(getPollerState().cursorTs, T0);
  await pollOnce(deps(T0 + 180)); // third failure: give up, move on
  assert.equal(getPollerState().cursorTs, T0 + 180 - 300);
  assert.deepEqual(attempts, ["poison", "poison", "poison"]);
});
