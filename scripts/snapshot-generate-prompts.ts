// Writes src/fixtures/generate-prompt-hashes.json: the SHA-256 of the full generate prompt for every case in
// src/generate-prompt-cases.ts, plus, for C0, the hash of the prompt OUTSIDE the three spans plan 2 changes. No prompt
// text is stored (the prompt carries private venue text the leak check forbids in a new file). Refreshing is a
// reviewed change: commit with a message that begins `snapshot refresh:` and show the prompt diff that caused it.
//   npx tsx scripts/snapshot-generate-prompts.ts
import { writeFileSync } from "node:fs";
import { GENERATE_CASES, generatePromptOf, removeSpans, sha256 } from "../src/generate-prompt-cases.js";

const hashes: Record<string, string> = {};
for (const c of GENERATE_CASES) {
  hashes[c.id] = sha256(generatePromptOf(c.id));
  console.log(`${c.id}  ${hashes[c.id].slice(0, 12)}  ${c.what}`);
}
hashes["C0-outside-spans"] = sha256(removeSpans(generatePromptOf("C0")));
console.log(`C0-outside-spans  ${hashes["C0-outside-spans"].slice(0, 12)}`);
writeFileSync("src/fixtures/generate-prompt-hashes.json", JSON.stringify(hashes, null, 2) + "\n");
