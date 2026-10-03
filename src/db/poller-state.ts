// Allowed imports: ./stmt-cache.js only
// The poller's cursor and health, stored so a restart resumes where it stopped (plan 0.3).

import { stmt } from "./stmt-cache.js";

export interface PollerState {
  /** Unix seconds; the next poll asks Gmail for mail after this. */
  cursorTs: number | null;
  lastSuccessAt: string | null;
  auth: "ok" | "failed" | null;
}

export function getPollerState(): PollerState {
  const row = stmt("SELECT cursor_ts, last_success_at, auth FROM poller_state WHERE id = 1").get() as
    | { cursor_ts: number | null; last_success_at: string | null; auth: "ok" | "failed" | null }
    | undefined;
  return {
    cursorTs: row?.cursor_ts ?? null,
    lastSuccessAt: row?.last_success_at ?? null,
    auth: row?.auth ?? null,
  };
}

export function savePollSuccess(cursorTs: number, at: string): void {
  stmt(`
    INSERT INTO poller_state (id, cursor_ts, last_success_at, auth) VALUES (1, ?, ?, 'ok')
    ON CONFLICT (id) DO UPDATE SET cursor_ts = excluded.cursor_ts,
      last_success_at = excluded.last_success_at, auth = 'ok'
  `).run(cursorTs, at);
}

/** Keeps the cursor, so the next good poll resumes from it. */
export function savePollAuthFailed(): void {
  stmt(`
    INSERT INTO poller_state (id, auth) VALUES (1, 'failed')
    ON CONFLICT (id) DO UPDATE SET auth = 'failed'
  `).run();
}
