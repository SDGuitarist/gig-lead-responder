/**
 * The first content sentence of a draft: a leading salutation ("Hi Sarah," on its own line or at the start of the
 * first line) is removed, then the first sentence of the first non-empty line is returned. Used by
 * scripts/clarification-measure.ts to record each run's opening (plan
 * docs/plans/2026-10-13-fix-clarification-gate-opening-plan.md, decision table). Not used by the app.
 *
 * A salutation is a greeting word (hi, hello, hey, dear) followed by at most two name words and a comma. A phrase that
 * merely ends in a comma ("Before I say anything else,") is content and is kept.
 */
const SALUTATION = /^\s*(?:hi|hello|hey|dear)\b(?:\s+[^\s,.!?]+){0,2}\s*,\s*/i;

export function openingOf(draft: string): string {
  const body = String(draft).replace(SALUTATION, "");
  const first = body.split("\n").map((l) => l.trim()).find(Boolean) ?? "";
  return first.split(/(?<=[.!?])\s/)[0];
}
