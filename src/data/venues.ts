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

// Tier B venues: premium only with their own signal (classify Step 2.75). Alex's rules, 2026-10-12, after reading his
// source file: the 10-03 port had given Tom Ham's Coasterra's rule. Coasterra: 100+ guests or corporate only (Alex
// dropped Saturday, which would have made every Saturday lunch there premium). One list for both readers: the classify prompt
// prints it, and tierBHold (pipeline/price.ts) decides from plain facts and holds when a rule cannot be settled.
export type TierBRule = "coasterra" | "tom_hams" | "marina_village" | "always" | "undefined";
export interface TierBVenue {
  name: string;
  pattern: RegExp;
  rule: TierBRule;
  promptRule: string; // what the classify prompt says; "" for the always-premium venues (printed together)
  waterfront: boolean; // R097 "waterfront restaurant, private buyout, 50+" can also reach it
  venueNameOnly?: true; // the word is common in prose: never matched in the lead text
}

export const TIER_B_VENUES: ReadonlyArray<TierBVenue> = [
  { name: "Coasterra", pattern: /\bcoasterra\b/i, rule: "coasterra", promptRule: "100+ guests or corporate", waterfront: true },
  { name: "Tom Ham's Lighthouse", pattern: /\btom\s+ham['’]?s?\b/i, rule: "tom_hams", promptRule: "100+ guests and starting 5 PM or later", waterfront: true },
  { name: "Marina Village", pattern: /\bmarina village\b/i, rule: "marina_village", promptRule: "corporate or 75+", waterfront: false },
  { name: "Brick", pattern: /^\s*brick\b/i, rule: "undefined", promptRule: "rule not defined yet: Alex reviews", waterfront: false, venueNameOnly: true },
  { name: "Scripps Seaside Forum", pattern: /\bscripps (?:seaside )?forum\b/i, rule: "always", promptRule: "", waterfront: false },
  { name: "Martin Johnson House", pattern: /\bmartin johnson house\b/i, rule: "always", promptRule: "", waterfront: false },
];

/** The classify prompt's Tier B line (pinned literally by src/tier-b-hold.test.ts, B1). */
export function tierBPromptLine(): string {
  const ruled = TIER_B_VENUES.filter((v) => v.rule !== "always").map((v) => `${v.name} (${v.promptRule})`).join(", ");
  const always = TIER_B_VENUES.filter((v) => v.rule === "always").map((v) => v.name).join(" and ");
  return `- Tier B venues (premium only with their own signal): ${ruled}. ${always} are premium for any booking`;
}

/** The lead's Tier B venue: the classified venue name when present, else the lead text (never for Brick). */
export function matchTierB(venueName: string | null | undefined, rawText: string): TierBVenue | null {
  if (venueName && venueName.trim()) return TIER_B_VENUES.find((v) => v.pattern.test(venueName)) ?? null;
  return TIER_B_VENUES.find((v) => !v.venueNameOnly && v.pattern.test(rawText)) ?? null;
}
