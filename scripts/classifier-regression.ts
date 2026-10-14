// Classifier regression on ORDINARY leads (plan docs/plans/2026-10-13-feat-vague-lead-quote-with-question-plan.md,
// "Classifier regression"). The vague-lead route edits one paragraph of the classifier prompt; unit tests can pin the
// words but not how the model reads them, so this runs a fixed set of ordinary and boundary leads through the REAL
// classifier N times and records what it decides, to be compared before and after the edit.
//   npx tsx scripts/classifier-regression.ts --tag before|after [--runs 5] [--out <dir>] [--today 2026-10-12]
//   npx tsx scripts/classifier-regression.ts --compare <before.json> <after.json>
// Needs ANTHROPIC_API_KEY (.env) for a run. CHANGES NO APP STATE: classification and a price-table lookup only.
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(name);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

/** The four registered test leads (.claude/commands/lead-test.md), a memorial lead from tests/voice-baseline, and two boundary leads. */
const LEADS: Record<string, string> = {
  L1_wedding_rich: `Event Type: Wedding Reception
Date: Saturday, December 24, 2025
Location: Hilton La Jolla Torrey Pines
Guest Count: 120
Budget: $400-500
Genre Request: Spanish guitar / flamenco
Lead Source: GigSalad
Notes: "We want something authentic and meaningful for our celebration"`,
  L2_birthday_sparse: `Event Type: Birthday Party
Date: March 22
Notes: "not sure on details yet"
Lead Source: The Bash`,
  L3_birthday_price_shopper: `Event Type: Birthday Party
Date: October 2026
Notes: "just getting pricing info"
Lead Source: GigSalad`,
  L4_corporate_filler: `Event Type: Corporate Event
Date: March 14
Location: Downtown San Diego
Lead Source: The Bash`,
  L5_memorial: "@file:tests/voice-baseline/lead-5-memorial.txt",
  // Boundary leads for the vague-lead route: an explicit ensemble must stay no-price; a cultural request must keep its format.
  L6_latin_band: `Hi, looking for a Latin band for our company party in June. Around 100 guests, downtown San Diego. What do you have?`,
  L7_quinceanera_mariachi: `Hi, do you have a mariachi for my daughter's quinceañera? Saturday November 14, about 80 guests, in Chula Vista.`,
};

if (process.argv.includes("--compare")) {
  const i = process.argv.indexOf("--compare");
  const [b, a] = [process.argv[i + 1], process.argv[i + 2]].map((p) => JSON.parse(readFileSync(p, "utf-8")) as { results: Record<string, Array<Record<string, unknown>>> });
  const FIELDS = ["action", "vagueness", "competition_level", "format_recommended", "duration_hours", "rate_card_tier", "stealth_premium", "quote_price"];
  const dist = (rows: Array<Record<string, unknown>>, f: string) => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(String(r[f]), (m.get(String(r[f])) ?? 0) + 1);
    return [...m].sort((x, y) => y[1] - x[1]);
  };
  let differences = 0;
  for (const lead of Object.keys(b.results)) {
    console.log(`\n== ${lead}`);
    for (const f of FIELDS) {
      const db = dist(b.results[lead], f), da = dist(a.results[lead] ?? [], f);
      const same = JSON.stringify(db.map((x) => x[0])) === JSON.stringify(da.map((x) => x[0]));
      if (!same) differences++;
      console.log(`  ${f.padEnd(20)} before ${db.map(([v, n]) => `${v} x${n}`).join(", ")} | after ${da.map(([v, n]) => `${v} x${n}`).join(", ")} ${same ? "" : "  <-- DIFFERS"}`);
    }
  }
  console.log(`\nfields whose set of values differs between before and after: ${differences}`);
  process.exit(0);
}

const tag = arg("--tag", "run");
const runs = Math.max(1, parseInt(arg("--runs", "5"), 10) || 5);
const today = arg("--today", "2026-10-12");
const out = arg("--out", join(tmpdir(), "classifier-regression"));
mkdirSync(out, { recursive: true });
const req = createRequire(join(root, "package.json"));
req("dotenv").config({ path: join(root, ".env"), quiet: true });
if (!process.env.ANTHROPIC_API_KEY) { console.error("ANTHROPIC_API_KEY is not set (.env)"); process.exit(2); }

const { classifyLead } = await import(join(root, "src/pipeline/classify.ts"));
const { lookupPrice } = await import(join(root, "src/pipeline/price.ts"));

const results: Record<string, Array<Record<string, unknown>>> = {};
for (const [name, raw] of Object.entries(LEADS)) {
  const text = raw.startsWith("@file:") ? readFileSync(join(root, raw.slice(6)), "utf-8").trim() : raw;
  results[name] = [];
  const batch = await Promise.all(Array.from({ length: runs }, () => classifyLead(text, today).catch((e: unknown) => ({ error: String(e).slice(0, 120) }))));
  for (const c of batch as Array<Record<string, unknown>>) {
    if ("error" in c) { results[name].push({ action: "ERROR", error: c.error }); continue; }
    let quote_price: unknown = "n/a";
    try { quote_price = (lookupPrice(c as never)).quote_price; } catch { quote_price = c.format_recommended === "unresolved" ? "none (unresolved)" : "lookup error"; }
    results[name].push({ action: c.action, vagueness: c.vagueness, competition_level: c.competition_level, format_recommended: c.format_recommended,
      duration_hours: c.duration_hours, rate_card_tier: c.rate_card_tier, stealth_premium: c.stealth_premium, lead_source_column: c.lead_source_column, quote_price });
  }
  console.log(`${name}: ${results[name].map((r) => `${r.action}/${r.format_recommended}/${r.quote_price}`).join("  ")}`);
}
writeFileSync(join(out, `classifier-regression-${tag}.json`), JSON.stringify({ tag, runs, today, results }, null, 2));
console.log(`written: ${join(out, `classifier-regression-${tag}.json`)}`);
