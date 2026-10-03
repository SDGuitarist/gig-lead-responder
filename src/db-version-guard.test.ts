import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";

// initDb() must run the migration runner, so a DB written by newer code
// stops startup instead of being used by older code.
const dbPath = join(mkdtempSync(join(tmpdir(), "glr-ver-")), "leads.db");
const pre = new Database(dbPath);
pre.pragma("user_version = 99");
pre.close();
process.env.DATABASE_PATH = dbPath;

test("startup refuses a database newer than the code", async () => {
  const { initDb } = await import("./db/migrate.js");
  assert.throws(() => initDb(), /newer than this code/);
});
