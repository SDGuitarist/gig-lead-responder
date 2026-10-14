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
  /** Set by the runner on ok:false: the pipeline stage that threw ("classify", "generate", ...), or "unknown". */
  error_stage?: string;
}

const ratio = (num: number, den: number) => ({ num, den });

export function summarizeRoute(runs: RouteRun[]) {
  const returned = runs.filter((r) => r.ok && r.route);
  const distribution: Record<string, number> = {};
  for (const r of runs) {
    // A run with no route is not automatically a classification failure: a draft that fails in generate or verify was
    // classified first (Codex R1 finding 2). An error with no known stage is its own count, not a guess.
    const k = r.route ? r.route.format_recommended
      : r.error_stage === "classify" ? "no classification"
      : r.error_stage && r.error_stage !== "unknown" ? "classified, failed later"
      : "failed, stage unknown";
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

/**
 * The opening check over ALL runs (plan docs/plans/2026-10-14-feat-lead-words-field-plan.md, decision table: "opening-false
 * is N of 50"): a run with no draft is in the denominator and is not counted as opening-false (Codex code review R1 P1-1).
 */
export function summarizeOpening(runs: Array<{ ok: boolean; gate_detail?: { false_checks?: string[] } }>) {
  const returned = runs.filter((r) => r.ok);
  const falseCount = returned.filter((r) => (r.gate_detail?.false_checks ?? []).includes("lead_specific_opening")).length;
  return { runs: runs.length, returned: returned.length, no_draft: runs.length - returned.length, opening_false: falseCount };
}
