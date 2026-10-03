import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";

// The poller used to keep its cursor in memory, so a restart looked back only
// 5 minutes (plan 0.3). Migration v1 stores it in SQLite.
const dbPath = join(mkdtempSync(join(tmpdir(), "glr-cursor-")), "leads.db");
process.env.DATABASE_PATH = dbPath;

test("poller cursor migration v1: creates poller_state with a backup first", async () => {
  const { initDb } = await import("./db/migrate.js");
  const db = initDb();
  assert.ok((db.pragma("user_version", { simple: true }) as number) >= 1);
  const cols = (db.pragma("table_info(poller_state)") as Array<{ name: string }>).map((c) => c.name);
  assert.deepEqual(cols, ["id", "cursor_ts", "last_success_at", "auth"]);
  // A fresh DB still gets its pre-v1 backup.
  const backup = new Database(join(dbPath, "..", "backups", "pre-v1.db"), { readonly: true });
  assert.equal(backup.pragma("user_version", { simple: true }), 0);
});

test("poller cursor migration v1: a fresh DB has no cursor", async () => {
  const { getPollerState } = await import("./db/poller-state.js");
  assert.deepEqual(getPollerState(), { cursorTs: null, lastSuccessAt: null, auth: null });
});

test("poller cursor migration v1: the cursor survives a reopen", async () => {
  const { savePollSuccess, getPollerState } = await import("./db/poller-state.js");
  savePollSuccess(1_791_000_000, "2026-10-03T16:00:00.000Z");
  // Read it back through a separate connection, as a restarted process would.
  const other = new Database(dbPath, { readonly: true });
  const row = other.prepare("SELECT cursor_ts, last_success_at, auth FROM poller_state").get();
  assert.deepEqual(row, { cursor_ts: 1_791_000_000, last_success_at: "2026-10-03T16:00:00.000Z", auth: "ok" });
  assert.equal(getPollerState().cursorTs, 1_791_000_000);
});

test("poller cursor migration v1: an auth failure keeps the cursor", async () => {
  const { savePollAuthFailed, getPollerState } = await import("./db/poller-state.js");
  savePollAuthFailed();
  assert.deepEqual(getPollerState(), {
    cursorTs: 1_791_000_000,
    lastSuccessAt: "2026-10-03T16:00:00.000Z",
    auth: "failed",
  });
});
