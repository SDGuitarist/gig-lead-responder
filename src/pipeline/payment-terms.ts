import type { Classification, PricingResult } from "../types.js";

// Payment terms by lead time (plan docs/plans/2026-10-11-fix-payment-terms-by-lead-time-plan.md). Alex's exact
// sentences (2026-10-11); his rule lives in ~/.claude/docs/contract-and-payment-process.md. The app picks the
// sentence from dates; the model only copies it, and post-check confirms the exact text.

export const PAYMENT_SENTENCES = {
  twoMonths: "A 50% deposit holds the date, and the balance is due two months before the event.",
  twoWeeks: "A 50% deposit holds the date, and the balance is due two weeks before the event.",
  full: "Full payment holds the date.",
  noDate: "A 50% deposit holds the date.",
} as const;

/** One value per pipeline or edit run, passed to every generate call and to the post-check. */
export type PaymentTerms =
  | { kind: "none" } // no payment line: clarification, no viable scope, residency
  | { kind: "platform" } // GigSalad / The Bash: the client pays the platform
  | { kind: "unknown_platform" } // hand-run lead the model marks "P": no terms, flagged for Alex
  | { kind: "sentence"; sentence: string };

const DAY_MS = 86_400_000;

/** A strict YYYY-MM-DD calendar date as a whole day number (UTC, so no DST), or null. */
export function civilDay(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = Date.UTC(y, mo - 1, d);
  const back = new Date(t);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) return null;
  return t / DAY_MS;
}

// The same day-of-month `months` later, clamped to that month's last day (Dec 31 + 2 = Feb 28 or 29).
function addMonthsClamped(day: number, months: number): number {
  const d = new Date(day * DAY_MS);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + months;
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return Date.UTC(y, m, Math.min(d.getUTCDate(), last)) / DAY_MS;
}

/** Edges fall in the shorter band: exactly 14 days is full payment, exactly 2 months is the two-weeks sentence. */
export function paymentSentence(eventIso: string | null, todayIso: string): string {
  const event = eventIso === null ? null : civilDay(eventIso);
  const today = civilDay(todayIso);
  if (event === null || today === null || event < today) return PAYMENT_SENTENCES.noDate; // a past date is flagged elsewhere
  if (event - today <= 14) return PAYMENT_SENTENCES.full;
  if (event <= addMonthsClamped(today, 2)) return PAYMENT_SENTENCES.twoWeeks;
  return PAYMENT_SENTENCES.twoMonths;
}

/** The three replies that carry no quote terms. The Quote Terms block in the generate prompt uses this too. */
export function quoteTermsOff(classification: Pick<Classification, "action" | "format_recommended">, pricing: PricingResult): boolean {
  const clarificationMode = classification.action === "one_question" && classification.format_recommended === "unresolved";
  return clarificationMode || pricing.budget.tier === "no_viable_scope" || Boolean(pricing.residency);
}

/** Exclusions first, then the intake-set platform, then a hand-run "P" lead, then the dated sentence. */
export function paymentTermsFor(classification: Classification, pricing: PricingResult, todayIso: string): PaymentTerms {
  if (quoteTermsOff(classification, pricing)) return { kind: "none" };
  if (classification.platform === "gigsalad" || classification.platform === "thebash") return { kind: "platform" };
  if (classification.platform == null && classification.lead_source_column === "P") return { kind: "unknown_platform" };
  return { kind: "sentence", sentence: paymentSentence(classification.event_date_iso ?? null, todayIso) };
}

/** The Quote Terms line for the generate prompt (plan D3). Kind none has no line: its replies carry no quote terms. */
export function paymentLine(terms: PaymentTerms): string {
  switch (terms.kind) {
    case "sentence":
      return `- Payment: write this sentence exactly, once, in both drafts, after the price: "${terms.sentence}". Write no other sentence about a deposit, a balance, a due date or paying in full.`;
    case "platform":
      return "- Payment: the platform handles payment. Say nothing about a deposit, a balance, a due date or payment.";
    case "unknown_platform": // no claim about who collects it: a Thumbtack client pays Alex
      return "- Payment: say nothing about payment, a deposit, a balance or a due date.";
    case "none":
      return "";
  }
}

/** Tests that build prompts for other reasons: the no-date sentence, the closest to the old deposit line. */
export const NO_DATE_TERMS: PaymentTerms = { kind: "sentence", sentence: PAYMENT_SENTENCES.noDate };

/** True only for a strict, valid event date before today (calendar days). Shared by enrichment and the edit path. */
export function isPastDate(eventIso: string | null, todayIso: string): boolean {
  const event = eventIso === null ? null : civilDay(eventIso);
  const today = civilDay(todayIso);
  return event !== null && today !== null && event < today;
}

// Payment wording a draft must not add (plan D4): a bounded list, case-insensitive. Plain "balance", "pay" and "rest"
// stay allowed: "I balance the sound", "pay attention", "the rest of the night" are musician prose, not terms.
const PAYMENT_WORDS = [
  /\bdeposit\b/i, /\bretainer\b/i, /\bpayments?\b/i, /\bfull payment\b/i, /\b(?:pay|paid|payment)\s+in\s+full\b/i,
  /\bdue\s+in\s+full\b/i, /\bpayable\b/i, /\bremaining\s+(?:amount|balance)\b/i, /\b(?:entire|full|whole|total)\s+amount\b/i,
  /\b\d{1,3}\s?%\s*(?:up\s?front|down|now)\b/i, /\b(?:payment|amount|balance|rest|remainder)\s+(?:is\s+|will\s+be\s+)?due\b/i,
];
const hasPaymentWord = (text: string) => PAYMENT_WORDS.some((re) => re.test(text));
const collapseSpace = (s: string) => s.replace(/\s+/g, " ");

/** Post-check for one draft (exact text the app knows; never inferred from prose). */
export function paymentViolations(text: string, label: "full" | "compressed", terms: PaymentTerms): string[] {
  const t = collapseSpace(text);
  switch (terms.kind) {
    case "none":
      return [];
    case "platform":
    case "unknown_platform":
      return hasPaymentWord(t) ? [`payment_terms_${label}: a platform draft must say nothing about payment`] : [];
    case "sentence": {
      const parts = t.split(terms.sentence);
      if (parts.length - 1 !== 1) return [`payment_terms_${label}: must contain exactly once: "${terms.sentence}"`];
      return hasPaymentWord(parts.join(" ")) ? [`payment_terms_${label}: other payment wording besides "${terms.sentence}"`] : [];
    }
  }
}

export const PLATFORM_UNKNOWN_FLAG = "payment_terms_platform_unknown: add payment terms if this client pays Alex directly (Thumbtack, The Knot, WeddingWire); none for GigSalad or The Bash";

// The four sentences as whitespace-tolerant patterns. None is part of another ("holds the date." vs "holds the date,
// and"), so a draft holds a countable number of them.
const KNOWN_SENTENCES = [PAYMENT_SENTENCES.twoMonths, PAYMENT_SENTENCES.twoWeeks, PAYMENT_SENTENCES.full, PAYMENT_SENTENCES.noDate];
const KNOWN_RE = new RegExp(KNOWN_SENTENCES.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+")).join("|"), "g");

/**
 * At send time (Alex 2026-10-11, plan Revision 4): a draft written days earlier may carry the wrong band. Kinds
 * none / platform / unknown_platform: unchanged. Kind sentence: exactly one known sentence must be present; it is
 * replaced with today's (unchanged when equal). Zero or several known sentences: an error, never a guess.
 */
export function refreshPaymentSentence(draft: string, terms: PaymentTerms): { text: string } | { error: string } {
  if (terms.kind !== "sentence") return { text: draft };
  const found = draft.match(KNOWN_RE) ?? [];
  if (found.length !== 1) {
    return { error: `payment terms changed since this draft was written and ${found.length === 0 ? "no" : "more than one"} known payment sentence was found; fix it or re-run` };
  }
  return { text: draft.replace(KNOWN_RE, () => terms.sentence) };
}
