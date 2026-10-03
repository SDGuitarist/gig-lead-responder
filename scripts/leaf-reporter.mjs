// node:test reporter that counts only leaf tests (plan §0.1).
// Excluded: suites, and the file-level entries that process isolation adds
// for each file (nesting 0, named after the .test.ts path). Without that
// exclusion a filter that matches nothing still reports one "test" per file.
// Skipped and todo tests are counted apart: node reports them as pass events,
// and a run whose only match was skipped proved nothing.
// Last line is the sentinel `LEAF_MATCH {"pass":N,"fail":M,"skip":K}`.
export default async function* leafReporter(source) {
  let pass = 0;
  let fail = 0;
  let skip = 0;
  for await (const ev of source) {
    if (ev.type !== "test:pass" && ev.type !== "test:fail") continue;
    const { details, nesting, name } = ev.data;
    if (details?.type !== "test") continue;
    if (nesting === 0 && /\.test\.ts$/.test(name)) continue;
    if (ev.data.skip !== undefined || ev.data.todo !== undefined) skip++;
    else if (ev.type === "test:pass") pass++;
    else fail++;
  }
  yield `LEAF_MATCH ${JSON.stringify({ pass, fail, skip })}\n`;
}
