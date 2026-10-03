import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "glr-health-")), "leads.db");
const { createApp } = await import("./app.js");
const { savePollSuccess, savePollAuthFailed } = await import("./db/poller-state.js");

async function health(): Promise<Record<string, unknown>> {
  const srv = http.createServer(createApp());
  await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r));
  try {
    const port = (srv.address() as { port: number }).port;
    return (await (await fetch(`http://127.0.0.1:${port}/health`)).json()) as Record<string, unknown>;
  } finally {
    srv.close();
  }
}

// /health used to say "ok" whether or not the poller had ever run (todo 020).
test("health reports poller state: never, ok, then failed", async () => {
  assert.deepEqual((await health()).poller, { last_success_at: null, auth: "never" });

  savePollSuccess(1_791_000_000, "2026-10-03T16:00:00.000Z");
  assert.deepEqual((await health()).poller, { last_success_at: "2026-10-03T16:00:00.000Z", auth: "ok" });

  savePollAuthFailed();
  assert.deepEqual((await health()).poller, { last_success_at: "2026-10-03T16:00:00.000Z", auth: "failed" });
});

test("health reports lease host: null until held, then the holder's host", async () => {
  const { tryAcquireLease } = await import("./db/runtime-lease.js");
  assert.deepEqual((await health()).lease, { host: null });
  tryAcquireLease({ host: "alex-mbp", pid: process.pid, boot: 1 }, Date.now(), () => true);
  assert.deepEqual((await health()).lease, { host: "alex-mbp" });
});
