// COI sentence owned by the app (plan docs/plans/2026-10-12-feat-coi-sentence-by-request-plan.md, Revision 3c).
// Alex 2026-10-12: a first reply always says COI is available upon request; the timeline sentence only when the
// client says they require one. Same pattern as payment-terms.ts: the app picks the exact sentence, the post-check
// confirms the exact text. Nothing here depends on a date, so there is no send-time swap.
import type { Classification, PricingResult } from "../types.js";
import { quoteTermsOff } from "./payment-terms.js";

export const COI_SENTENCES = {
  default: "COI available upon request.",
  required: "I carry liability insurance ($1M/$2M) and can provide COI within a few days of booking.",
} as const;

export type CoiTerms = { kind: "none" } | { kind: "sentence"; sentence: string };

/**
 * The mode matrix (plan R2-1). No COI sentence when there is no quote (`quoteTermsOff`: clarification, no_viable_scope,
 * residency) and in graceful decline (the mode forbids a pitch after its exit line). Every other quoted reply carries
 * one: normal, past date, small or large budget gap, platform lead. `coi_required` only when a real true.
 */
export function coiTermsFor(
  classification: Pick<Classification, "action" | "format_recommended" | "graceful_decline" | "coi_required">,
  pricing: PricingResult,
): CoiTerms {
  if (quoteTermsOff(classification, pricing)) return { kind: "none" };
  if (classification.graceful_decline === true) return { kind: "none" };
  return { kind: "sentence", sentence: classification.coi_required === true ? COI_SENTENCES.required : COI_SENTENCES.default };
}

/** The Quote Terms line for the generate prompt. Kind none has no line. */
export function coiLine(terms: CoiTerms): string {
  if (terms.kind === "none") return "";
  return `- COI: use this sentence exactly, once, in both drafts: "${terms.sentence}". Write no other COI or insurance sentence, and do not restate a venue's COI policy.`;
}

// COI wording a draft must not add besides the chosen sentence (plan R2-2): a bounded list, case-insensitive.
const COI_WORDS = [/\bCOI\b/i, /certificate of insurance/i, /proof of insurance/i, /liability insurance/i, /\binsured\b/i];
const collapseSpace = (s: string) => s.replace(/\s+/g, " ");

/**
 * Post-check for ONE draft (plan R2-2). Kind none: no flag. Otherwise, with whitespace collapsed:
 * a wrong count of the exact sentence returns that one flag and stops (as paymentViolations does), so each draft has
 * at most one COI violation; other COI wording is scanned only when the sentence occurs exactly once, with the
 * sentence removed first so the valid required sentence ("COI", "liability insurance") never flags itself.
 */
export function coiViolations(text: string, label: "full" | "compressed", terms: CoiTerms): string[] {
  if (terms.kind === "none") return [];
  const parts = collapseSpace(text).split(terms.sentence);
  const count = parts.length - 1;
  if (count === 0) return [`coi_sentence_missing_${label}: must contain exactly once: "${terms.sentence}"`];
  if (count > 1) return [`coi_sentence_repeated_${label}: must contain exactly once (found ${count}): "${terms.sentence}"`];
  const rest = parts.join(" ");
  return COI_WORDS.some((re) => re.test(rest))
    ? [`coi_other_wording_${label}: other COI or insurance wording besides "${terms.sentence}"`]
    : [];
}
