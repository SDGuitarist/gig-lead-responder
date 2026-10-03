// Numbered migrations on top of the initDb() baseline (plan 0.4).
// Allowed imports: node builtins, better-sqlite3 only.
//
// The version lives in PRAGMA user_version. Before each migration the DB is
// copied to <backupDir>/pre-vN.db with VACUUM INTO, then the migration and the
// version bump run in one transaction, so a failure leaves the old version.

import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type Database from "better-sqlite3";

export interface Migration {
  version: number;
  name: string;
  up: (db: Database.Database) => void;
}

/** The app's migrations, in order. v1 arrives with the poller cursor (plan 0.3). */
export const MIGRATIONS: Migration[] = [];

/** Throws if the DB was written by newer code; returns its current version. */
export function assertDbNotNewer(db: Database.Database, migrations: Migration[]): number {
  const current = db.pragma("user_version", { simple: true }) as number;
  if (current > migrations.length) {
    throw new Error(`Database is at v${current}, newer than this code (v${migrations.length}). Refusing to start.`);
  }
  return current;
}

/** Applies pending migrations; returns the versions it applied. */
export function runMigrations(
  db: Database.Database,
  migrations: Migration[],
  backupDir: string,
): number[] {
  migrations.forEach((m, i) => {
    if (m.version !== i + 1) {
      throw new Error(`Migrations must be numbered 1..N in order; found v${m.version} at position ${i + 1}`);
    }
  });

  const current = assertDbNotNewer(db, migrations);

  const applied: number[] = [];
  for (const m of migrations.slice(current)) {
    mkdirSync(backupDir, { recursive: true });
    // A retry after a failed attempt keeps the earlier backup and adds a fresh one.
    let backupPath = join(backupDir, `pre-v${m.version}.db`);
    if (existsSync(backupPath)) backupPath = join(backupDir, `pre-v${m.version}-${Date.now()}.db`);
    db.prepare("VACUUM INTO ?").run(backupPath);
    db.transaction(() => {
      m.up(db);
      db.pragma(`user_version = ${m.version}`);
    })();
    console.log(`Migration v${m.version} (${m.name}) applied; backup at ${backupPath}`);
    applied.push(m.version);
  }
  return applied;
}
