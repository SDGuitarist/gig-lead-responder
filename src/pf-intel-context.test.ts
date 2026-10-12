import { test } from "node:test";
import assert from "node:assert/strict";
import { formatVenueContext } from "./pipeline/format-venue-context.js";
import type { VenueContext } from "./types.js";

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
