// Planted-opening controls for the scoped opening rule, FIVE-cell matrix (plan
// docs/plans/2026-10-14-feat-lead-words-field-plan.md, "Decision table"): each text verified twice on a fixed made-up vague
// lead. Cell A all-null + generic, B all-null + app label, C valid phrases + an opening that quotes them, D valid phrases +
// generic or app label, E a MALFORMED stored `lead_words` + generic. Real model calls; nothing sent; no app state touched.
//   npx tsx scripts/vague-gate-controls.ts [--out <dir>]
// Stop rules (asymmetric by cost): ANY generic text passing lead_specific_opening in EITHER verify is a control defect;
// 2 or more specific texts failing it in AT LEAST ONE verify means the rule is too tight. Exit 0 only for clean controls;
// a stop condition or any verifier error exits 1 (src/gate-controls.ts).
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
const { evaluateControls } = await import(join(root, "src/gate-controls.ts"));
setClaudeRequesterForTests((async (request: unknown) => client.messages.create(request)) as never);

const { leadWordsOf } = await import(join(root, "src/lead-words.ts"));
// Fixed made-up lead: vague, category-only, "my mom's 60th birthday next month", format defaulted to duo (S13). Every
// planted classification goes through verifyGate -> buildVerifyPrompt -> sanitizeClassification: the production path,
// the one a stored classification takes too.
const base = VAGUE_GATE_CASES.find((c: { id: string }) => c.id === "S13");
const VALID = { occasion: "my mom's 60th birthday", time_frame: "next month", doubt: "not sure what kind of music" };
const NULLS = { occasion: null, time_frame: null, doubt: null };
const withWords = (lead_words: unknown) => ({ classification: { ...base.classification, lead_words }, pricing: base.pricing });
const BODY = "Two hours solo is $700. I bring my own sound and need one outlet and an armless chair, so home, backyard, or restaurant all work. COI available upon request. Send me the date once you have it and I'll check my calendar. A 50% deposit holds the date.\n\nAlex Guillen";
type Cell = "A" | "B" | "C" | "D" | "E";
const TEXTS: Array<{ id: string; cell: Cell; kind: "generic" | "specific"; words: unknown; opening: string }> = [
  { id: "A1", cell: "A", kind: "generic", words: NULLS, opening: "What a wonderful way to celebrate!" },
  { id: "A2", cell: "A", kind: "generic", words: NULLS, opening: "You're looking for the right music for your event." },
  { id: "B1", cell: "B", kind: "generic", words: NULLS, opening: "A private celebration with live music already in the room, and the conversation riding it by the second song." },
  { id: "B2", cell: "B", kind: "generic", words: NULLS, opening: "Spring private event, no venue yet, and the guitar is already the one thing you've decided on." },
  { id: "C1", cell: "C", kind: "specific", words: VALID, opening: "Your mom's 60th birthday is next month, and you're not sure what kind of music: that is exactly where one question helps." },
  { id: "C2", cell: "C", kind: "specific", words: VALID, opening: "A 60th birthday for your mom next month, and not sure what kind of music would work: one question settles it." },
  { id: "C3", cell: "C", kind: "specific", words: VALID, opening: "Next month is your mom's 60th birthday, and you said you're not sure what kind of music: here is one simple question." },
  { id: "D1", cell: "D", kind: "generic", words: VALID, opening: "What a wonderful way to celebrate!" },
  { id: "D2", cell: "D", kind: "generic", words: VALID, opening: "A private celebration with live music already in the room, and the conversation riding it by the second song." },
  { id: "D3", cell: "D", kind: "generic", words: VALID, opening: "A solo guitarist is a lovely way to set the tone." },
  { id: "E1", cell: "E", kind: "generic", words: "my mom's 60th birthday", opening: "What a wonderful way to celebrate!" },
  { id: "E2", cell: "E", kind: "generic", words: ["my mom's 60th birthday"], opening: "A private celebration with live music already in the room, and the conversation riding it by the second song." },
];
// Cell E: the malformed stored values must read as all-null BEFORE any model call.
for (const t of TEXTS.filter((x) => x.cell === "E")) {
  const read = leadWordsOf(withWords(t.words).classification);
  if (JSON.stringify(read) !== JSON.stringify(NULLS)) { console.error(`${t.id}: leadWordsOf did not read the malformed value as all-null`); process.exit(2); }
}
const results: Array<{ id: string; kind: "generic" | "specific"; cell: string; verifies: Array<boolean | null>; error?: string }> = [];
for (const t of TEXTS) {
  const c = withWords(t.words);
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
  results.push({ id: t.id, kind: t.kind, cell: t.cell, verifies, ...(error ? { error } : {}) });
  console.log(`${t.id} cell ${t.cell} (${t.kind}): lead_specific_opening ${JSON.stringify(verifies)}${error ? " ERROR " + error : ""}`);
}
const decision = evaluateControls(results);
console.log(JSON.stringify(decision));
writeFileSync(join(out, "vague-gate-controls.json"), JSON.stringify({ results, decision }, null, 2));
process.exit(decision.exitCode); // 0 only for clean controls: a stop condition or a verifier error exits 1
