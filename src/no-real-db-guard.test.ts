import { test } from "node:test";
import assert from "node:assert/strict";
import { realpathSync } from "node:fs";
import { tmpdir } from "node:os";

// .env sets DATABASE_PATH to the real data/leads.db, and initDb now runs
// migrations on whatever it opens. A test that forgets its own temp path must
// get a throwaway DB, never the real one.
test("test runs cannot open the real database", async () => {
  process.env.DATABASE_PATH = "./data/leads.db";
  const { initDb } = await import("./db/migrate.js");
  const opened = realpathSync(initDb().name);
  assert.ok(opened.startsWith(realpathSync(tmpdir())), `opened ${opened}`);
});
