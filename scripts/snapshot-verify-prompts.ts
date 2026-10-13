// Writes src/fixtures/verify-prompt-baseline/<id>.txt for every case in src/verify-prompt-cases.ts from the CURRENT
// buildVerifyPrompt. Refreshing snapshots is a reviewed change: commit with a message that begins `snapshot refresh:`
// and show the prompt diff that caused it (plan: "The snapshot inventory").
//   npx tsx scripts/snapshot-verify-prompts.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { buildVerifyPrompt } from "../src/prompts/verify.js";
import { VERIFY_CASES, snapshotForm } from "../src/verify-prompt-cases.js";

const dir = "src/fixtures/verify-prompt-baseline";
mkdirSync(dir, { recursive: true });
for (const c of VERIFY_CASES) {
  writeFileSync(`${dir}/${c.id}.txt`, snapshotForm(buildVerifyPrompt(c.classification, c.pricing)));
  console.log(`${c.id}  ${c.what}`);
}
