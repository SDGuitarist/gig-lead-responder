// Offline replay of the clarification validator's internal-term check over stored model drafts (plan
// docs/plans/2026-10-13-fix-clarification-internal-terms-plan.md, Execution Path). NO model call, no network.
//   npx tsx scripts/clarification-validator-replay.ts <dir> [<dir> ...]
// Each directory holds `clarification-*.json` result files written by scripts/clarification-measure.ts. For every
// DISTINCT full_draft / compressed_draft of every logged generate call it counts how often the OLD internal-term
// alternative (copied below, labelled) and the CURRENT pattern match, prints the context of every draft the old
// alternative matched, and the SHA-256 of each input file. Exit 2 (one line on stderr) when a directory is missing,
// holds no result file, or the inputs yield zero drafts: an empty input must not read as "no matches".
//
// LIMIT: stored drafts were written under the validator and prompts of their day; this is an observation of those
// drafts, not a measure of recall on unseen ones.
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { PRICE_STATEMENT_PATTERN } from "../src/pipeline/generate.js";

const OLD_INTERNAL = /\banchor\b|\bfloor\b|\binvestment\b/i; // the alternative before plan 2026-10-13-fix-clarification-internal-terms
const INTERNAL_WORD = /anchor|floor|investment/i;

const dirs = process.argv.slice(2);
if (dirs.length === 0) { console.error("usage: clarification-validator-replay.ts <dir> [<dir> ...]"); process.exit(2); }

const files: string[] = [];
for (const d of dirs) {
  if (!existsSync(d) || !statSync(d).isDirectory()) { console.error(`replay: not a directory: ${d}`); process.exit(2); }
  const found = readdirSync(d).filter((f) => /^clarification-.*\.json$/.test(f)).sort().map((f) => join(d, f));
  if (found.length === 0) { console.error(`replay: no clarification-*.json in ${d}`); process.exit(2); }
  files.push(...found);
}

const drafts = new Set<string>();
let runs = 0;
for (const f of files) {
  const parsed = JSON.parse(readFileSync(f, "utf-8")) as { results?: Array<{ calls?: Array<{ full_draft?: string; compressed_draft?: string }> }> };
  for (const r of parsed.results ?? []) {
    runs++;
    for (const c of r.calls ?? []) for (const t of [c.full_draft, c.compressed_draft]) if (t) drafts.add(t);
  }
}
if (drafts.size === 0) { console.error("replay: the inputs hold no drafts"); process.exit(2); }

let oldHits = 0, newInternal = 0, newOther = 0;
const contextLines: string[] = [];
for (const t of drafts) {
  const o = OLD_INTERNAL.exec(t);
  const n = PRICE_STATEMENT_PATTERN.exec(t);
  if (o) {
    oldHits++;
    contextLines.push(`old matched "${o[0]}"${n ? `; new ALSO rejects "${n[0]}"` : "; new passes"}: ...${t.slice(Math.max(0, o.index - 50), o.index + o[0].length + 40).replace(/\s+/g, " ")}...`);
  }
  if (n) { if (INTERNAL_WORD.test(n[0])) newInternal++; else newOther++; }
}

console.log(`files ${files.length}; runs ${runs}; distinct drafts ${drafts.size}`);
for (const f of files) console.log(`  ${createHash("sha256").update(readFileSync(f)).digest("hex")}  ${f}`);
console.log(`old internal-term alternative matches: ${oldHits} drafts`);
console.log(`current pattern rejects for an internal term: ${newInternal} drafts; for the number grammar: ${newOther} drafts`);
for (const l of contextLines) console.log(`  ${l}`);
