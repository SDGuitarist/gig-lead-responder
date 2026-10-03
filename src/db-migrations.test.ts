import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { runMigrations, type Migration } from "./db/migrations.js";

function freshDb() {
  const dir = mkdtempSync(join(tmpdir(), "glr-mig-"));
  return { db: new Database(join(dir, "leads.db")), backupDir: join(dir, "backups") };
}

const v1: Migration = { version: 1, name: "create t", up: (db) => db.exec("CREATE TABLE t (x INTEGER)") };
const v2: Migration = { version: 2, name: "add y", up: (db) => db.exec("ALTER TABLE t ADD COLUMN y TEXT") };

test("migration backup and guard: runs pending migrations in order and backs up first", () => {
  const { db, backupDir } = freshDb();
  runMigrations(db, [v1, v2], backupDir);
  assert.equal(db.pragma("user_version", { simple: true }), 2);
  assert.ok(existsSync(join(backupDir, "pre-v1.db")));
  assert.ok(existsSync(join(backupDir, "pre-v2.db")));
  // The pre-v2 backup holds the v1 state: table t without column y.
  const snap = new Database(join(backupDir, "pre-v2.db"), { readonly: true });
  const cols = (snap.pragma("table_info(t)") as Array<{ name: string }>).map((c) => c.name);
  assert.deepEqual(cols, ["x"]);
});

test("migration backup and guard: a second run does nothing", () => {
  const { db, backupDir } = freshDb();
  runMigrations(db, [v1], backupDir);
  const applied = runMigrations(db, [v1], backupDir);
  assert.deepEqual(applied, []);
});

test("migration backup and guard: refuses a DB newer than the code", () => {
  const { db, backupDir } = freshDb();
  db.pragma("user_version = 5");
  assert.throws(() => runMigrations(db, [v1, v2], backupDir), /newer than this code/);
});

test("migration backup and guard: a failing migration rolls back and keeps the version", () => {
  const { db, backupDir } = freshDb();
  runMigrations(db, [v1], backupDir);
  const bad: Migration = {
    version: 2,
    name: "half-done",
    up: (d) => {
      d.exec("ALTER TABLE t ADD COLUMN y TEXT");
      throw new Error("boom");
    },
  };
  assert.throws(() => runMigrations(db, [v1, bad], backupDir), /boom/);
  assert.equal(db.pragma("user_version", { simple: true }), 1);
  const cols = (db.pragma("table_info(t)") as Array<{ name: string }>).map((c) => c.name);
  assert.deepEqual(cols, ["x"]);
});

test("migration backup and guard: rejects gaps or out-of-order versions", () => {
  const { db, backupDir } = freshDb();
  assert.throws(() => runMigrations(db, [v2], backupDir), /must be numbered 1\.\.N/);
});

test("migration backup and guard: a retry after a failure still backs up and applies", () => {
  const { db, backupDir } = freshDb();
  runMigrations(db, [v1], backupDir);
  const bad: Migration = { version: 2, name: "fails", up: () => { throw new Error("boom"); } };
  assert.throws(() => runMigrations(db, [v1, bad], backupDir), /boom/);
  assert.deepEqual(runMigrations(db, [v1, v2], backupDir), [2]);
  assert.equal(db.pragma("user_version", { simple: true }), 2);
});
