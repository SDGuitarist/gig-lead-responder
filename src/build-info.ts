/**
 * Build identity for deploy verification.
 *
 * Railway auto-deploys from main, and before this existed the only post-merge
 * signal was that /health returned 200 -- which it also returned before the
 * merge. "New build is live" and "old build is still serving" were byte
 * identical, so every deploy verification was weaker than it looked (todo 086).
 */

/**
 * Captured once at module load, i.e. at process boot. Distinguishes a fresh
 * deploy from a long-running old process even if the commit SHA is missing.
 */
export const STARTED_AT = new Date().toISOString();

/** A git SHA and nothing else: 7-40 hex characters. */
const SHA_PATTERN = /^[0-9a-f]{7,40}$/i;

/**
 * Short commit SHA of the running build, or the literal string "unknown".
 *
 * Returns "unknown" rather than omitting the field, so that a missing build
 * identifier and an unrecognised one cannot be confused with a field that was
 * never added -- the same distinction this module exists to make.
 *
 * The value is pattern-checked before it is returned. /health is
 * unauthenticated, and an environment variable can hold anything; validating
 * that it looks like a SHA means arbitrary env content is never reflected back
 * to an anonymous caller.
 */
export function getBuildCommit(): string {
  const raw = process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT_SHA ?? "";
  const trimmed = raw.trim();
  if (!SHA_PATTERN.test(trimmed)) return "unknown";
  return trimmed.slice(0, 7).toLowerCase();
}
