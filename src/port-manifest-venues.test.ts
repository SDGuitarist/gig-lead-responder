import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import {
  findVenueHistory, formatVenueHistory, loadVenueHistory, resetVenueHistoryForTests, setVenueHistoryForTests,
  venueHistoryPath, type VenueHistoryEntry,
} from "./venue-history.js";
import { selectContext } from "./pipeline/context.js";
import { buildFollowUpPrompt } from "./prompts/follow-up.js";
import { runEditPipeline } from "./run-pipeline.js";
import { lookupPrice } from "./pipeline/price.js";
import { setClaudeRequesterForTests } from "./claude.js";
import { GUT_CHECK_KEYS, type Classification, type LeadRecord, type VenueContext } from "./types.js";

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

// --- Step 3: the section reaches the drafter through selectContext (both paths), never follow-ups. ---

const classification = (venue_name: string | null) => ({
  mode: "evaluation", action: "quote", vagueness: "clear", competition_level: "low", competition_quote_count: 0,
  stealth_premium: false, stealth_premium_signals: [], tier: "standard", rate_card_tier: "T2", lead_source_column: "D",
  price_point: "full_premium", format_requested: "guitarist", format_recommended: "solo", duration_hours: 2,
  stated_budget: null, event_date_iso: null, timeline_band: "comfortable", close_type: "soft_hold", event_energy: null,
  cultural_context_active: false, cultural_tradition: null, planner_effort_active: false, social_proof_active: false,
  context_modifiers: [], flagged_concerns: [], venue_name, client_first_name: null, event_arc: null,
  delivery_mode: "alex_performs", nonprofit_buyer: false, np_tier: null, organization_name: null,
}) as unknown as Classification;
const FIXTURE = { type: "ok" as const, venues: VENUES };

test("port manifest venues V8: no venue or no match leaves selectContext byte-identical to history disabled", async () => {
  try {
    for (const venue of [null, "Somewhere Else Entirely"]) {
      setVenueHistoryForTests(null);
      const disabled = await selectContext(classification(venue));
      setVenueHistoryForTests(FIXTURE);
      const enabled = await selectContext(classification(venue));
      assert.equal(enabled, disabled, String(venue));
      assert.doesNotMatch(enabled, new RegExp(MARKER));
    }
    setVenueHistoryForTests(FIXTURE);
    assert.match(await selectContext(classification("Example Harbor Hall")), new RegExp(`## ${MARKER}: Example Harbor Hall`));
  } finally { resetVenueHistoryForTests(); }
});

test("port manifest venues V11: an SMS edit of a stored classification reaches the section", async () => {
  const c = classification("Example Harbor Hall");
  const p = lookupPrice(c);
  const GEN = { reasoning: { details_present: [], absences: [], emotional_core: "", cinematic_opening: "", validation_line: "" },
    full_draft: "Hi, shorter.", compressed_draft: "Hi, shorter." };
  const GATE = { scene_quote: "q", scene_type: "cinematic", competitor_test: false,
    gut_checks: Object.fromEntries(GUT_CHECK_KEYS.map((k) => [k, true])), gate_status: "pass", fail_reasons: [],
    concern_traceability: [], best_line: "b", validation_line: "v" };
  const sent: string[] = [];
  let i = 0;
  setClaudeRequesterForTests((async (params: unknown) => {
    sent.push(JSON.stringify(params));
    const reply = i++ % 2 === 0 ? GEN : GATE;
    return { id: "m", type: "message", role: "assistant", model: "t", stop_reason: "end_turn", stop_sequence: null,
      usage: { input_tokens: 1, output_tokens: 1 }, content: [{ type: "text", text: JSON.stringify(reply) }] };
  }) as never);
  setVenueHistoryForTests(FIXTURE);
  try {
    await runEditPipeline(c, p, "Make it shorter");
    assert.ok(sent.some((x) => x.includes(`${MARKER}: Example Harbor Hall`)), "the generate request carries the section");
  } finally { setClaudeRequesterForTests(); resetVenueHistoryForTests(); }
});

test("port manifest venues V13: follow-up prompts never carry the section (excluded by the plan)", () => {
  setVenueHistoryForTests(FIXTURE);
  try {
    const lead = { venue: "Example Harbor Hall", event_type: "wedding", event_date: "2027-06-12", client_name: "Dana",
      compressed_draft: "Hi Dana.", full_draft: "Hi Dana.", strategic_reserve_json: null } as unknown as LeadRecord;
    const prompt = buildFollowUpPrompt(lead, 1);
    assert.ok(prompt.includes("Example Harbor Hall"), "control: the follow-up prompt does name the venue");
    assert.doesNotMatch(prompt, new RegExp(MARKER));
  } finally { resetVenueHistoryForTests(); }
});

test("port manifest venues V14: PF-Intel venue intel and Alex's history appear together", async () => {
  const pf = { found: true, venue_name: "Example Harbor Hall", venue_id: "v1", vendor_policies: null, contacts: [],
    event_count: 3, recent_events: [] } as unknown as VenueContext;
  setVenueHistoryForTests(FIXTURE);
  try {
    const ctx = await selectContext(classification("Example Harbor Hall"), pf);
    assert.match(ctx, /VENUE INTELLIGENCE/);
    assert.match(ctx, new RegExp(`${MARKER}: Example Harbor Hall`));
  } finally { resetVenueHistoryForTests(); }
});
