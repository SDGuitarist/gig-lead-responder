import type Database from "better-sqlite3";
import { initDb } from "./migrate.js";

let cachedDb: Database.Database | undefined;
const stmtCache = new Map<string, Database.Statement>();

export function stmt(sql: string): Database.Statement {
  const db = initDb();
  if (db !== cachedDb) {
    stmtCache.clear();
    cachedDb = db;
  }
  let s = stmtCache.get(sql);
  if (!s) {
    s = db.prepare(sql);
    stmtCache.set(sql, s);
  }
  return s;
}
