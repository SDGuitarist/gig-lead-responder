import type { VenueContext } from "../types.js";
import { VENUE_CONTEXT_HEADER } from "../constants.js";

/**
 * Format PF-Intel venue context as a markdown section for Stage 4 LLM consumption.
 * Pure function — no side effects, independently testable.
 *
 * Rules:
 * - Omit sections with all-null data
 * - Include updated_at from vendor_policies as freshness signal
 * - No phone/email (enforced at API level)
 * - Past events and contacts are fetched but NEVER rendered, populated or not (plan 2026-10-11, PF-Intel facts are
 *   not Alex's experience): "N past events" invites "I've played here" and a name invites name-dropping. Venue
 *   experience comes only from Alex's private venue file (src/venue-history.ts), which needs his yes.
 */
/**
 * How the drafter may use the section (plan 2026-10-11, D1; pinned byte for byte by src/pf-intel-context.test.ts).
 * Inside the section, before its closing "---", so it can never be read as applying to a later section.
 */
export const PF_INTEL_USAGE = "These are public facts about the venue from PF-Intel, not Alex's experience. Use a policy only to answer a logistics concern before the client asks, stated as a fact about the venue or as Alex's plan (for example: \"The venue's outdoor curfew is 10 PM, so I'll plan the last set to finish by 9:45.\"). Never say or imply that Alex knows, has played, has been to, or is familiar with this venue, its rooms, its staff or its load-in. Only Alex's own venue-history section, when one appears further down, allows that.";

export function formatVenueContext(venue: VenueContext): string {
  const sections: string[] = [];

  sections.push(`## ${VENUE_CONTEXT_HEADER}: ${venue.venue_name}`);

  // Vendor Policies
  const vp = venue.vendor_policies;
  if (vp) {
    const lines: string[] = [];
    if (vp.curfew_time) lines.push(`- **Outdoor curfew:** ${vp.curfew_time}`);
    if (vp.curfew_notes) lines.push(`  ${vp.curfew_notes}`);
    if (vp.db_limit_value != null) lines.push(`- **dB limit:** ${vp.db_limit_value} dB`);
    if (vp.db_limit_notes) lines.push(`  ${vp.db_limit_notes}`);
    if (vp.av_exclusivity) lines.push(`- **AV exclusivity:** ${vp.av_exclusivity}`);
    if (vp.coi_required != null) {
      lines.push(`- **COI required:** ${vp.coi_required ? "Yes" : "No"}`);
      if (vp.coi_details) lines.push(`  ${vp.coi_details}`);
    }
    if (vp.setup_notes) lines.push(`- **Setup notes:** ${vp.setup_notes}`);

    if (lines.length > 0) {
      const header = vp.updated_at
        ? `### Vendor Policies (last updated: ${vp.updated_at.split("T")[0]})`
        : "### Vendor Policies";
      sections.push(header);
      sections.push(lines.join("\n"));
    }
  }

  // Only the header exists — no actionable intelligence
  if (sections.length <= 1) {
    return "";
  }

  sections.push(`**How to use this:** ${PF_INTEL_USAGE}`);
  return "---\n\n" + sections.join("\n\n") + "\n\n---";
}
