// The text stored in leads.hold_reason for a held lead (todo 097). Pure: no database, no model.

const MAX_LENGTH = 500;

/**
 * Joins the router's hold reasons with "; ". Over 500 UTF-16 code units: the first 499 followed by "…" (exactly 500).
 * The router's reasons are ASCII plus "—" and "→", all in the Basic Multilingual Plane, so a cut cannot split a
 * surrogate pair. An empty list returns null: nothing to store.
 */
export function holdReasonText(reasons: string[]): string | null {
  if (reasons.length === 0) return null;
  const joined = reasons.join("; ");
  return joined.length > MAX_LENGTH ? joined.slice(0, MAX_LENGTH - 1) + "…" : joined;
}
