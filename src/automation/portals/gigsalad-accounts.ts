import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";
/**
 * Alex's two GigSalad accounts (music email and business email, separate logins).
 * Each has its own app browser profile; Alex signs in himself with
 * `npm run gigsalad:login -- <account>` (option 1, 2026-10-04): no password is stored.
 */
export const GIGSALAD_ACCOUNTS = ["music", "business"] as const;
export type GigSaladAccount = (typeof GIGSALAD_ACCOUNTS)[number];

/** Only an exact account name; anything else throws (a lead must never act in the wrong account). */
export function parseGigSaladAccount(value: unknown): GigSaladAccount {
  if (GIGSALAD_ACCOUNTS.includes(value as GigSaladAccount)) return value as GigSaladAccount;
  throw new Error(`Unknown GigSalad account "${String(value)}": use music or business`);
}

/** The app's saved browser session for one account (under data/, which git ignores). */
export function gigsaladProfileDir(account: GigSaladAccount): string {
  return `data/browser/gigsalad-${account}`;
}

const profileQueue = new Map<GigSaladAccount, Promise<unknown>>();

/** A GigSalad browser job longer than this is stopped (a page load is 30 s at most). */
export const GIGSALAD_JOB_TIMEOUT_MS = 60_000;

/** Is a browser running on an account's profile, and stop it. Swappable in tests. */
export interface ProfileProcesses {
  isRunning(account: GigSaladAccount): Promise<boolean>;
  kill(account: GigSaladAccount): Promise<void>;
}

/** For jobs that launch no real browser (tests with fake openers). */
export const NO_BROWSER_PROCESSES: ProfileProcesses = { isRunning: async () => false, kill: async () => {} };

/**
 * Real check: a browser on a profile was started with `--user-data-dir=<that folder>` (Playwright
 * gives no process handle for a saved-profile browser). pgrep exit 1 = none running; any other
 * failure counts as running, so a check that cannot run refuses rather than risking overlap.
 */
/**
 * pgrep/pkill arguments for one profile's browser. "--" ends the options: the pattern itself starts
 * with "--user-data-dir", which pgrep otherwise rejects as an option (exit 2), and exit 2 counts as
 * "running", so every job refused. Caught 2026-10-05 by a known-answer run on the Mac.
 */
export function profileProcessArgs(account: GigSaladAccount): string[] {
  const dir = resolve(gigsaladProfileDir(account)).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return ["-f", "--", `--user-data-dir=${dir}( |$)`];
}

export const BROWSER_PROCESSES: ProfileProcesses = (() => {
  const run = promisify(execFile);
  return {
    async isRunning(account) {
      try { await run("pgrep", profileProcessArgs(account)); return true; }
      catch (err) { return (err as { code?: number }).code !== 1; }
    },
    async kill(account) {
      await run("pkill", ["-9", ...profileProcessArgs(account)]).catch(() => {});
    },
  };
})();

/**
 * Run a browser job with one account's profile, one job at a time per account (a browser profile
 * can be open only once). Login check Codex round 2: a timeout must STOP the browser, not just stop
 * waiting. So: no job starts while that profile's browser still runs; a job past the timeout has its
 * browser killed and confirmed gone (up to 5 s) before the profile is released. Other accounts run
 * alongside; a failing job releases the profile.
 */
export function withGigSaladProfile<T>(
  account: GigSaladAccount, job: () => Promise<T>, timeoutMs = GIGSALAD_JOB_TIMEOUT_MS,
  proc: ProfileProcesses = BROWSER_PROCESSES,
): Promise<T> {
  const bounded = async (): Promise<T> => {
    if (await proc.isRunning(account)) {
      throw new Error(`GigSalad ${account}: a previous browser for this profile is still running; not starting another`);
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timedOut = Symbol("timeout");
    const timeout = new Promise<typeof timedOut>((r) => { timer = setTimeout(() => r(timedOut), timeoutMs); });
    const result = await Promise.race([job(), timeout]).finally(() => clearTimeout(timer));
    if (result !== timedOut) return result as T;
    await proc.kill(account);
    for (let waited = 0; waited < 5_000 && (await proc.isRunning(account)); waited += 100) {
      await new Promise((r) => setTimeout(r, 100));
    }
    const still = await proc.isRunning(account);
    throw new Error(`GigSalad ${account} browser job timed out after ${timeoutMs} ms` +
      (still ? "; its browser is still running (later jobs refuse until it stops)" : "; its browser was stopped"));
  };
  const previous = profileQueue.get(account) ?? Promise.resolve();
  const run = previous.then(bounded, bounded);
  profileQueue.set(account, run.catch(() => undefined));
  return run;
}
