// The classifier regression's stop rule (plan docs/plans/2026-10-14-feat-lead-words-field-plan.md, Revision 1c, "The
// classifier regression"), as a pure function so its exit status is tested (LW13).
// Per (lead, field): the value of each row is its String(); an error row (`{ action: "ERROR" }`) or a missing row is the
// value `__error__` for EVERY field. The mode is the value with the highest count, a tie broken by the lexicographically
// smallest value. Stop when, for any (lead, field): the mode differs; the runs off the mode rise by 2 or more; or the
// number of `__error__` rows rises.
export const REGRESSION_FIELDS = ["action", "vagueness", "competition_level", "format_recommended", "duration_hours", "rate_card_tier", "stealth_premium", "quote_price"] as const;
export const ERROR_VALUE = "__error__";
type Rows = Array<Record<string, unknown>>;
export interface RegressionFile { results: Record<string, Rows> }

export function assertRegressionFile(x: unknown, label: string): asserts x is RegressionFile {
  const ok = typeof x === "object" && x !== null && typeof (x as RegressionFile).results === "object" && (x as RegressionFile).results !== null
    && Object.values((x as RegressionFile).results).every((rows) => Array.isArray(rows));
  if (!ok) throw new Error(`${label}: not a classifier-regression file ({ results: { <lead>: rows[] } })`);
}

function valuesOf(rows: Rows, field: string, expected: number): string[] {
  const vals = rows.map((r) => (r.action === "ERROR" || r.error !== undefined && r.action === undefined ? ERROR_VALUE : String(r[field])));
  while (vals.length < expected) vals.push(ERROR_VALUE);
  return vals;
}
function summarize(vals: string[]) {
  const counts = new Map<string, number>();
  for (const v of vals) counts.set(v, (counts.get(v) ?? 0) + 1);
  const mode = [...counts].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))[0][0];
  return { mode, off: vals.filter((v) => v !== mode).length, errors: counts.get(ERROR_VALUE) ?? 0, counts };
}

export interface RegressionVerdict { stop: boolean; reasons: string[]; lines: string[] }

export function compareRegression(before: unknown, after: unknown): RegressionVerdict {
  assertRegressionFile(before, "before");
  assertRegressionFile(after, "after");
  const reasons: string[] = [];
  const lines: string[] = [];
  for (const lead of Object.keys(before.results)) {
    const brows = before.results[lead];
    const arows = after.results[lead] ?? [];
    const expected = brows.length;
    lines.push(`== ${lead}`);
    for (const f of REGRESSION_FIELDS) {
      const b = summarize(valuesOf(brows, f, expected));
      const a = summarize(valuesOf(arows, f, expected));
      const why: string[] = [];
      if (a.mode !== b.mode) why.push(`mode ${b.mode} -> ${a.mode}`);
      if (a.off - b.off >= 2) why.push(`runs off the mode ${b.off} -> ${a.off}`);
      if (a.errors > b.errors) why.push(`error rows ${b.errors} -> ${a.errors}`);
      lines.push(`  ${f.padEnd(20)} before ${[...b.counts].map(([v, n]) => `${v} x${n}`).join(", ")} | after ${[...a.counts].map(([v, n]) => `${v} x${n}`).join(", ")}${why.length ? `   <-- STOP: ${why.join("; ")}` : ""}`);
      for (const w of why) reasons.push(`${lead}.${f}: ${w}`);
    }
  }
  return { stop: reasons.length > 0, reasons, lines };
}
