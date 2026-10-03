import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { GmailMessage } from "./automation/gmail-watcher.js";

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "glr-gap-")), "leads.db");

const HOUR = 3600;
const msg = (id: string) => ({ id }) as GmailMessage;

test("poller gap recovery: after an 8-hour gap the next poll starts at the stored cursor", async () => {
  const { pollOnce } = await import("./automation/poller.js");
  const { savePollSuccess, getPollerState } = await import("./db/poller-state.js");

  const stopped = 1_791_000_000;
  savePollSuccess(stopped, new Date(stopped * 1000).toISOString());

  const asked: number[] = [];
  const handled: string[] = [];
  const restartMs = (stopped + 8 * HOUR) * 1000;
  await pollOnce({
    fetchSince: async (after) => {
      asked.push(after);
      return [msg("a"), msg("b"), msg("c")];
    },
    handle: async (m) => {
      handled.push(m.id);
    },
    now: () => restartMs,
  });

  assert.deepEqual(asked, [stopped]);
  assert.deepEqual(handled, ["a", "b", "c"]);
  // The cursor moves to the poll's start, less the 5-minute safety overlap.
  assert.equal(getPollerState().cursorTs, stopped + 8 * HOUR - 300);
  assert.equal(getPollerState().auth, "ok");
});

test("poller gap recovery: a failed fetch leaves the cursor where it was", async () => {
  const { pollOnce } = await import("./automation/poller.js");
  const { getPollerState } = await import("./db/poller-state.js");
  const before = getPollerState().cursorTs;
  await assert.rejects(
    pollOnce({
      fetchSince: async () => {
        throw new Error("socket hang up");
      },
      handle: async () => {},
      now: () => Date.now(),
    }),
    /socket hang up/,
  );
  assert.equal(getPollerState().cursorTs, before);
});

test("poller auth failure recorded: invalid_grant marks auth failed and keeps the cursor", async () => {
  const { pollOnce } = await import("./automation/poller.js");
  const { getPollerState } = await import("./db/poller-state.js");
  const before = getPollerState().cursorTs;
  await assert.rejects(
    pollOnce({
      fetchSince: async () => {
        throw new Error("invalid_grant");
      },
      handle: async () => {},
      now: () => Date.now(),
    }),
    /invalid_grant/,
  );
  assert.equal(getPollerState().auth, "failed");
  assert.equal(getPollerState().cursorTs, before);
});
