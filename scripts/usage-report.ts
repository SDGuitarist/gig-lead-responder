// Adds up logs/usage.jsonl (written by src/claude.ts) per day and model.
// Usage: npx tsx scripts/usage-report.ts [path]
// Not counted: scripts that call setClaudeRequesterForTests with their own requester (the measurement and controls scripts) bypass
// the logger in src/claude.ts, so their spend is missing here. The Anthropic Console is the only full total.
// PRICES are list prices in USD per million tokens, written from memory. Check them against the Anthropic pricing page.
import { readFileSync } from "node:fs";

const PRICES: Record<string, { in: number; out: number }> = {
  "claude-sonnet-4-6": { in: 3, out: 15 },
};

const path = process.argv[2] ?? "logs/usage.jsonl";
const rows = readFileSync(path, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const groups = new Map<string, { calls: number; inp: number; out: number; model: string }>();
for (const r of rows) {
  const key = `${String(r.ts).slice(0, 10)}  ${r.model}`;
  const g = groups.get(key) ?? { calls: 0, inp: 0, out: 0, model: r.model };
  g.calls += 1;
  g.inp += r.input_tokens + r.cache_creation_input_tokens + r.cache_read_input_tokens;
  g.out += r.output_tokens;
  groups.set(key, g);
}
for (const [key, g] of [...groups].sort()) {
  const p = PRICES[g.model];
  const cost = p ? `$${((g.inp * p.in + g.out * p.out) / 1e6).toFixed(2)}` : "no price on file";
  console.log(`${key}  calls=${g.calls}  in=${g.inp}  out=${g.out}  ~${cost}`);
}
