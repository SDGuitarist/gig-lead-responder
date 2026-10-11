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

const MUST_MISS = ["Del Coronado Yacht Club", "Del Coronado Beach Club", "Torrey Pines Lodge at UCSD",
  "Torrey Pines Golf Course", "Rancho Santa Fe", "Old Rancho Santa Fe", "Hotel Del", "Coasterra San Diego"];
const MUST_HIT: Array<[string, string]> = [["Hotel del Coronado", "Hotel del Coronado"],
  ["The Lodge at Torrey Pines", "Lodge at Torrey Pines"], ["Fairmont Grand Del Mar", "The Grand Del Mar"],
  ["Coasterra", "Coasterra"]];
const WINDOW = 30;
// Public BEFORE this work: Alex's voice examples have carried the opening clause of the Lodge sentence since
// 2026-02-20 (first commit 7d69d9c; also 04ff0dd, 1c461cf, 0e6b7b9). Never quote a sentence here: this file is public. Exactly these file + venue pairs are reported, not failed;
// any other file, or another venue's sentence, still fails.
const KNOWN_PUBLIC = new Set(["docs/DRAFT_METHOD.md|Lodge at Torrey Pines", "docs/RESPONSE_CRAFT.md|Lodge at Torrey Pines",
  "docs/SOURCED_DRAFTING.md|Lodge at Torrey Pines", "src/data/voice-references.ts|Lodge at Torrey Pines"]);
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
const collapse = (s: string) => s.replace(/\s+/g, " ");
const windows = new Map<string, string>();
for (const v of venues) {
  if (!v.claim) continue;
  const c = collapse(v.claim);
  if (c.length < WINDOW) windows.set(c, v.name);
  for (let i = 0; i + WINDOW <= c.length; i++) windows.set(c.slice(i, i + WINDOW), v.name);
}
function report(file: string, name: string, what: string): void {
  if (KNOWN_PUBLIC.has(`${file}|${name}`)) known.push(`${file} (${name}): public since 2026-02-20, Alex's voice examples`);
  else failures.push(`${file}: contains ${what} of "${name}"`);
}
const root = process.env.CHECK_REPO_ROOT || execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf-8" }).trim();
const tracked = execFileSync("git", ["-C", root, "ls-files", "-z"], { encoding: "utf-8", maxBuffer: 64 * 1024 * 1024 })
  .split("\0").filter(Boolean);
for (const file of tracked) {
  let text: string;
  try { text = collapse(readFileSync(join(root, file), "utf-8")); } catch { continue; }
  for (const [w, name] of windows) {
    if (w.length < WINDOW && text.includes(w)) { report(file, name, "the whole sentence"); break; }
  }
  for (let i = 0; i + WINDOW <= text.length; i++) {
    const name = windows.get(text.slice(i, i + WINDOW));
    if (name) { report(file, name, "30+ characters of the sentence"); break; }
  }
}
console.log(`  searched ${tracked.length} tracked files under ${root}`);
for (const k of known) console.log(`  known, not a new leak: ${k}`);

if (failures.length) {
  for (const f of failures) console.log(`FAIL: ${f}`);
  process.exit(1);
}
console.log("PASS");
