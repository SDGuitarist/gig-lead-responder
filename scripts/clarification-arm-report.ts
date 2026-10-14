// Aggregate report for the two-arm clarification measurement (docs/plans/2026-10-13-fix-clarification-draft-shape-plan.md).
// PRINTS COUNTS ONLY: never a draft or an opening, so the held-out leads (h1-h4) stay unread before the change.
//   npx tsx scripts/clarification-arm-report.ts <dirA> [<dirB>]
// One directory = the arm's own summary. Two = both, with the manifest check (compareArms), the primary estimand
// (the unusable-run rate over ALL runs) and a one-sided Fisher exact test (exploratory).
// The comparison is VOID (no statistic, exit 1) unless each arm is exactly five result files and 50 runs with a
// manifest each. Residual, by design not detected: one result file copied under a second name, or a partial lead set
// run enough times to total 50 (the lead-set hash is compared between arms, not pinned to the planned ten leads).
import { execSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { assessArms, type ArmData, type ArmManifest } from "../src/arm-manifest.js";
import { probePromptSha256 } from "../src/generate-prompt-cases.js";

interface RunResult { lead: string; ok: boolean; error?: string; verified?: boolean; words?: number; sentences?: number;
  gate_detail?: { scene_type: string; competitor_test: boolean; empty_traceability: number } }
function load(dir: string) {
  const files = readdirSync(dir).filter((f) => /^clarification-.*\.json$/.test(f)).sort();
  const parsed = files.map((f) => JSON.parse(readFileSync(join(dir, f), "utf-8")) as { manifest?: ArmManifest; results: RunResult[] });
  return { files, manifests: parsed.map((p) => p.manifest), results: parsed.flatMap((p) => p.results ?? []) };
}
const median = (xs: number[]) => (xs.length === 0 ? NaN : [...xs].sort((a, b) => a - b)[Math.floor((xs.length - 1) / 2)]);
const wilson = (k: number, n: number) => {
  if (n === 0) return [NaN, NaN];
  const z = 1.96, p = k / n, d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d, h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [c - h, c + h];
};
const pct = (x: number) => `${(100 * x).toFixed(0)}%`;
// One-sided Fisher exact: P(X <= a) where the first group has a successes of n1, the second b of n2 (a lower in group 1).
function fisherLower(a: number, n1: number, b: number, n2: number) {
  const k = a + b, N = n1 + n2;
  const lf = (n: number) => { let s = 0; for (let i = 2; i <= n; i++) s += Math.log(i); return s; };
  const logC = (n: number, r: number) => lf(n) - lf(r) - lf(n - r);
  let p = 0;
  for (let x = Math.max(0, k - n2); x <= a; x++) p += Math.exp(logC(n1, x) + logC(n2, k - x) - logC(N, k));
  return p;
}

function summary(label: string, results: RunResult[]) {
  const n = results.length;
  const returned = results.filter((r) => r.ok);
  const hard = returned.filter((r) => r.gate_detail && (r.gate_detail.scene_type !== "cinematic" || r.gate_detail.competitor_test));
  const noDraft = n - returned.length;
  const unusable = noDraft + hard.length;
  const [lo, hi] = wilson(unusable, n);
  console.log(`\n== ${label} ==`);
  console.log(`runs ${n}; no draft ${noDraft}; returned ${returned.length}`);
  console.log(`PRIMARY unusable runs (no draft, or scene not cinematic, or competitor true): ${unusable} of ${n} = ${pct(unusable / n)}  [95% Wilson ${pct(lo)}-${pct(hi)}]`);
  console.log(`hard-condition failures among returned: ${hard.length} of ${returned.length}`);
  console.log(`verified: ${returned.filter((r) => r.verified).length} of ${returned.length}`);
  console.log(`empty concern-traceability entries (drafts with one): ${returned.filter((r) => (r.gate_detail?.empty_traceability ?? 0) > 0).length}`);
  console.log(`median words ${median(returned.flatMap((r) => (r.words === undefined ? [] : [r.words])))}; median sentences ${median(returned.flatMap((r) => (r.sentences === undefined ? [] : [r.sentences])))}`);
  const errors = new Map<string, number>();
  for (const r of results.filter((x) => !x.ok)) errors.set(String(r.error).slice(0, 90), (errors.get(String(r.error).slice(0, 90)) ?? 0) + 1);
  for (const [e, c] of errors) console.log(`  error x${c}: ${e}`);
  const byLead = new Map<string, { n: number; unusable: number }>();
  for (const r of results) {
    const b = byLead.get(r.lead) ?? { n: 0, unusable: 0 };
    b.n++;
    if (!r.ok || (r.gate_detail && (r.gate_detail.scene_type !== "cinematic" || r.gate_detail.competitor_test))) b.unusable++;
    byLead.set(r.lead, b);
  }
  console.log("per lead (unusable/runs): " + [...byLead].sort().map(([l, b]) => `${l} ${b.unusable}/${b.n}`).join("  "));
  return { n, unusable };
}

const [dirA, dirB] = process.argv.slice(2).filter((x, i, all) => !x.startsWith("--") && !(i > 0 && all[i - 1].startsWith("--")));
if (!dirA) { console.error("usage: clarification-arm-report.ts <dirA> [<dirB>]"); process.exit(2); }
const a = load(dirA);
const sa = summary(`arm in ${dirA} (${a.files.length} files)`, a.results);
a.files.forEach((f, i) => console.log(`manifest ${f}: ${JSON.stringify(a.manifests[i])}`));
if (dirB) {
  const b = load(dirB);
  const sb = summary(`arm in ${dirB} (${b.files.length} files)`, b.results);
  // The probe case the experiment changes (the manifest's `probeCase`, C0 for the earlier experiments). The two hashes
  // can be given explicitly (--pre-hash, --current-hash): the tests do, so they do not depend on the prompt's state.
  const flag = (name: string) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; };
  const probeCase = a.manifests[0]?.probeCase ?? "C0";
  const fixture = JSON.parse(readFileSync("src/fixtures/generate-prompt-hashes.json", "utf-8")) as Record<string, string>;
  const preHash = flag("--pre-hash") ?? fixture[probeCase];
  const currentHash = flag("--current-hash") ?? probePromptSha256(probeCase);
  const isAncestor = (older: string, newer: string) => {
    try { execSync(`git merge-base --is-ancestor ${older} ${newer}`, { stdio: "ignore" }); return true; } catch { return false; }
  };
  const data = (x: ReturnType<typeof load>): ArmData => ({ files: x.files, manifests: x.manifests, runs: x.results.length });
  const cmp = assessArms(data(a), data(b), { preChangePromptSha256: preHash, currentPromptSha256: currentHash, isAncestor });
  b.files.forEach((f, i) => console.log(`manifest ${f}: ${JSON.stringify(b.manifests[i])}`));
  console.log("\nMANIFEST CHECK:", JSON.stringify(cmp));
  if (!cmp.ok) {
    // A void comparison prints no comparative statistic: the plan's "the comparison is void" row.
    console.log(`COMPARISON VOID: ${cmp.field}: ${cmp.detail}`);
    process.exit(1);
  }
  const p = fisherLower(sb.unusable, sb.n, sa.unusable, sa.n);
  console.log(`unusable-run rate: A ${pct(sa.unusable / sa.n)}, B ${pct(sb.unusable / sb.n)}, difference ${(100 * (sb.unusable / sb.n - sa.unusable / sa.n)).toFixed(0)} points; one-sided Fisher p (B lower) = ${p.toFixed(3)} (exploratory)`);
}
