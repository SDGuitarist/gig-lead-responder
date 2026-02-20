export interface VenueEntry {
  tier: "A" | "B" | "C";
  stealthPremium: boolean;
  capacity?: number;
  notes?: string;
}

/**
 * Venue lookup map. Keys are lowercase venue names.
 * Source: venue_intel_seed_data_v2.csv
 *
 * Stealth premium triggers (from Rate_Card_Trio_Ensemble.md):
 * - Premium venue (Tier A)
 * - 150+ guests
 * - La Jolla / Rancho Santa Fe / Coronado / Del Mar / Carmel Valley zip
 * - Corporate 100+
 * - Luxury cues (valet, black tie, plated dinner, VIP)
 * - Saturday evening at named venue
 */
export const VENUE_MAP: Record<string, VenueEntry> = {
  // --- Tier A venues ---
  "triton charters": { tier: "A", stealthPremium: true, capacity: 100 },
  "tom ham's lighthouse": { tier: "A", stealthPremium: true, capacity: 250 },
  "rancho bernardo inn": { tier: "A", stealthPremium: true, capacity: 400 },
  "marzul at gaylord pacific": { tier: "A", stealthPremium: true, capacity: 150 },
  "catamaran resort": { tier: "A", stealthPremium: true, capacity: 300 },
  "flagship cruises": { tier: "A", stealthPremium: true, capacity: 600 },
  "hidden chateau": { tier: "A", stealthPremium: true, capacity: 150 },
  "hotel del coronado": { tier: "A", stealthPremium: true, capacity: 500 },
  "fairmont grand del mar": { tier: "A", stealthPremium: true, capacity: 300 },
  "cape rey carlsbad": { tier: "A", stealthPremium: true, capacity: 250 },
  "canopy grove": { tier: "A", stealthPremium: true, capacity: 200 },
  "harmony estate": { tier: "A", stealthPremium: true, capacity: 150 },
  "teri campus of life": { tier: "A", stealthPremium: true, capacity: 200 },
  "carlsbad windmill": { tier: "A", stealthPremium: true, capacity: 200 },
  "hawk ranch": { tier: "A", stealthPremium: true, capacity: 200 },
  "secret garden at rancho santa fe": { tier: "A", stealthPremium: true, capacity: 150 },
  "trust restaurant group": { tier: "A", stealthPremium: false, capacity: undefined },
  "bonita golf course": { tier: "A", stealthPremium: false, capacity: 200 },

  // --- Tier B venues (some still trigger stealth via zip/luxury) ---
  "estancia la jolla": { tier: "B", stealthPremium: true, capacity: 200, notes: "La Jolla zip triggers stealth premium" },
  "bali hai restaurant": { tier: "B", stealthPremium: false, capacity: 200 },
  "grand tradition estate": { tier: "B", stealthPremium: false, capacity: 300 },
  "lomas santa fe country club": { tier: "B", stealthPremium: true, capacity: 230, notes: "Solana Beach" },
  "san diego zoo": { tier: "B", stealthPremium: false, capacity: 250 },
  "westgate hotel": { tier: "B", stealthPremium: true, capacity: 150, notes: "Downtown luxury" },
  "feast and fareway": { tier: "B", stealthPremium: true, capacity: 210, notes: "Coronado zip" },
  "the crossings at carlsbad": { tier: "B", stealthPremium: false, capacity: 220 },

  // --- Tier C venues ---
  "wilson creek winery": { tier: "C", stealthPremium: false, capacity: 200 },
  "paradise point resort": { tier: "C", stealthPremium: false, capacity: 300 },
  "ultimate skybox": { tier: "C", stealthPremium: false, capacity: 180 },
};

/**
 * ZIP codes that trigger stealth premium regardless of venue.
 */
export const STEALTH_PREMIUM_ZIPS = [
  "92037", // La Jolla
  "92067", // Rancho Santa Fe
  "92118", // Coronado
  "92014", // Del Mar
  "92130", // Carmel Valley
];

/**
 * Look up a venue by name (fuzzy: lowercase, partial match).
 */
export function findVenue(venueName: string): VenueEntry | null {
  const normalized = venueName.toLowerCase().trim();
  // Exact match first
  if (VENUE_MAP[normalized]) return VENUE_MAP[normalized];
  // Partial match
  for (const [key, entry] of Object.entries(VENUE_MAP)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return entry;
    }
  }
  return null;
}
