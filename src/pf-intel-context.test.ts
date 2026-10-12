import { test } from "node:test";
import assert from "node:assert/strict";
import { formatVenueContext, PF_INTEL_USAGE } from "./pipeline/format-venue-context.js";
import { selectContext } from "./pipeline/context.js";
import { resetVenueHistoryForTests, setVenueHistoryForTests, VENUE_HISTORY_HEADER } from "./venue-history.js";
import type { Classification, VenueContext } from "./types.js";

// Plan docs/plans/2026-10-11-fix-pf-intel-facts-are-not-alexs-experience-plan.md (Revision 2). PF-Intel facts are
// public facts about a venue, not Alex's experience. Made-up venue data only; no network.
const POLICIES: NonNullable<VenueContext["vendor_policies"]> = {
  curfew_time: "10:00 PM", curfew_notes: "Outdoor amplified music only", db_limit_value: 85, db_limit_notes: "Measured at the patio edge",
  av_exclusivity: "In-house AV for the ballroom", coi_required: true, coi_details: "$1M general liability", setup_notes: "Load-in via the parking lot",
  updated_at: "2026-09-01T00:00:00Z",
};
const venue = (over: Partial<VenueContext> = {}): VenueContext => ({
  found: true, venue_name: "Example Bay Club", venue_id: "v1", vendor_policies: POLICIES,
  contacts: [{ name: "Dana Example", role: "Events manager" }],
  recent_events: [{ date: "2026-06-14", event_type: "wedding" }], event_count: 7, ...over,
});

test("F2: past events and contacts are never rendered (a policy decision, not null handling); every policy line stays, in order", () => {
  const out = formatVenueContext(venue());
  for (const x of ["Performance History", "Key Contacts", "7 past events", "2026-06-14", "Dana Example", "Events manager"]) {
    assert.ok(!out.includes(x), x);
  }
  const order = ["**Outdoor curfew:** 10:00 PM", "Outdoor amplified music only", "**dB limit:** 85 dB", "Measured at the patio edge",
    "**AV exclusivity:** In-house AV for the ballroom", "**COI required:** Yes", "$1M general liability", "**Setup notes:** Load-in via the parking lot"];
  const at = order.map((x) => out.indexOf(x));
  assert.ok(at.every((i) => i >= 0), `every policy line present: ${at}`);
  assert.deepEqual([...at].sort((a, b) => a - b), at, "in the current order");
});

test("F3: events and contacts with no policies produce no section at all", () => {
  assert.equal(formatVenueContext(venue({ vendor_policies: null })), "");
});

// --- F1, F4: the usage text (D1, pinned byte for byte) and where each permission sits (Revision 2 section bounds) ---
const D1 = "These are public facts about the venue from PF-Intel, not Alex's experience. Use a policy only to answer a logistics concern before the client asks, stated as a fact about the venue or as Alex's plan (for example: \"The venue's outdoor curfew is 10 PM, so I'll plan the last set to finish by 9:45.\"). Never say or imply that Alex knows, has played, has been to, or is familiar with this venue, its rooms, its staff or its load-in. Only Alex's own venue-history section, when one appears further down, allows that. Describe the venue only with these facts and the client's own words: no rooms, spaces, features, decor or layout from anywhere else.";
const FORBIDDEN = ["you may say so", "has performed", "insider", "played this room", "track record", "i've played", "i've performed"];
const PERMISSION = "Alex has performed at this venue. You may say so.";
const SEP = "\n\n---\n\n"; // selectContext's section separator
const lead = (venue_name: string) => ({
  mode: "evaluation", action: "quote", vagueness: "clear", competition_level: "low", competition_quote_count: 0,
  stealth_premium: false, stealth_premium_signals: [], tier: "standard", rate_card_tier: "T2", lead_source_column: "D",
  price_point: "full_premium", format_requested: "guitarist", format_recommended: "solo", duration_hours: 2,
  stated_budget: null, event_date_iso: null, timeline_band: "comfortable", close_type: "soft_hold", event_energy: null,
  cultural_context_active: false, cultural_tradition: null, planner_effort_active: false, social_proof_active: false,
  context_modifiers: [], flagged_concerns: [], venue_name, client_first_name: null, event_arc: null,
  delivery_mode: "alex_performs", nonprofit_buyer: false, np_tier: null, organization_name: null,
}) as unknown as Classification;
const count = (hay: string, needle: string) => hay.split(needle).length - 1;
// The PF-Intel section: from its opening "---\n\n## VENUE INTELLIGENCE" to its own closing "\n\n---".
function pfIntelBounds(ctx: string): [number, number] {
  const start = ctx.indexOf("---\n\n## VENUE INTELLIGENCE");
  assert.ok(start >= 0, "PF-Intel section present");
  return [start, ctx.indexOf("\n\n---", start + 5)];
}

test("F1: the usage text is D1 exactly, appears once, sits inside the PF-Intel section, and the section grants nothing", async () => {
  assert.equal(PF_INTEL_USAGE, D1);
  for (const f of FORBIDDEN) assert.ok(!D1.toLowerCase().includes(f), `D1 itself is clean: ${f}`);
  setVenueHistoryForTests(null);
  try {
    const ctx = await selectContext(lead("Example Bay Club"), venue());
    assert.equal(count(ctx, PF_INTEL_USAGE), 1);
    const [start, end] = pfIntelBounds(ctx);
    const at = ctx.indexOf(PF_INTEL_USAGE);
    assert.ok(at > start && at < end, `usage inside the section: ${start} < ${at} < ${end}`);
    const section = ctx.slice(start, end).toLowerCase();
    for (const f of FORBIDDEN) assert.ok(!section.includes(f), f);
    // The old usage line is gone from the whole prompt. ("played this room" is checked only inside the section: the
    // always-loaded voice guide has its own "I have played this room" example, measured by the F5 runs, Alex's call.)
    for (const old of ["insider edge", "track record"]) assert.ok(!ctx.toLowerCase().includes(old), old);
  } finally { resetVenueHistoryForTests(); }
});

test("F4: a venue in both sources gets both sections; the permission appears once, inside the venue-history section only", async () => {
  setVenueHistoryForTests({ type: "ok", venues: [{ name: "Example Bay Club", aliases: [], claim: null }] });
  try {
    const ctx = await selectContext(lead("Example Bay Club"), venue());
    assert.equal(count(ctx, PERMISSION), 1);
    const h = ctx.indexOf(`## ${VENUE_HISTORY_HEADER}`);
    assert.ok(h >= 0, "venue-history section present");
    const next = ctx.indexOf(SEP, h);
    const hEnd = next < 0 ? ctx.length : next;
    const at = ctx.indexOf(PERMISSION);
    assert.ok(at > h && at < hEnd, `permission inside the venue-history section: ${h} < ${at} < ${hEnd}`);
    const [start, end] = pfIntelBounds(ctx);
    assert.ok(!(at > start && at < end), "not inside the PF-Intel section");
  } finally { resetVenueHistoryForTests(); }
});
