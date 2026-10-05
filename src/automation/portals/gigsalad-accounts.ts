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

/** A GigSalad browser job longer than this is abandoned (a page load is 30 s at most). */
export const GIGSALAD_JOB_TIMEOUT_MS = 60_000;

/**
 * Run a browser job with one account's profile, one job at a time per account (a browser profile
 * can be open only once; login check Codex round 1). Other accounts run alongside. A job that
 * fails, or runs past the timeout, releases the profile for the next one: a hung browser can
 * never stall every later job on that account (or the poller behind a lead).
 */
export function withGigSaladProfile<T>(
  account: GigSaladAccount, job: () => Promise<T>, timeoutMs = GIGSALAD_JOB_TIMEOUT_MS,
): Promise<T> {
  const bounded = (): Promise<T> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`GigSalad ${account} browser job timed out after ${timeoutMs} ms`)), timeoutMs);
    });
    return Promise.race([job(), timeout]).finally(() => clearTimeout(timer));
  };
  const previous = profileQueue.get(account) ?? Promise.resolve();
  const run = previous.then(bounded, bounded);
  profileQueue.set(account, run.catch(() => undefined));
  return run;
}
