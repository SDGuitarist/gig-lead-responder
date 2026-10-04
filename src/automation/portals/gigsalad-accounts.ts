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
