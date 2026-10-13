// Measures the clarification-mode generation failure (docs/plans/2026-10-13-fix-clarification-pricing-validator-plan.md).
// CHANGES NO APP STATE: a real model call, a scratch DATABASE_PATH, nothing sent, data/leads.db untouched.
//
//   npx tsx scripts/clarification-measure.ts [--runs 3] [--leads v1,v2,...] [--out <dir>] [--tag <name>] [--today 2026-10-12]
//
// Records, per run: whether a draft came back, `verified`, the gate status and fail reasons; per generate call: the
// question sentences of both drafts.
// Needs ANTHROPIC_API_KEY (read from .env). For each made-up vague lead it runs the real pipeline `--runs` times and
// logs every generate response (the pipeline throws a rejected draft away), then scans each draft for price-like text.
// The scan is OBSERVATIONAL evidence of what the model wrote on these runs, not proof that the validator catches
// every price. Output: <out>/clarification-<tag>.json and a summary table on stdout.
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(name);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const runs = Math.max(1, parseInt(arg("--runs", "3"), 10) || 3);
const only = arg("--leads", "").split(",").map((s) => s.trim()).filter(Boolean);
const tag = arg("--tag", "run");
const today = arg("--today", "2026-10-12");
const out = arg("--out", join(tmpdir(), "clarification-measure"));
mkdirSync(out, { recursive: true });

const req = createRequire(join(root, "package.json"));
req("dotenv").config({ path: join(root, ".env"), quiet: true });
process.env.DATABASE_PATH = join(out, `scratch-${tag}.db`);
if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY is not set (.env)");
  process.exit(2);
}

// The vague leads: made up, no venue, no private data.
export const LEADS: Record<string, string> = {
  v1: "Hi, I'm looking for live music for an event sometime next month. I'm not sure what kind of music or how many musicians would work. What do you suggest?",
  v2: "Hi Alex, we are thinking about some live music for a gathering this winter. Not sure yet what we need or what would suit it. Could we talk?",
  v3: "Hi, do you play weddings? Looking for some music. How much?",
  v4: "Need live music for a party. Not sure what's best.",
  v5: "Hello, planning an event in the spring and want some live entertainment. What options do you have and what do they cost?",
  v6: "Hi Alex, looking for a musician for my mom's birthday. Not sure what type of music or how long. Thoughts?",
};

// What to look for. "stated" classes are an amount; "word" classes are vocabulary the validator deliberately allows.
const NUM = "(?:a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|grand)";
const SCAN: Array<{ cls: string; kind: "stated" | "word"; re: RegExp }> = [
  { cls: "dollar_figure", kind: "stated", re: /\$\s?\d/i },
  { cls: "digits_currency_word", kind: "stated", re: /\b\d[\d,]*(?:\.\d+)?\s?(?:dollars?|bucks|usd)\b|\busd\s?\d/i },
  { cls: "spelled_amount", kind: "stated", re: new RegExp(`\\b${NUM}(?:[\\s-]+${NUM})*\\s+(?:dollars?|bucks)\\b`, "i") },
  { cls: "k_amount", kind: "stated", re: /\b\d+(?:\.\d+)?\s?k\b/i },
  { cls: "internal_term", kind: "stated", re: /\b(?:anchor|floor|investment)\b/i },
  { cls: "rate_word", kind: "word", re: /\brates?\b/i },
  { cls: "quote_word", kind: "word", re: /\bquote[ds]?\b|\bquoting\b/i },
  { cls: "price_word", kind: "word", re: /\b(?:prices?|pricing|costs?|per hour|hourly)\b/i },
  { cls: "starts_word", kind: "word", re: /\bstart(?:s|ing)\s+(?:at|low|from)\b/i },
  { cls: "package_word", kind: "word", re: /\bpackages?\b/i },
];
const scan = (text: string) =>
  SCAN.flatMap(({ cls, kind, re }) => {
    const m = re.exec(text);
    return m ? [{ cls, kind, match: m[0], context: text.slice(Math.max(0, m.index - 40), m.index + m[0].length + 40).replace(/\s+/g, " ") }] : [];
  });

const Anthropic = req("@anthropic-ai/sdk");
const client = new (Anthropic.default ?? Anthropic)({ apiKey: process.env.ANTHROPIC_API_KEY });
const { setClaudeRequesterForTests } = await import(join(root, "src/claude.ts"));
const { runPipeline } = await import(join(root, "src/run-pipeline.ts"));

type Hit = ReturnType<typeof scan>[number];
type Call = { full_draft: string; compressed_draft: string; fullHits: Hit[]; compressedHits: Hit[]; questions: [number, number]; questionSentences: [string[], string[]] };
/** Every sentence of a draft that holds a question mark (shows a binary question split over two sentences). */
const questionSentences = (t: string) => (t.match(/[^.!?\n]*\?/g) ?? []).map((s) => s.trim());
let calls: Call[] = [];
setClaudeRequesterForTests((async (request: unknown) => {
  const res = await client.messages.create(request);
  const text = (res.content ?? []).map((c: { text?: string }) => c.text ?? "").join("");
  let parsed: { full_draft?: unknown; compressed_draft?: unknown } | null = null;
  try { parsed = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, "")); } catch { /* not a generate response */ }
  if (parsed && typeof parsed.full_draft === "string") {
    const f = parsed.full_draft;
    const c = String(parsed.compressed_draft ?? "");
    calls.push({ full_draft: f, compressed_draft: c, fullHits: scan(f), compressedHits: scan(c),
      questions: [(f.match(/\?/g) ?? []).length, (c.match(/\?/g) ?? []).length],
      questionSentences: [questionSentences(f), questionSentences(c)] });
  }
  return res;
}) as never);

type RunResult = { lead: string; run: number; ok: boolean; error?: string; action?: string; verified?: boolean; gate_status?: string; fail_reasons?: string[]; gate_detail?: { scene_type: string; competitor_test: boolean; false_checks: string[]; empty_traceability: number; rule_implied_pass: boolean; opening: string }; seconds: number; calls: Call[] };
const results: RunResult[] = [];
const names = Object.keys(LEADS).filter((n) => only.length === 0 || only.includes(n));
for (const name of names) {
  for (let run = 1; run <= runs; run++) {
    calls = [];
    const t0 = Date.now();
    let r: Omit<RunResult, "calls" | "seconds" | "lead" | "run">;
    try {
      const o = await runPipeline(LEADS[name], undefined, undefined, undefined, today);
      const g = o.gate;
      const falseChecks = Object.entries(g.gut_checks).filter(([, v]) => v === false).map(([k]) => k);
      const emptyTrace = g.concern_traceability.filter((t: { draft_sentence: string }) => !t.draft_sentence).length;
      // The gate's own stated rule (src/prompts/verify.ts section 9): cinematic, competitor_test false, no empty
      // traceability, at least 16 of 18 gut checks (GUT_CHECK_THRESHOLD of GUT_CHECK_TOTAL; competitor_test is one of the
      // 18 keys and passes when false, so it is not counted as a false check below). gate_status is the verifier model's
      // judgment, not computed.
      const otherFalse = falseChecks.filter((k) => k !== "competitor_test");
      const implied = g.scene_type === "cinematic" && g.competitor_test === false && emptyTrace === 0 && otherFalse.length <= 2;
      // The opening: first sentence of the final full draft (a leading salutation line such as "Hi Sam," is skipped).
      const lines = String(o.drafts.full_draft).split("\n").map((l: string) => l.trim()).filter(Boolean);
      if (lines.length > 1 && /,$/.test(lines[0]) && lines[0].length <= 40) lines.shift();
      const opening = (lines[0] ?? "").split(/(?<=[.!?])\s/)[0];
      r = { ok: true, action: o.classification.action, verified: o.verified, gate_status: g.gate_status, fail_reasons: g.fail_reasons,
        gate_detail: { scene_type: g.scene_type, competitor_test: g.competitor_test, false_checks: falseChecks, empty_traceability: emptyTrace, rule_implied_pass: implied, opening } };
    } catch (e) {
      r = { ok: false, error: String(e).slice(0, 200) };
    }
    results.push({ lead: name, run, ...r, seconds: Math.round((Date.now() - t0) / 1000), calls });
    console.log(`${name} run${run}: ${r.ok ? `draft (${r.action}) verified=${r.verified} gate=${r.gate_status}` : "ERROR " + r.error} [${calls.length} generate call(s)]`);
  }
}
writeFileSync(join(out, `clarification-${tag}.json`), JSON.stringify({ today, runs, results }, null, 2));

// Summary
const allCalls = results.flatMap((r) => r.calls);
const count = (kind: "stated" | "word") => {
  const m = new Map<string, number>();
  for (const c of allCalls) for (const h of new Set([...c.fullHits, ...c.compressedHits].filter((x) => x.kind === kind).map((x) => x.cls))) m.set(h, (m.get(h) ?? 0) + 1);
  return Object.fromEntries(m);
};
console.log("\n=== summary (observational: what the model wrote on these runs) ===");
console.log(JSON.stringify({
  runs: results.length,
  runs_with_no_draft: results.filter((r) => !r.ok).length,
  generate_calls: allCalls.length,
  calls_with_a_stated_amount_or_internal_term: allCalls.filter((c) => [...c.fullHits, ...c.compressedHits].some((h) => h.kind === "stated")).length,
  stated_classes: count("stated"),
  allowed_word_classes: count("word"),
  drafts_verified: results.filter((r) => r.ok && r.verified).length,
  drafts_not_verified: results.filter((r) => r.ok && !r.verified).length,
  fail_reasons: [...new Set(results.flatMap((r) => r.fail_reasons ?? []))],
  errors: [...new Set(results.filter((r) => !r.ok).map((r) => r.error))],
}, null, 2));
console.log(`details: ${join(out, `clarification-${tag}.json`)}`);
