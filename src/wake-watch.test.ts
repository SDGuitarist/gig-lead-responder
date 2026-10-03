import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createWakeCheck } from "./wake-watch.js";

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "glr-wake-")), "leads.db");

test("wake catch-up: normal 30-second ticks never fire", () => {
  let t = 0;
  const fired: number[] = [];
  const check = createWakeCheck(() => t, (gap) => fired.push(gap));
  for (let i = 0; i < 10; i++) {
    t += 30_000;
    check.tick();
  }
  t += 30_000 + 119_000; // late, but under the 2-minute jump
  check.tick();
  assert.deepEqual(fired, []);
});

test("wake catch-up: a 10-minute sleep fires once with the gap", () => {
  let t = 0;
  const fired: number[] = [];
  const check = createWakeCheck(() => t, (gap) => fired.push(gap));
  t += 30_000;
  check.tick();
  t += 10 * 60_000; // lid closed
  check.tick();
  t += 30_000;
  check.tick();
  assert.deepEqual(fired, [10 * 60_000]);
});

test("wake catch-up: after a sleep, the poll reads from the stored cursor", async () => {
  const { pollOnce } = await import("./automation/poller.js");
  const { savePollSuccess } = await import("./db/poller-state.js");
  const sleptAt = 1_791_000_000;
  savePollSuccess(sleptAt - 300, new Date(sleptAt * 1000).toISOString());

  let t = sleptAt * 1000;
  const asked: number[] = [];
  const polls: Promise<void>[] = [];
  const check = createWakeCheck(
    () => t,
    () =>
      polls.push(
        pollOnce({
          fetchSince: async (after) => {
            asked.push(after);
            return [];
          },
          handle: async () => {},
          now: () => t,
        }),
      ),
  );
  t += 10 * 60_000;
  check.tick();
  await Promise.all(polls);
  assert.deepEqual(asked, [sleptAt - 300]);
});
