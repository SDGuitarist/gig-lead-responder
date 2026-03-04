import type { VenueContext, VenueLookupResponse, VenueLookupResult } from "./types.js";
import { PF_INTEL_TIMEOUT_MS } from "./constants.js";

const PF_INTEL_API_URL = process.env.PF_INTEL_API_URL;
const PF_INTEL_SERVER_API_KEY = process.env.PF_INTEL_SERVER_API_KEY;

// Warn once at startup if env vars are missing (don't crash — graceful degradation)
if (!PF_INTEL_API_URL || !PF_INTEL_SERVER_API_KEY) {
  console.warn("WARNING: PF_INTEL_API_URL or PF_INTEL_SERVER_API_KEY not set — venue context enrichment disabled");
}

/**
 * Look up venue context from PF-Intel. Returns a discriminated result:
 * - hit: venue found, data attached
 * - miss: venue not in PF-Intel (safe to log as miss)
 * - error: network/timeout/auth failure (do NOT log as miss)
 */
export async function lookupVenueContext(venueName: string): Promise<VenueLookupResult> {
  // Skip if env vars not configured
  if (!PF_INTEL_API_URL || !PF_INTEL_SERVER_API_KEY) {
    return { type: "error", reason: "PF-Intel not configured" };
  }

  // Input validation
  if (!venueName || venueName.trim().length === 0) {
    return { type: "error", reason: "invalid input: empty venue name" };
  }
  if (venueName.length > 200) {
    return { type: "error", reason: "invalid input: venue name too long" };
  }
  // Reject control characters (but allow normal unicode like accented letters)
  if (/[\x00-\x1f\x7f]/.test(venueName)) {
    return { type: "error", reason: "invalid input: control characters" };
  }

  const url = `${PF_INTEL_API_URL}/api/v1/lead-context?venue_name=${encodeURIComponent(venueName)}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { "X-API-Key": PF_INTEL_SERVER_API_KEY },
      signal: AbortSignal.timeout(PF_INTEL_TIMEOUT_MS),
    });

    if (!response.ok) {
      const reason = `HTTP ${response.status}`;
      console.warn(`[venue-lookup] PF-Intel returned ${reason} for "${venueName}"`);
      return { type: "error", reason };
    }

    const body = (await response.json()) as VenueLookupResponse;

    if (body.found) {
      return { type: "hit", data: body as VenueContext };
    }
    return { type: "miss", venueName };
  } catch (err: unknown) {
    const reason =
      err instanceof DOMException && err.name === "TimeoutError"
        ? "timeout"
        : err instanceof DOMException && err.name === "AbortError"
          ? "aborted"
          : err instanceof Error
            ? err.message
            : "unknown error";
    console.warn(`[venue-lookup] Error for "${venueName}": ${reason}`);
    return { type: "error", reason };
  }
}
