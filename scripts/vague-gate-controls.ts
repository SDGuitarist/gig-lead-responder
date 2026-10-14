// Planted-opening controls for the vague-quote verify gate (plan docs/plans/2026-10-14-fix-vague-quote-gate-opening-plan.md,
// "Decision table"): 5 generic and 5 specific openings, each verified twice under the NEW rule on a fixed made-up vague
// lead with a defaulted solo/duo format. A real model call; nothing sent; no app state touched.
//   npx tsx scripts/vague-gate-controls.ts [--out <dir>]
// Stop rules (asymmetric by cost): ANY generic text passing lead_specific_opening in EITHER verify is a control defect;
// 2 or more specific texts failing it in AT LEAST ONE verify means the rule is too tight.
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name: string, fallback: string) => { const i = process.argv.indexOf(name); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback; };
const out = arg("--out", join(tmpdir(), "vague-gate-controls"));
mkdirSync(out, { recursive: true });
const req = createRequire(join(root, "package.json"));
req("dotenv").config({ path: join(root, ".env"), quiet: true });
if (!process.env.ANTHROPIC_API_KEY) { console.error("ANTHROPIC_API_KEY missing (.env)"); process.exit(2); }
const Anthropic = req("@anthropic-ai/sdk");
const client = new (Anthropic.default ?? Anthropic)({ apiKey: process.env.ANTHROPIC_API_KEY });
const { setClaudeRequesterForTests } = await import(join(root, "src/claude.ts"));
const { verifyGate } = await import(join(root, "src/pipeline/verify.ts"));
const { VAGUE_GATE_CASES } = await import(join(root, "src/verify-prompt-cases.ts"));
setClaudeRequesterForTests((async (request: unknown) => client.messages.create(request)) as never);

// Fixed made-up lead: vague, category-only, "my mom's birthday", format defaulted to solo (S13 is the duo case).
const base = VAGUE_GATE_CASES.find((c: { id: string }) => c.id === "S13");
const CASES: Record<string, { classification: unknown; pricing: unknown }> = {
  solo: { classification: { ...base.classification, format_recommended: "solo", flagged_concerns: ["vague format request"] }, pricing: base.pricing },
  duo: { classification: base.classification, pricing: base.pricing },
};
const BODY = "Two hours solo is $700. I bring my own sound and need one outlet and an armless chair, so home, backyard, or restaurant all work. COI available upon request. Send me the date once you have it and I'll check my calendar. A 50% deposit holds the date.\n\nAlex Guillen";
const TEXTS: Array<{ id: string; kind: "generic" | "specific"; format: "solo" | "duo"; opening: string }> = [
  { id: "g1", kind: "generic", format: "solo", opening: "What a wonderful way to celebrate!" },
  { id: "g2", kind: "generic", format: "solo", opening: "You're looking for the right music for your event." },
  { id: "g3", kind: "generic", format: "solo", opening: "A solo guitarist is a lovely way to set the tone." },
  { id: "g4", kind: "generic", format: "duo", opening: "A duo is a warm way to fill an evening." },
  { id: "g5", kind: "generic", format: "duo", opening: "Thanks for reaching out about live music for your upcoming event." },
  { id: "s1", kind: "specific", format: "solo", opening: "Your mom's birthday, and you're not sure what kind of music: that is the right place for one question." },
  { id: "s2", kind: "specific", format: "solo", opening: "You said live music next month and haven't picked a format yet, which is the right moment for one question." },
  { id: "s3", kind: "specific", format: "solo", opening: "A birthday this spring and no idea yet what kind of music fits: that is exactly where one question helps." },
  { id: "s4", kind: "specific", format: "duo", opening: "You said a dinner party and you're unsure what music to pick, so here is one simple question." },
  { id: "s5", kind: "specific", format: "duo", opening: "Your wedding is still taking shape and you wrote that you're not sure what music would work: one question first." },
];
const results: Array<{ id: string; kind: string; verifies: Array<boolean | null>; error?: string }> = [];
for (const t of TEXTS) {
  const c = CASES[t.format];
  const full = `${t.opening} Does it sound more like background while people talk, or a dance floor?\n\n${BODY}`;
  const drafts = { full_draft: full, compressed_draft: `${t.opening} Background while people talk, or a dance floor? Two hours solo is $700.`, compressed_word_count: 25 };
  const verifies: Array<boolean | null> = [];
  let error: string | undefined;
  for (let i = 0; i < 2; i++) {
    try {
      const g = await verifyGate(drafts, c.classification, c.pricing);
      verifies.push((g.gut_checks as unknown as Record<string, boolean>).lead_specific_opening ?? null);
    } catch (e) { verifies.push(null); error = String(e).slice(0, 160); }
  }
  results.push({ id: t.id, kind: t.kind, verifies, ...(error ? { error } : {}) });
  console.log(`${t.id} ${t.kind} ${t.format}: lead_specific_opening ${JSON.stringify(verifies)}${error ? " ERROR " + error : ""}`);
}
const genericPassed = results.filter((r) => r.kind === "generic" && r.verifies.some((v) => v === true)).map((r) => r.id);
const specificFailed = results.filter((r) => r.kind === "specific" && r.verifies.some((v) => v === false)).map((r) => r.id);
const errors = results.filter((r) => r.verifies.some((v) => v === null)).map((r) => r.id);
const decision = {
  generic_passed_in_either_verify: genericPassed, specific_failed_in_at_least_one_verify: specificFailed, verify_errors: errors,
  STOP_loose: genericPassed.length >= 1, STOP_too_tight: specificFailed.length >= 2,
};
console.log(JSON.stringify(decision));
writeFileSync(join(out, "vague-gate-controls.json"), JSON.stringify({ results, decision }, null, 2));
