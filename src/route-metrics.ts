/**
 * The pre-registered measurement formulas for the vague-lead route (plan
 * docs/plans/2026-10-13-feat-vague-lead-quote-with-question-plan.md, "The measurement"). Pure functions over the
 * per-run `route` record that scripts/clarification-measure.ts writes. Descriptive: no number here is a pass bar.
 */
export interface RouteRecord {
  action: string;
  format_recommended: string;
  /** `pricing.quote_price` of the run; null when the format was unresolved. */
  quote_price: number | null;
  question_count: number;
  /** The full draft contains "$" + quote_price. */
  price_figure_present: boolean;
  payment_kind: string;
  payment_sentence_count: number;
  coi_kind: string;
  coi_sentence_count: number;
  /** The full draft carries a phone number or the business name. */
  footer: boolean;
  shared_windows: number;
}

export interface RouteRun {
  ok: boolean;
  verified?: boolean;
  route?: RouteRecord;
}

const ratio = (num: number, den: number) => ({ num, den });

export function summarizeRoute(runs: RouteRun[]) {
  const returned = runs.filter((r) => r.ok && r.route);
  const distribution: Record<string, number> = {};
  for (const r of runs) {
    const k = r.route ? r.route.format_recommended : "no classification";
    distribution[k] = (distribution[k] ?? 0) + 1;
  }
  const resolved = returned.filter((r) => r.route!.format_recommended !== "unresolved");
  const paymentSentence = returned.filter((r) => r.route!.payment_kind === "sentence");
  const coiSentence = returned.filter((r) => r.route!.coi_kind === "sentence");
  const windows = returned.map((r) => r.route!.shared_windows);
  return {
    runs: runs.length,
    classifier_distribution: distribution,
    returned: ratio(returned.length, runs.length),
    quote_at_app_price: ratio(resolved.filter((r) => r.route!.price_figure_present).length, resolved.length),
    verified: ratio(returned.filter((r) => r.verified).length, returned.length),
    exactly_one_question: ratio(returned.filter((r) => r.route!.question_count === 1).length, returned.length),
    payment_sentence_once: ratio(paymentSentence.filter((r) => r.route!.payment_sentence_count === 1).length, paymentSentence.length),
    coi_sentence_once: ratio(coiSentence.filter((r) => r.route!.coi_sentence_count === 1).length, coiSentence.length),
    no_footer: ratio(returned.filter((r) => !r.route!.footer).length, returned.length),
    shared_windows: { max: windows.length ? Math.max(...windows) : 0, drafts_above_zero: windows.filter((w) => w > 0).length, of: windows.length },
  };
}

const norm = (t: string) => t.toLowerCase().replace(/\s+/g, " ").trim();
const cut = (text: string, sentences: string[]) => sentences.reduce((acc, s) => acc.split(norm(s)).join(" "), norm(text));

/**
 * Measurement instrumentation, NOT an acceptance gate (plan V8): how many `size`-character windows of `draft` also occur
 * in `example`, after both have the app-mandated sentences (payment, COI, the date sentence) cut out. 0 means no clause
 * is shared; a number above 0 is read draft by draft.
 */
export function sharedWindows(draft: string, example: string, mandatedSentences: string[], size = 30): number {
  const d = cut(draft, mandatedSentences);
  const e = cut(example, mandatedSentences);
  let n = 0;
  for (let i = 0; i + size <= d.length; i++) if (e.includes(d.slice(i, i + size))) n++;
  return n;
}
