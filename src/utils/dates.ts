/**
 * Parse an ISO date string as local noon to avoid UTC midnight rollover.
 * new Date("2026-03-14") = UTC midnight = March 13 in Pacific.
 * new Date("2026-03-14T12:00:00") = noon = correct day everywhere in US.
 */
export function parseLocalDate(isoDate: string): Date {
  return new Date(`${isoDate}T12:00:00`);
}
