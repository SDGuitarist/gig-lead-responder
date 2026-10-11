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
