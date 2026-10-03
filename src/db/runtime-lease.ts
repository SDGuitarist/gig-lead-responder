// Allowed imports: ./migrate.js only
// Same-host lease (plan 0.2): at most one process on this Mac polls or sends.
// It is NOT a cross-host guarantee; that is the single Gmail grant.

import { initDb } from "./migrate.js";

export interface LeaseHolder {
  host: string;
  pid: number;
  /** Boot time in seconds; a holder from another boot is dead. */
  boot: number;
}

const LEASE_MS = 60_000;

type Row = LeaseHolder & { expires_at: number };

function sameHolder(row: Row, me: LeaseHolder): boolean {
  return row.host === me.host && row.pid === me.pid && row.boot === me.boot;
}

/** Takes or renews the lease; returns false while someone else holds it. */
export function tryAcquireLease(me: LeaseHolder, nowMs: number, isAlive: (pid: number) => boolean): boolean {
  const db = initDb();
  return db
    .transaction(() => {
      const row = db.prepare("SELECT host, pid, boot, expires_at FROM runtime_lease WHERE id = 1").get() as Row | undefined;
      const deadHolder = !!row && row.host === me.host && (row.boot !== me.boot || !isAlive(row.pid));
      if (row && !sameHolder(row, me) && row.expires_at >= nowMs && !deadHolder) return false;
      db.prepare(`
        INSERT INTO runtime_lease (id, host, pid, boot, expires_at) VALUES (1, ?, ?, ?, ?)
        ON CONFLICT (id) DO UPDATE SET host = excluded.host, pid = excluded.pid,
          boot = excluded.boot, expires_at = excluded.expires_at
      `).run(me.host, me.pid, me.boot, nowMs + LEASE_MS);
      return true;
    })
    .immediate();
}

/** True only for the current holder of an unexpired lease (the send check). */
export function holdsLease(me: LeaseHolder, nowMs: number): boolean {
  const row = initDb().prepare("SELECT host, pid, boot, expires_at FROM runtime_lease WHERE id = 1").get() as
    | Row
    | undefined;
  return !!row && sameHolder(row, me) && row.expires_at > nowMs;
}

export function getLeaseInfo(): { host: string; pid: number; expiresAt: number } | null {
  const row = initDb().prepare("SELECT host, pid, expires_at FROM runtime_lease WHERE id = 1").get() as
    | { host: string; pid: number; expires_at: number }
    | undefined;
  return row ? { host: row.host, pid: row.pid, expiresAt: row.expires_at } : null;
}
