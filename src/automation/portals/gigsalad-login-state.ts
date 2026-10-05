/**
 * What the app last learned about each GigSalad login, shown on /health (Alex 2026-10-05). Written
 * by the startup check and by every GigSalad lead's inbox reads, so a login that expires while the
 * poller runs shows up at the next lead. In memory: "unchecked" until something has looked.
 * Its own module so the startup check and lead matching share it without importing each other.
 */
import type { GigSaladAccount } from "./gigsalad-accounts.js";

export type GigSaladLoginStatus = "unchecked" | "ok" | "signed_out" | "error";
export type GigSaladLoginState = { checked_at: string | null } & Record<GigSaladAccount, GigSaladLoginStatus>;

let state: GigSaladLoginState = { checked_at: null, music: "unchecked", business: "unchecked" };
/** When the read that produced each account's current status STARTED (live-status Codex round 1). */
const startedAtOf: Partial<Record<GigSaladAccount, number>> = {};

export function getGigSaladLoginState(): GigSaladLoginState {
  return { ...state };
}

/** The loud line for a login that is not ok; null when it is ok or unchecked. */
export function loginProblemLine(account: GigSaladAccount, status: GigSaladLoginStatus, why = ""): string | null {
  if (status === "signed_out") {
    return `[gigsalad] *** The app's GigSalad ${account} login has EXPIRED: its leads will be HELD. ` +
      `Run: npm run gigsalad:login -- ${account} ***`;
  }
  if (status === "error") {
    return `[gigsalad] *** The app could NOT check the GigSalad ${account} login (${why}). ` +
      `Its leads may be held; check with: npm run gigsalad:login -- ${account} ***`;
  }
  return null;
}

/**
 * One inbox read's result (startup check or a lead): refresh that account; loud once when it
 * CHANGES to a problem. A result counts only if no read that started LATER has already reported,
 * so a slow older read can never put back a stale "ok" (live-status Codex round 1).
 */
export function noteGigSaladLoginSeen(
  account: GigSaladAccount, status: "ok" | "signed_out" | "error",
  opts: { startedAt: number; now?: string; why?: string },
): void {
  if (opts.startedAt < (startedAtOf[account] ?? -Infinity)) return;
  startedAtOf[account] = opts.startedAt;
  const now = opts.now ?? new Date().toISOString();
  const why = opts.why ?? "";
  const before = state[account];
  state = { ...state, [account]: status, checked_at: now };
  const line = status !== before ? loginProblemLine(account, status, why) : null;
  if (line) console.error(line);
}
