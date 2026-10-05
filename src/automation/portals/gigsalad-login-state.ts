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

export function getGigSaladLoginState(): GigSaladLoginState {
  return { ...state };
}

export function setGigSaladLoginState(next: GigSaladLoginState): void {
  state = { ...next };
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

/** A lead's inbox read: refresh that account; loud once when it CHANGES to a problem. */
export function noteGigSaladLoginSeen(
  account: GigSaladAccount, status: "ok" | "signed_out" | "error",
  now: string = new Date().toISOString(), why = "",
): void {
  const before = state[account];
  state = { ...state, [account]: status, checked_at: now };
  const line = status !== before ? loginProblemLine(account, status, why) : null;
  if (line) console.error(line);
}
