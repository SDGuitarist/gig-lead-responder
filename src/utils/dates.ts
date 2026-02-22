/**
 * Get today's date as YYYY-MM-DD in Pacific time.
 * Avoids UTC gotcha: at 11 PM Pacific, toISOString() returns tomorrow's date.
 * "en-CA" locale produces YYYY-MM-DD format.
 */
export function getTodayISO(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
}

/**
 * Parse an ISO date string as local noon to avoid UTC midnight rollover.
 * new Date("2026-03-14") = UTC midnight = March 13 in Pacific.
 * new Date("2026-03-14T12:00:00") = noon = correct day everywhere in US.
 */
export function parseLocalDate(isoDate: string): Date {
  const d = new Date(`${isoDate}T12:00:00`);
  if (isNaN(d.getTime())) throw new Error(`Invalid ISO date: "${isoDate}"`);
  return d;
}
