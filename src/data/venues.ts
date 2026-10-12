// Tier A venues: auto-premium whatever else the lead says (classify Step 2.75).
// One list for both readers: the classify prompt prints the names, and
// classify-verify holds a lead that names one but is priced below T3 (Alex 2026-10-03).
export const TIER_A_VENUES: ReadonlyArray<{ name: string; pattern: RegExp }> = [
  { name: "Hotel del Coronado", pattern: /\b(?:hotel )?del coronado\b/i },
  { name: "The Grand Del Mar / Fairmont Grand Del Mar", pattern: /\bgrand del mar\b/i },
  { name: "Lodge at Torrey Pines", pattern: /\blodge at torrey pines\b/i },
  { name: "La Valencia Hotel", pattern: /\bla valencia\b/i },
  { name: "Rancho Valencia", pattern: /\brancho valencia\b/i },
  { name: "L'Auberge Del Mar", pattern: /\bl['’]?\s?auberge\b/i },
  { name: "Estancia La Jolla", pattern: /\bestancia\b/i },
  { name: "The Prado at Balboa Park", pattern: /\bthe prado\b|\bprado at balboa\b/i },
  { name: "San Diego Museum of Art", pattern: /\bsan diego museum of art\b/i },
];

// Tier B venues (classify Step 2.75; plan 2026-10-12, Revisions 5/5b, Alex). Coasterra, Tom Ham's Lighthouse, Marina
// Village and Brick share one rule: 100+ guests is premium; under 100 (or unknown) the lead is held with both prices,
// because "corporate" is the AI's judgment and could flip the price silently. Scripps Seaside Forum and Martin Johnson
// House are premium for any booking. Tom Ham's and Coasterra are waterfront: Alex's "private buyout, 50+" rule may apply.
export type TierBRule = "shared" | "always";
export interface TierBVenue {
  name: string;
  pattern: RegExp;
  rule: TierBRule;
  waterfront: boolean;
  venueNameOnly?: true; // the word is common in prose: never matched in the lead text
}

export const TIER_B_VENUES: ReadonlyArray<TierBVenue> = [
  { name: "Coasterra", pattern: /\bcoasterra\b/i, rule: "shared", waterfront: true },
  { name: "Tom Ham's Lighthouse", pattern: /\btom\s+ham['’]?s?\b/i, rule: "shared", waterfront: true },
  { name: "Marina Village", pattern: /\bmarina village\b/i, rule: "shared", waterfront: false },
  { name: "Brick", pattern: /^\s*brick\b/i, rule: "shared", waterfront: false, venueNameOnly: true },
  { name: "Scripps Seaside Forum", pattern: /\bscripps (?:seaside )?forum\b/i, rule: "always", waterfront: false },
  { name: "Martin Johnson House", pattern: /\bmartin johnson house\b/i, rule: "always", waterfront: false },
];

/** The classify prompt's Tier B line (pinned literally by src/tier-b-hold.test.ts, B1). */
export function tierBPromptLine(): string {
  const names = (r: TierBRule, sep: string) => TIER_B_VENUES.filter((v) => v.rule === r).map((v) => v.name).join(sep);
  return `- Tier B venues (premium only with 100+ guests or a corporate event): ${names("shared", ", ")}. ${names("always", " and ")} are premium for any booking`;
}

/** The lead's Tier B venue: the classified venue name when present, else the lead text (never for Brick). */
export function matchTierB(venueName: string | null | undefined, rawText: string): TierBVenue | null {
  if (venueName && venueName.trim()) return TIER_B_VENUES.find((v) => v.pattern.test(venueName)) ?? null;
  return TIER_B_VENUES.find((v) => !v.venueNameOnly && v.pattern.test(rawText)) ?? null;
}
