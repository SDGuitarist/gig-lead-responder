// The lead's own phrases (plan docs/plans/2026-10-14-feat-lead-words-field-plan.md, Revision 1c, D1).
// Neither the drafter nor the verifier sees the lead text, only the classification, so a phrase the lead wrote is a
// classifier field: copied by the model, GROUNDED in code. The guarantee is LEXICAL copying, not semantic truth.
//
// Three functions, one boundary each:
//   coerceLeadWords(value)           shape only, no lead text, never throws (validateClassification, leadWordsOf)
//   groundLeadWords(words, rawText)  lexical check against the lead, in classifyLead (the only place with the lead)
//   leadWordsOf(classification)      the ONLY accessor consumers use; a stored or malformed value reads as all-null
import type { Classification } from "./types.js";

export interface LeadWords { occasion: string | null; time_frame: string | null; doubt: string | null }
export const LEAD_WORDS_MAX_LENGTH = 80;
const KEYS = ["occasion", "time_frame", "doubt"] as const;

const NONE = (): LeadWords => ({ occasion: null, time_frame: null, doubt: null });

/** A non-object, array or missing value is all-null; a member that is not a string, is empty after trimming, or is longer than 80 characters is null; extra keys are dropped. */
export function coerceLeadWords(value: unknown): LeadWords {
  const out = NONE();
  if (typeof value !== "object" || value === null || Array.isArray(value)) return out;
  const obj = value as Record<string, unknown>;
  for (const k of KEYS) {
    const v = obj[k];
    if (typeof v !== "string") continue;
    const t = v.trim();
    if (t.length > 0 && t.length <= LEAD_WORDS_MAX_LENGTH) out[k] = t;
  }
  return out;
}

/** The only way a consumer reads the field: a missing, stored or malformed value is all-null. */
export function leadWordsOf(c: Pick<Classification, "lead_words">): LeadWords {
  return coerceLeadWords(c.lead_words);
}

export const hasLeadWords = (w: LeadWords): boolean => KEYS.some((k) => w[k] !== null);

/**
 * The normal form both sides are compared in: Unicode NFKC, accents folded, curly quotes and apostrophes straightened,
 * every run of whitespace (including line breaks) collapsed to one space, trimmed, lowercased.
 */
export function normalForm(text: string): string {
  return text.normalize("NFKC").normalize("NFD").replace(/\p{M}/gu, "")
    .replace(/[‘’‛′]/g, "'").replace(/[“”‟″]/g, '"')
    .replace(/\s+/g, " ").trim().toLowerCase();
}

const NEGATORS = new Set(["not", "no", "never", "without"]);
/** A TOKEN is a maximal run of letters, digits and apostrophes; everything else only separates tokens. */
function lastTokenBefore(text: string, end: number): string | null {
  const tokens = text.slice(0, end).match(/[\p{L}\p{N}']+/gu);
  return tokens && tokens.length ? tokens[tokens.length - 1] : null;
}
function negated(token: string | null): boolean {
  if (token === null) return false;
  return NEGATORS.has(token) || token.endsWith("n't");
}

/** True when the phrase occurs in the lead at least once with no negator token immediately before it. */
function occursUnnegated(lead: string, phrase: string): boolean {
  let from = 0;
  for (;;) {
    const i = lead.indexOf(phrase, from);
    if (i === -1) return false;
    if (!negated(lastTokenBefore(lead, i))) return true;
    from = i + 1;
  }
}

const DOUBT_MARKERS = /\b(?:not sure|unsure|no idea|not certain|don't know|do not know|haven't decided|have not decided|undecided|not decided|still deciding|wondering|any ideas|any suggestions|open to)\b/;
const DOUBT_QUESTION = /\b(?:what|which|how)\b(?:\W+[\p{L}\p{N}']+){0,6}?\W+(?:music|kind|type|format|band|guitar)\b/u;

/**
 * Keep a phrase only when it is a substring of the lead (normal forms). occasion and time_frame also fail when the
 * token immediately before every occurrence is a negator. doubt must carry a doubt marker and must not equal the
 * occasion or the time frame (so an occasion phrase cannot enter through doubt and skip the negation guard).
 */
export function groundLeadWords(words: LeadWords, rawText: string): LeadWords {
  const lead = normalForm(rawText);
  const out = NONE();
  for (const k of ["occasion", "time_frame"] as const) {
    const v = words[k];
    if (v === null) continue;
    const n = normalForm(v);
    if (n.length > 0 && occursUnnegated(lead, n)) out[k] = v;
  }
  const d = words.doubt;
  if (d !== null) {
    const n = normalForm(d);
    const shaped = DOUBT_MARKERS.test(n) || DOUBT_QUESTION.test(n);
    const sameAsOther = [words.occasion, words.time_frame].some((o) => o !== null && normalForm(o) === n);
    if (n.length > 0 && lead.includes(n) && shaped && !sameAsOther) out.doubt = d;
  }
  return out;
}
