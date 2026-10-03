import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "glr-plock-")), "leads.db");
const { pollOnce } = await import("./automation/poller.js");
const { currentHolder, isPidAlive } = await import("./automation/lease-holder.js");

test("poller skips without the lease: no fetch while another process holds it", async () => {
  let fetched = 0;
  await pollOnce({
    fetchSince: async () => {
      fetched++;
      return [];
    },
    handle: async () => {},
    now: () => Date.now(),
    acquireLease: () => false,
  });
  assert.equal(fetched, 0);
});

test("poller skips without the lease: holder identity is stable and matches this boot", () => {
  const a = currentHolder();
  const b = currentHolder();
  assert.deepEqual(a, b);
  assert.equal(a.pid, process.pid);
  const sec = Number(/sec = (\d+)/.exec(execFileSync("sysctl", ["-n", "kern.boottime"], { encoding: "utf8" }))![1]);
  assert.equal(a.boot, sec);
});

test("poller skips without the lease: pid liveness known answers", () => {
  assert.equal(isPidAlive(process.pid), true);
  assert.equal(isPidAlive(2 ** 22 + 12345), false);
});
