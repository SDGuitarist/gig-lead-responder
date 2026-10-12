import { test } from "node:test";
import assert from "node:assert/strict";
import { buildClassifyPrompt } from "./prompts/classify.js";
import { matchTierB } from "./data/venues.js";

// Plan docs/plans/2026-10-12-fix-tier-b-venue-rule-conflict-hold-plan.md (Revisions 1-3; Alex's rules 2026-10-12).
// The app decides Tier B from plain facts and holds with both rate-card prices when a rule is undecidable or rules
// disagree. Made-up leads only; no model.

const TIER_B_LINE = "- Tier B venues (premium only with their own signal): Coasterra (100+ guests, corporate, or any Saturday), Tom Ham's Lighthouse (100+ guests and starting 5 PM or later), Marina Village (corporate or 75+), Brick (rule not defined yet: Alex reviews). Scripps Seaside Forum and Martin Johnson House are premium for any booking";
const OLD_LINE = "- Tier B venues (premium only with another signal: 100+ guests, corporate, Saturday evening)";

test("B1: the classify prompt carries Alex's Tier B rules exactly once, and not the old line", () => {
  const p = buildClassifyPrompt("2026-10-12");
  assert.equal(p.split(TIER_B_LINE).length - 1, 1);
  assert.ok(!p.includes(OLD_LINE));
});

test("B8: venue names and aliases match their Tier B entry; near-misses do not", () => {
  const cases: Array<[string, string | null]> = [
    ["Tom Hams Lighthouse", "Tom Ham's Lighthouse"], ["Tom Ham's", "Tom Ham's Lighthouse"],
    ["Tom Ham’s", "Tom Ham's Lighthouse"], ["TOM HAM'S LIGHTHOUSE", "Tom Ham's Lighthouse"],
    ["Coasterra", "Coasterra"], ["Scripps Forum", "Scripps Seaside Forum"], ["Scripps Seaside Forum", "Scripps Seaside Forum"],
    ["Marina Village", "Marina Village"], ["Martin Johnson House", "Martin Johnson House"], ["Brick", "Brick"],
    ["Tom Hanks", null], ["Scripps Ranch", null], ["Coaster", null], ["Example Harbor Grill", null],
  ];
  for (const [venue, want] of cases) assert.equal(matchTierB(venue, "")?.name ?? null, want, venue);
});

test("B8/B9: venue_name wins when present; the lead text is read only when venue_name is null, and never for Brick", () => {
  assert.equal(matchTierB("Example Harbor Grill", "we considered Tom Ham's but chose the Grill"), null);
  assert.equal(matchTierB(null, "dinner at Tom Hams Lighthouse for 50")?.name, "Tom Ham's Lighthouse");
  assert.equal(matchTierB(null, "a brick patio at our home"), null);
  assert.equal(matchTierB(null, "Brick walls and a garden: our backyard party for 30"), null, "Brick is never read from the lead text");
  assert.equal(matchTierB("Example Harbor Grill", "the brick courtyard"), null);
});
