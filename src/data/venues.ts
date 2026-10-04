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
