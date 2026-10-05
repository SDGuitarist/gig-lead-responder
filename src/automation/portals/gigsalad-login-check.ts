/**
 * Startup check of the app's GigSalad logins (Alex 2026-10-05). Until Module 1's alert channel
 * exists, a held lead's "run the login command" note reaches nobody, so the poller checks both
 * logins when it starts and says so loudly (startup output + /health). Read-only: opens each
 * account's inbox, nothing else. Module 1 replaces this with a real alert.
 *
 * In memory: resets on restart and reads "unchecked" until a check runs, so a check that never
 * ran cannot look like a working login. "error" (could not check) never reads as "signed_out".
 */
import { GIGSALAD_ACCOUNTS, type GigSaladAccount } from "./gigsalad-accounts.js";
import { readGigSaladInbox, type InboxReader } from "./gigsalad-match.js";

export type GigSaladLoginStatus = "unchecked" | "ok" | "signed_out" | "error";
export type GigSaladLoginState = { checked_at: string | null } & Record<GigSaladAccount, GigSaladLoginStatus>;

let state: GigSaladLoginState = { checked_at: null, music: "unchecked", business: "unchecked" };

export function getGigSaladLoginState(): GigSaladLoginState {
  return { ...state };
}

export async function checkGigSaladLogins(
  read: InboxReader = readGigSaladInbox, now: () => string = () => new Date().toISOString(),
): Promise<GigSaladLoginState> {
  const next: GigSaladLoginState = { checked_at: now(), music: "unchecked", business: "unchecked" };
  for (const account of GIGSALAD_ACCOUNTS) {
    let why = "";
    try {
      const inbox = await read(account);
      next[account] = inbox.status;
      if (inbox.status === "error") why = inbox.message;
    } catch (err) {
      next[account] = "error";
      why = err instanceof Error ? err.message : String(err);
    }
    if (next[account] === "signed_out") {
      console.error(`[gigsalad] *** The app's GigSalad ${account} login has EXPIRED: its leads will be HELD. ` +
        `Run: npm run gigsalad:login -- ${account} ***`);
    } else if (next[account] === "error") {
      console.error(`[gigsalad] *** The app could NOT check the GigSalad ${account} login (${why}). ` +
        `Its leads may be held; check with: npm run gigsalad:login -- ${account} ***`);
    }
  }
  state = next;
  return getGigSaladLoginState();
}
