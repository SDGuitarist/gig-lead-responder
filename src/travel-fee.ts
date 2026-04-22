import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { TravelFeeResult, TravelFeeData, TravelBand } from "./types.js";

// Load zip_distances.json once at module init.
// Path resolution: src/travel-fee.ts → ../data/zip_distances.json
const __dirname = dirname(fileURLToPath(import.meta.url));
const ZIP_DATA_PATH = join(__dirname, "..", "data", "zip_distances.json");

type ZipEntry = { miles: number; band: TravelBand };
type ZipData = Record<string, ZipEntry>;

let zipData: ZipData = {};
try {
  const raw = readFileSync(ZIP_DATA_PATH, "utf-8");
  zipData = JSON.parse(raw) as ZipData;
  console.log(`[travel-fee] Loaded ${Object.keys(zipData).length} ZIP entries`);
} catch (err: unknown) {
  const msg = err instanceof Error ? err.message : "unknown";
  console.error(`[travel-fee] FATAL: Failed to load zip_distances.json: ${msg}`);
  // zipData stays empty — all lookups will return "miss"
}

// Fee matrix matches TRAVEL_FEES.md exactly.
// Tuple order: [solo, duo_client_facing, trio_starting, quartet_plus_starting]
const FEE_MATRIX: Record<TravelBand, [number, number, number, number]> = {
  "Local":     [0,   0,    0,    0],
  "Near":      [150, 275,  400,  550],
  "Regional":  [300, 500,  700,  950],
  "Far":       [500, 800,  1100, 1400],
  "Very Far":  [750, 1150, 1500, 2000],
  "Overnight": [0,   0,    0,    0], // placeholder — custom quote required
};

// Duo musician stipend (fair split version) — paid off the top before 60/40.
const DUO_MUSICIAN_STIPEND: Record<TravelBand, number> = {
  "Local":     0,
  "Near":      50,
  "Regional":  100,
  "Far":       150,
  "Very Far":  200,
  "Overnight": 0, // custom
};

/**
 * Extract a 5-digit US ZIP from an address string.
 * Returns null if no valid ZIP found.
 */
export function extractZipFromAddress(address: string): string | null {
  if (!address || typeof address !== "string") return null;
  const match = address.match(/\b(\d{5})(?:-\d{4})?\b/);
  return match ? match[1] : null;
}

/**
 * Look up travel fee data for a US ZIP.
 * Returns a discriminated result:
 * - hit:   ZIP found in lookup, full fee data attached
 * - miss:  ZIP not in lookup (route to manual review, do NOT guess)
 * - error: invalid input or data load failure
 */
export function lookupTravelFee(zip: string): TravelFeeResult {
  if (!zip || typeof zip !== "string") {
    return { type: "error", reason: "invalid input: empty or non-string zip" };
  }

  const cleaned = zip.trim();
  if (!/^\d{5}$/.test(cleaned)) {
    return { type: "error", reason: "invalid input: not a 5-digit ZIP" };
  }

  const entry = zipData[cleaned];
  if (!entry) {
    return { type: "miss", zip: cleaned };
  }

  const fees = FEE_MATRIX[entry.band];
  const data: TravelFeeData = {
    zip: cleaned,
    miles: entry.miles,
    band: entry.band,
    solo_fee: fees[0],
    duo_fee: fees[1],
    duo_musician_stipend: DUO_MUSICIAN_STIPEND[entry.band],
    trio_starting: fees[2],
    quartet_starting: fees[3],
    custom_quote_required: entry.band === "Overnight",
  };

  return { type: "hit", data };
}

/**
 * Check if a booking requires overnight accommodation based on the 9-hour rule.
 * Call this after lookupTravelFee when band = "Very Far" and gig duration is known.
 *
 * Rule: (round-trip drive time) + (gig duration incl. setup/breakdown) > 9 hours.
 * Drive time estimated at ~55 mph average highway speed.
 *
 * Note: band = "Overnight" (>200 mi) always requires overnight — this function
 * is only needed for Very Far (141–200 mi) to check the day-hours rule.
 */
export function checkOvernightRequired(miles: number, gigHours: number): boolean {
  if (miles > 200) return true;
  const roundTripHours = (miles * 2) / 55;
  return (roundTripHours + gigHours) > 9;
}
