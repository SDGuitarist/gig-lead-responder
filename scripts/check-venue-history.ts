// Local check of Alex's REAL venue-history file (plan 2026-10-11 venue history, decision 5). CI never has the file,
// so this is run by hand: before every commit of venue work, and in the Execution Path.
//   npx tsx scripts/check-venue-history.ts
// Exit 0 = PASS. Exit 1 = a check failed. Exit 2 = cannot check (no file): never a pass.
// (i) prints every venue and every sentence that would reach a draft (visibility: a sentence Alex never saw shows here);
// (ii) lead venues that must MISS never match, and known venues still HIT (only checked when that entry exists);
// (iii) a BOUNDED leakage sentinel: any 30-character window of a sentence (whitespace collapsed) found in a file
//      tracked by git under CHECK_REPO_ROOT (default: this repo). It misses paraphrases and shorter copies.
import { execFileSync } from "node:child_process";
import { readFileSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { findVenueHistory, loadVenueHistory, venueHistoryPath } from "../src/venue-history.js";
import { claimWindows, collapse, scanText, windowKey } from "./venue-leak-scan.js";

const MUST_MISS = ["Del Coronado Yacht Club", "Del Coronado Beach Club", "Torrey Pines Lodge at UCSD",
  "Torrey Pines Golf Course", "Rancho Santa Fe", "Old Rancho Santa Fe", "Hotel Del", "Coasterra San Diego"];
const MUST_HIT: Array<[string, string]> = [["Hotel del Coronado", "Hotel del Coronado"],
  ["The Lodge at Torrey Pines", "Lodge at Torrey Pines"], ["Fairmont Grand Del Mar", "The Grand Del Mar"],
  ["Coasterra", "Coasterra"]];
// Public BEFORE this work: parts of two sentences (Lodge, Del) sit in Alex's voice examples in these files, first
// public at the commit named on each line. Never quote a sentence here: this file is public. Each entry is the
// windowKey() fingerprint of one exact 30-character window that the file held at that commit; only those windows
// count as known. Any other window, file or sentence fails. Fixed in code on purpose: nothing in the environment
// can widen it (code review round 2). To change it, recompute from the commit and show the change in review.
const APPROVED: Record<string, Set<string>> = {
  "docs/RESPONSE_CRAFT.md": new Set(( // 7d69d9c, 40 windows
    "68a88125c5ed195b f104085422d7dbbb fe85e6d5f7a77deb 6a208d1d7ba344c8 d9988e84d8ed2ef1 8f4d217330c796f7 " +
    "f0afa82e93cd7a50 2a39f7e45df44508 e736766590e5940c 022cb7cde0addd91 5e79ad0bd07aa96d b42ee28be054dac7 " +
    "45a0218cca8db4fb c2cfa8e872d93499 30cc65c5ccaaadfc 55bb31dc488e7305 83f6406b5b03261c 0ab1dca0bd8c886e " +
    "600a27fe58584593 c20ee49da1ea5ae3 0e314359ec15b108 ecc39577e32c864d 805137250b1b4e8c 91a4f28f3424359a " +
    "0849b703af7a7cc2 f2c5436f9cf7aeb0 42cc4098324919c0 3a93069e4e92ca6b 3213ffb3bad55cd3 65b6b69bab538563 " +
    "467c09ad2cf01a57 22250e6edd5e2124 beca539f4b093b04 7655475b713b16a6 070caff24311eeb6 f8354718ae365030 " +
    "2cf08057118e546b 71de6405ed1bc3fc e038cb69c132af04 6cb285237375b6d4"
  ).split(" ")),
  "src/data/voice-references.ts": new Set(( // 04ff0dd, 9 windows
    "f364fc252d94acb0 c2ab003389c3b472 37f5cad2f153c972 737017e90828061f abef587d7eb3042d f52e87126f0c4dbe " +
    "13c5d852c3ac51d3 255b5eaf09a6eba0 981c169debaa855b"
  ).split(" ")),
  "docs/DRAFT_METHOD.md": new Set(( // 1c461cf, 9 windows
    "ce4838d3ad2a9f97 fccf983838bb9ad4 fc0bf24d109f018a 81cba441aabd10d0 734464143ee3d7a1 6c74d510d0852ec0 " +
    "e1a3b342d80e7ac0 f6a20b2b2c490a24 ba604084bcb628a9"
  ).split(" ")),
  "docs/SOURCED_DRAFTING.md": new Set(( // 0e6b7b9, 9 windows
    "eabff29950c3338a a97035fe10c91bb3 a0e4924b78a7e39d 937adba509c3b74b 37802c5fbe6cb3e9 a05b29921b841d4e " +
    "a3613e2ae242d8ed 0f8191d32d898ae7 3a519863f6eac4b8"
  ).split(" ")),
  // The P8 prompt baselines (payment-terms plan) copy the generate prompt, so they hold the SAME 9 public windows as
  // src/data/voice-references.ts (checked window by window against its approved keys, 2026-10-11). Nothing new.
  "src/fixtures/prompt-baseline/direct-t3-wedding.txt": new Set(( // 38acd73 prompt, 9 windows
    "da00a99ca1e3824e 70c9b196fdf548a7 3d00275c93ad3fc7 e8a15ad245280bb7 5c893a5857eed3ec ee81b2992e5548b3 " +
    "c8398c620436ee0e a46297322461256c 56802fd6a7c647eb"
  ).split(" ")),
  "src/fixtures/prompt-baseline/gigsalad-t2-party.txt": new Set(( // 38acd73 prompt, 9 windows
    "7b507adb1833279c 36c78cbe8233a3d9 08c2b9675274a82f c922a527dc679eed ee2559eac54ca1ce 7c1687cba85d893c " +
    "59bc992f5cb41edd a0890bf83151d0bb c1d42e19b02c34ee"
  ).split(" ")),
  "src/fixtures/prompt-baseline/np2-nonprofit.txt": new Set(( // 38acd73 prompt, 9 windows
    "1741190581bfb9b0 74e97011bdb13992 a8c2ff269e8aa3a9 39327f7281bec57b 48d2b4b3c223427c 9f17f5ebd29af728 " +
    "c9a44a38a1e40fe6 d6c4a3ff29633e3b 72769550ec0c62b0"
  ).split(" ")),
};
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
const windows = claimWindows(venues.filter((v) => v.claim).map((v) => ({ name: v.name, claim: v.claim as string })));
const thisRepo = join(dirname(fileURLToPath(import.meta.url)), ".."); // this script's repo, whatever the cwd
const root = process.env.CHECK_REPO_ROOT || thisRepo;
const control = realpathSync(root) !== realpathSync(thisRepo);
const tracked = execFileSync("git", ["-C", root, "ls-files", "-z"], { encoding: "utf-8", maxBuffer: 64 * 1024 * 1024 })
  .split("\0").filter(Boolean);
for (const file of tracked) {
  let text: string;
  try { text = collapse(readFileSync(join(root, file), "utf-8")); } catch { continue; }
  const approved = control ? undefined : APPROVED[file];
  const { leaks, known: old } = scanText(text, windows, (w) => approved?.has(windowKey(file, w)) ?? false);
  for (const name of leaks) failures.push(`${file}: contains 30+ characters (or all) of the sentence of "${name}"`);
  for (const name of old) known.push(`${file} (${name}): only windows already public before this work`);
}
console.log(`  searched ${tracked.length} tracked files under ${root}`);
for (const k of known) console.log(`  known, not a new leak: ${k}`);

if (failures.length) {
  for (const f of failures) console.log(`FAIL: ${f}`);
  process.exit(1);
}
console.log(control ? `PASS for the CONTROL repo ${root} only (no exemptions applied); this repo was not checked` : "PASS");
