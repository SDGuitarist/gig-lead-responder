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
import { beginLoginRead, getGigSaladLoginState, noteGigSaladLoginSeen, type GigSaladLoginState } from "./gigsalad-login-state.js";

export { getGigSaladLoginState, type GigSaladLoginState, type GigSaladLoginStatus } from "./gigsalad-login-state.js";

export async function checkGigSaladLogins(
  read: InboxReader = readGigSaladInbox, now: () => string = () => new Date().toISOString(),
): Promise<GigSaladLoginState> {
  // Per account, through the shared rule (live-status Codex round 1): never a whole-state replace,
  // so a lead read that started after this one keeps its newer result.
  for (const account of GIGSALAD_ACCOUNTS) {
    const seq = beginLoginRead();
    let status: "ok" | "signed_out" | "error";
    let why = "";
    try {
      const inbox = await read(account);
      status = inbox.status;
      if (inbox.status === "error") why = inbox.message;
    } catch (err) {
      status = "error";
      why = err instanceof Error ? err.message : String(err);
    }
    noteGigSaladLoginSeen(account, status, { seq, now: now(), why });
  }
  return getGigSaladLoginState();
}

/**
 * Start the check in the background and return at once (login check Codex round 1): polling never
 * waits for a browser. Each read is bounded by withGigSaladProfile's timeout; a failure is logged.
 */
export function startGigSaladLoginCheck(read: InboxReader = readGigSaladInbox): void {
  void checkGigSaladLogins(read).catch((err) =>
    console.error(`[gigsalad] login check failed: ${err instanceof Error ? err.message : String(err)}`));
}
