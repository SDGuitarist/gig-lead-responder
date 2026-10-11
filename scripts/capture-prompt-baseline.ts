// Captures generate prompts from a CLEAN checkout of a commit, never the working copy (payment-terms plan, P8).
//   npx tsx scripts/capture-prompt-baseline.ts --rev 38acd73 --out <dir>
// Inputs: src/fixtures/prompt-baseline-inputs.json (this repo). Output: <dir>/<name>.txt, one prompt per input.
// The builder reads no clock, so the same commit always yields the same bytes: verification regenerates and diffs.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const rev = arg("--rev");
const out = arg("--out");
if (!rev || !out) {
  console.error("usage: npx tsx scripts/capture-prompt-baseline.ts --rev <commit> --out <dir>");
  process.exit(2);
}
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const inputs = JSON.parse(readFileSync(join(root, "src/fixtures/prompt-baseline-inputs.json"), "utf-8")) as
  Array<{ name: string; context: string; classification: Record<string, unknown> }>;
const tree = mkdtempSync(join(tmpdir(), "prompt-baseline-"));
rmSync(tree, { recursive: true });
execFileSync("git", ["-C", root, "worktree", "add", "--detach", "--quiet", tree, rev]);
try {
  symlinkSync(join(root, "node_modules"), join(tree, "node_modules"));
  const gen = await import(pathToFileURL(join(tree, "src/prompts/generate.ts")).href);
  const price = await import(pathToFileURL(join(tree, "src/pipeline/price.ts")).href);
  mkdirSync(resolve(out), { recursive: true });
  for (const { name, context, classification } of inputs) {
    const pricing = price.lookupPrice(classification);
    writeFileSync(join(resolve(out), `${name}.txt`), gen.buildGeneratePrompt(classification, pricing, context));
  }
  console.log(`captured ${inputs.length} prompts from ${rev} (clean worktree) into ${resolve(out)}`);
} finally {
  execFileSync("git", ["-C", root, "worktree", "remove", "--force", tree]);
}
