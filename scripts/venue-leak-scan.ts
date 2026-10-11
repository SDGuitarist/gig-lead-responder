// The leakage-sentinel scan behind scripts/check-venue-history.ts, kept pure so tests run it on made-up text.
// Bounded: exact copies of 30+ characters only (whitespace collapsed); paraphrases and shorter copies pass.

export const WINDOW = 30;

export const collapse = (s: string): string => s.replace(/\s+/g, " ");

/** Every 30-character window of each sentence, mapped to its venue; a sentence shorter than that is one window. */
export function claimWindows(claims: Array<{ name: string; claim: string }>): Map<string, string> {
  const windows = new Map<string, string>();
  for (const { name, claim } of claims) {
    const c = collapse(claim);
    if (c.length < WINDOW) windows.set(c, name);
    for (let i = 0; i + WINDOW <= c.length; i++) windows.set(c.slice(i, i + WINDOW), name);
  }
  return windows;
}

/**
 * Venues whose sentence appears in `text`. A match is known (already public) only when `publicText`, the file as it
 * was when that text first became public, already held the exact same window; anything else is a leak. Every window
 * is checked, so a known match never hides a new one. Both texts must already be collapsed.
 */
export function scanText(text: string, windows: Map<string, string>, publicText?: string): { leaks: string[]; known: string[] } {
  const leaks = new Set<string>();
  const known = new Set<string>();
  const note = (w: string, name: string) => (publicText?.includes(w) ? known : leaks).add(name);
  for (const [w, name] of windows) if (w.length < WINDOW && text.includes(w)) note(w, name);
  for (let i = 0; i + WINDOW <= text.length; i++) {
    const w = text.slice(i, i + WINDOW);
    const name = windows.get(w);
    if (name) note(w, name);
  }
  return { leaks: [...leaks], known: [...known].filter((n) => !leaks.has(n)) };
}
