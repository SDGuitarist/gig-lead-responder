// Local check of Alex's REAL venue-history file (plan 2026-10-11 venue history, decision 5). CI never has the file,
// so this is run by hand: before every commit of venue work, and in the Execution Path.
//   npx tsx scripts/check-venue-history.ts
// Exit 0 = PASS. Exit 1 = a check failed. Exit 2 = cannot check (no file): never a pass.
// (i) prints every venue and every sentence that would reach a draft (visibility: a sentence Alex never saw shows here);
// (ii) lead venues that must MISS never match, and known venues still HIT (only checked when that entry exists);
// (iii) a BOUNDED leakage sentinel: any 30-character window of a sentence (whitespace collapsed) found in a file
//      tracked by git under CHECK_REPO_ROOT (default: this repo). It misses paraphrases and shorter copies.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { findVenueHistory, loadVenueHistory, venueHistoryPath } from "../src/venue-history.js";
import { claimWindows, collapse, scanText } from "./venue-leak-scan.js";

const MUST_MISS = ["Del Coronado Yacht Club", "Del Coronado Beach Club", "Torrey Pines Lodge at UCSD",
  "Torrey Pines Golf Course", "Rancho Santa Fe", "Old Rancho Santa Fe", "Hotel Del", "Coasterra San Diego"];
const MUST_HIT: Array<[string, string]> = [["Hotel del Coronado", "Hotel del Coronado"],
  ["The Lodge at Torrey Pines", "Lodge at Torrey Pines"], ["Fairmont Grand Del Mar", "The Grand Del Mar"],
  ["Coasterra", "Coasterra"]];
// Public BEFORE this work: Alex's voice examples have carried the opening clause of the Lodge sentence, first in
// these commits. Never quote a sentence here: this file is public. A window counts as known only if the file AT THAT
// COMMIT already held the exact same window; any later words, any other file, any other sentence still fail.
// CHECK_KNOWN_PUBLIC (JSON, file -> commit) replaces this list for the throwaway-repo controls.
const KNOWN_PUBLIC: Record<string, string> = process.env.CHECK_KNOWN_PUBLIC
  ? JSON.parse(process.env.CHECK_KNOWN_PUBLIC)
  : { "docs/RESPONSE_CRAFT.md": "7d69d9c", "src/data/voice-references.ts": "04ff0dd",
      "docs/DRAFT_METHOD.md": "1c461cf", "docs/SOURCED_DRAFTING.md": "0e6b7b9" };
const known: string[] = [];

const path = venueHistoryPath();
const loaded = loadVenueHistory(path);
if (loaded.type === "missing") {
  console.log(`cannot check: no venue-history file at ${path}`);
  process.exit(2);
}
if (loaded.type === "invalid") {
  console.log(`FAIL: venue-history file at ${path} is invalid: ${loaded.reason}`);
  process.exit(1);
}
const venues = loaded.venues;
const failures: string[] = [];

console.log(`(i) ${venues.length} venues in ${path}`);
for (const v of venues) {
  console.log(`  - ${v.name}${v.aliases.length ? ` (aliases: ${v.aliases.join(", ")})` : ""}`);
  console.log(v.claim ? `      sentence that reaches drafts: "${v.claim}"` : "      no sentence (fact only)");
}

console.log("(ii) matching");
for (const lead of MUST_MISS) {
  const hit = findVenueHistory(lead, venues);
  if (hit) failures.push(`"${lead}" must miss but matched "${hit.name}"`);
}
for (const [lead, expected] of MUST_HIT) {
  if (!venues.some((v) => v.name === expected)) {
    console.log(`  skipped: "${expected}" is not in this file`);
    continue;
  }
  const hit = findVenueHistory(lead, venues);
  if (hit?.name !== expected) failures.push(`"${lead}" must match "${expected}" but got ${hit ? `"${hit.name}"` : "no match"}`);
}

console.log("(iii) leakage sentinel (bounded: exact copies of 30+ characters only)");
if (process.env.CHECK_KNOWN_PUBLIC) console.log("  known-public commits replaced by CHECK_KNOWN_PUBLIC");
const windows = claimWindows(venues.filter((v) => v.claim).map((v) => ({ name: v.name, claim: v.claim as string })));
const root = process.env.CHECK_REPO_ROOT || execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf-8" }).trim();
const tracked = execFileSync("git", ["-C", root, "ls-files", "-z"], { encoding: "utf-8", maxBuffer: 64 * 1024 * 1024 })
  .split("\0").filter(Boolean);
function publicVersion(file: string): string | undefined {
  const commit = KNOWN_PUBLIC[file];
  if (!commit) return undefined;
  try {
    return collapse(execFileSync("git", ["-C", root, "show", `${commit}:${file}`], { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }));
  } catch {
    failures.push(`cannot read ${file} at ${commit}: nothing in it counts as known`);
    return undefined;
  }
}
for (const file of tracked) {
  let text: string;
  try { text = collapse(readFileSync(join(root, file), "utf-8")); } catch { continue; }
  const { leaks, known: old } = scanText(text, windows, publicVersion(file));
  for (const name of leaks) failures.push(`${file}: contains 30+ characters (or all) of the sentence of "${name}"`);
  for (const name of old) known.push(`${file} (${name}): same words as at ${KNOWN_PUBLIC[file]}, public before this work`);
}
console.log(`  searched ${tracked.length} tracked files under ${root}`);
for (const k of known) console.log(`  known, not a new leak: ${k}`);

if (failures.length) {
  for (const f of failures) console.log(`FAIL: ${f}`);
  process.exit(1);
}
console.log("PASS");
