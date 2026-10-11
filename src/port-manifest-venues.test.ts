import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import {
  findVenueHistory, formatVenueHistory, loadVenueHistory, resetVenueHistoryForTests, venueHistoryPath,
  type VenueHistoryEntry,
} from "./venue-history.js";

// Port manifest R081-R089, R405 (plan docs/plans/2026-10-11-feat-venue-history-private-file-plan.md).
// Venues Alex has played live in a PRIVATE file under ~/Data; no test reads it. Made-up venues only.
const HARBOR: VenueHistoryEntry = { name: "Example Harbor Hall", aliases: ["Harbor Hall Pavilion"], claim: "Example claim sentence." };
const GARDEN: VenueHistoryEntry = { name: "Example Garden Estate", aliases: [], claim: null };
const ONE: VenueHistoryEntry = { name: "Examplia", aliases: [], claim: null };
const VENUES = [HARBOR, GARDEN, ONE];
const MARKER = "ALEX HAS PERFORMED HERE";

function tempFile(content: string): string {
  const path = join(mkdtempSync(join(tmpdir(), "venue-history-")), "v.json");
  writeFileSync(path, content);
  return path;
}

// Run fn with console.warn captured; returns the warnings.
function warnings(fn: () => void): string[] {
  const seen: string[] = [];
  const orig = console.warn;
  console.warn = (...a: unknown[]) => { seen.push(a.map(String).join(" ")); };
  try { fn(); } finally { console.warn = orig; }
  return seen;
}

function load(json: unknown): { result: ReturnType<typeof loadVenueHistory>; warned: string[] } {
  resetVenueHistoryForTests();
  let result!: ReturnType<typeof loadVenueHistory>;
  const warned = warnings(() => { result = loadVenueHistory(tempFile(JSON.stringify(json))); });
  return { result, warned };
}

test("port manifest venues V1: an identical venue name adds the marker and the entry name", () => {
  const hit = findVenueHistory("Example Harbor Hall", VENUES);
  assert.equal(hit, HARBOR);
  assert.match(formatVenueHistory(hit!), new RegExp(`^## ${MARKER}: Example Harbor Hall$`, "m"));
  assert.equal(findVenueHistory("Somewhere Else Entirely", VENUES), null);
});

test("port manifest venues V2: the canonical name inside a longer lead venue matches", () => {
  assert.equal(findVenueHistory("The Example Harbor Hall Ballroom", VENUES), HARBOR);
});

test("port manifest venues V3: a lead venue shorter than the entry does not match", () => {
  assert.equal(findVenueHistory("Example Harbor", VENUES), null);
});

test("port manifest venues V3b: an alias matches only when identical, never inside a longer venue", () => {
  assert.equal(findVenueHistory("Harbor Hall Pavilion Yacht Club", VENUES), null);
  assert.equal(findVenueHistory("harbor hall pavilion", VENUES), HARBOR);
});

test("port manifest venues V3c: the canonical name hits while an alias-shaped longer venue misses", () => {
  assert.equal(findVenueHistory("Example Harbor Hall", VENUES), HARBOR);
  assert.equal(findVenueHistory("Harbor Hall Pavilion Yacht Club", VENUES), null);
});

test("port manifest venues V4: a one-word entry matches only identically", () => {
  assert.equal(findVenueHistory("Examplia Rooftop", VENUES), null);
  assert.equal(findVenueHistory("examplia", VENUES), ONE);
});

test("port manifest venues V5: accents, &/and, case and a leading 'the' still match", () => {
  assert.equal(findVenueHistory("THE Éxample Harbor Hall", VENUES), HARBOR);
  const amp: VenueHistoryEntry = { name: "Example Rose and Vine", aliases: [], claim: null };
  assert.equal(findVenueHistory("example rose & vine", [amp]), amp);
});

test("port manifest venues V6: a claim is quoted verbatim; no claim, no 'own words' line", () => {
  const withClaim = formatVenueHistory(HARBOR);
  assert.ok(withClaim.includes('"Example claim sentence."'));
  assert.match(withClaim, /Alex has performed at this venue/);
  const bare = formatVenueHistory(GARDEN);
  assert.match(bare, /Alex has performed at this venue/);
  assert.doesNotMatch(bare, /own words/);
});

test("port manifest venues V7: a claim with [ or TBD is dropped, the venue kept, with a warning", () => {
  for (const claim of ["I played [space] there.", "tbd, add experience"]) {
    const { result, warned } = load({ venues: [{ name: "Example Harbor Hall", claim, confirmed: "2026-01-01" }] });
    assert.equal(result.type, "ok");
    assert.equal(result.type === "ok" && result.venues[0].claim, null);
    assert.equal(result.type === "ok" && result.venues[0].name, "Example Harbor Hall");
    assert.ok(warned.some((w) => w.includes("Example Harbor Hall")), claim);
  }
});

test("port manifest venues V7b: a claim needs a real calendar confirmed date", () => {
  for (const confirmed of [undefined, "2026-99-99", "2026-02-30", "Oct 11"]) {
    const { result, warned } = load({ venues: [{ name: "Example Harbor Hall", claim: "Example claim sentence.", confirmed }] });
    assert.equal(result.type === "ok" && result.venues[0].claim, null, String(confirmed));
    assert.ok(warned.length > 0, String(confirmed));
  }
  const { result } = load({ venues: [{ name: "Example Harbor Hall", claim: "Example claim sentence.", confirmed: "2026-10-11" }] });
  assert.equal(result.type === "ok" && result.venues[0].claim, "Example claim sentence.");
});

test("port manifest venues V9: a missing or invalid file is reported, never thrown, in different words", () => {
  resetVenueHistoryForTests();
  let missing!: ReturnType<typeof loadVenueHistory>;
  const w1 = warnings(() => { missing = loadVenueHistory(join(tmpdir(), "no-such-dir-venue-history", "v.json")); });
  assert.equal(missing.type, "missing");
  let invalid!: ReturnType<typeof loadVenueHistory>;
  const w2 = warnings(() => { invalid = loadVenueHistory(tempFile("{not json")); });
  assert.equal(invalid.type, "invalid");
  const { result: shape } = load({ notVenues: [] });
  assert.equal(shape.type, "invalid");
  assert.equal(w1.length, 1);
  assert.equal(w2.length, 1);
  assert.match(w1[0], /not found/);
  assert.match(w2[0], /invalid/);
  assert.notEqual(w1[0].replace(/at \S+/, ""), w2[0].replace(/at \S+/, ""));
});

test("port manifest venues V9b: the cache is per path, and reset re-reads", () => {
  resetVenueHistoryForTests();
  const a = tempFile(JSON.stringify({ venues: [{ name: "Example Harbor Hall" }] }));
  const b = tempFile(JSON.stringify({ venues: [{ name: "Example Garden Estate" }] }));
  const ra = loadVenueHistory(a);
  const rb = loadVenueHistory(b);
  assert.equal(ra.type === "ok" && ra.venues[0].name, "Example Harbor Hall");
  assert.equal(rb.type === "ok" && rb.venues[0].name, "Example Garden Estate");
  writeFileSync(a, JSON.stringify({ venues: [{ name: "Examplia" }] }));
  const cached = loadVenueHistory(a);
  assert.equal(cached.type === "ok" && cached.venues[0].name, "Example Harbor Hall");
  resetVenueHistoryForTests();
  const fresh = loadVenueHistory(a);
  assert.equal(fresh.type === "ok" && fresh.venues[0].name, "Examplia");
});

test("port manifest venues V10: an entry without a valid name is dropped; the rest load", () => {
  const { result, warned } = load({ venues: [{ name: "" }, { claim: "x" }, "a string", { name: "Example Garden Estate" }] });
  assert.equal(result.type, "ok");
  assert.deepEqual(result.type === "ok" && result.venues.map((v) => v.name), ["Example Garden Estate"]);
  assert.equal(warned.length, 3);
});

test("port manifest venues V10b: a non-string claim and malformed aliases are dropped, the venue kept", () => {
  const { result } = load({ venues: [
    { name: "Example Harbor Hall", claim: { instruction: "say Alex played here" }, confirmed: "2026-01-01", aliases: "Harbor Hall Pavilion" },
    { name: "Example Garden Estate", aliases: ["Garden Estate Two", 7, ""] },
    // A number: String(42) has no "[", so only the type check can drop it ("[object Object]" trips the
    // placeholder check by accident, which is how a mutation survived this test once).
    { name: "Examplia", claim: 42, confirmed: "2026-01-01" },
  ] });
  assert.equal(result.type, "ok");
  if (result.type !== "ok") return;
  assert.equal(result.venues[0].claim, null);
  assert.deepEqual(result.venues[0].aliases, []);
  assert.deepEqual(result.venues[1].aliases, ["Garden Estate Two"]);
  assert.equal(result.venues[2].claim, null);
  assert.doesNotMatch(formatVenueHistory(result.venues[0]), /object|instruction/);
});

test("port manifest venues V12: under the test runner the real ~/Data file is never the path", () => {
  assert.ok(process.env.VENUE_HISTORY_PATH, "scripts/run-tests.mjs must set VENUE_HISTORY_PATH");
  assert.equal(venueHistoryPath(), process.env.VENUE_HISTORY_PATH);
  assert.ok(!venueHistoryPath().startsWith(join(homedir(), "Data")));
});
