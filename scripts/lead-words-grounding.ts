// The grounding count for the lead_words field (plan docs/plans/2026-10-14-feat-lead-words-field-plan.md, "The classifier
// regression and the grounding check", item 2): the 10 made-up vague leads x N runs through the REAL classifier, counting
// per key how many phrases the model returned, how many survived the code check, and how many were dropped.
//   npx tsx scripts/lead-words-grounding.ts [--runs 5] [--out <dir>] [--today 2026-10-12]
// Exit 0 when the fabrication rate (dropped / returned) is at most 1 in 5, 1 when it is higher (the plan's STOP row),
// 2 when ANTHROPIC_API_KEY is missing, 3 when any classification errored. Real model calls; CHANGES NO APP STATE.
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { LEADS } from "./measure-leads.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name: string, fallback: string) => { const i = process.argv.indexOf(name); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback; };
const runs = Math.max(1, parseInt(arg("--runs", "5"), 10) || 5);
const today = arg("--today", "2026-10-12");
const out = arg("--out", join(tmpdir(), "lead-words-grounding"));
mkdirSync(out, { recursive: true });
const req = createRequire(join(root, "package.json"));
req("dotenv").config({ path: join(root, ".env"), quiet: true });
if (!process.env.ANTHROPIC_API_KEY) { console.error("ANTHROPIC_API_KEY is not set (.env)"); process.exit(2); }

const { callClaude } = await import(join(root, "src/claude.ts"));
const { buildClassifyPrompt } = await import(join(root, "src/prompts/classify.ts"));
const { wrapUntrustedData } = await import(join(root, "src/utils/sanitize.ts"));
const { coerceLeadWords, groundLeadWords } = await import(join(root, "src/lead-words.ts"));

const KEYS = ["occasion", "time_frame", "doubt"] as const;
const stats = Object.fromEntries(KEYS.map((k) => [k, { returned: 0, kept: 0, dropped: 0 }])) as Record<(typeof KEYS)[number], { returned: number; kept: number; dropped: number }>;
const perLead: Record<string, Array<Record<string, unknown>>> = {};
let errors = 0;
for (const [name, text] of Object.entries(LEADS)) {
  perLead[name] = [];
  for (let i = 0; i < runs; i++) {
    try {
      // The raw model output for the field (before code), so a dropped phrase is counted; the real classifyLead then
      // grounds it. callClaude with no validator returns the parsed object.
      const raw = await callClaude(buildClassifyPrompt(today), `Classify this lead:\n\n${wrapUntrustedData("lead_email", text)}`, undefined, (x: unknown) => x);
      const returned = coerceLeadWords((raw as { lead_words?: unknown }).lead_words);
      const kept = groundLeadWords(returned, text);
      for (const k of KEYS) {
        if (returned[k] !== null) { stats[k].returned++; if (kept[k] !== null) stats[k].kept++; else stats[k].dropped++; }
      }
      perLead[name].push({ returned, kept });
    } catch (e) { errors++; perLead[name].push({ error: String(e).slice(0, 160) }); }
  }
  console.log(`${name}: ${JSON.stringify(perLead[name].map((r) => (r as { kept?: unknown }).kept ?? "ERROR"))}`);
}
const returned = KEYS.reduce((n, k) => n + stats[k].returned, 0);
const dropped = KEYS.reduce((n, k) => n + stats[k].dropped, 0);
const rate = returned === 0 ? 0 : dropped / returned;
const verdict = { runs, leads: Object.keys(LEADS).length, errors, stats, returned, dropped, fabrication_rate: rate, STOP_fabrication: returned > 0 && rate > 0.2 };
console.log(JSON.stringify(verdict));
writeFileSync(join(out, "lead-words-grounding.json"), JSON.stringify({ verdict, perLead }, null, 2));
// 1 = the plan's STOP row (fabrication above 1 in 5); 3 = a classification error (a void, not a pass); 0 = clean.
process.exit(errors > 0 ? 3 : verdict.STOP_fabrication ? 1 : 0);
