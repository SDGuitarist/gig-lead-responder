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

/** The draft without a leading salutation and without the trailing "Alex Guillen" sign-off. */
function contentOf(draft: string): string {
  return String(draft).replace(SALUTATION, "").replace(/\s*\n\s*Alex\s*Guillen\s*$/i, "").trim();
}

/** Words of the draft body (salutation and sign-off excluded). */
export function wordCount(draft: string): number {
  return contentOf(draft).split(/\s+/).filter(Boolean).length;
}

/** Sentences of the draft body: segments that end at `.`, `!` or `?` followed by whitespace (a decimal such as 3.5 is not a break). */
export function sentenceCount(draft: string): number {
  return contentOf(draft).split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean).length;
}
