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
 */
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

  // Key Contacts
  if (venue.contacts && venue.contacts.length > 0) {
    sections.push("### Key Contacts");
    const contactLines = venue.contacts.map((c) =>
      c.role ? `- **${c.name}** — ${c.role}` : `- **${c.name}**`,
    );
    sections.push(contactLines.join("\n"));
  }

  // Performance History
  if (venue.event_count > 0) {
    const recentDate = venue.recent_events?.[0]?.date;
    const detail = recentDate
      ? `${venue.event_count} past events (most recent: ${recentDate})`
      : `${venue.event_count} past events`;
    sections.push("### Performance History");
    sections.push(`- ${detail}`);
  }

  // Only the header exists — no actionable intelligence
  if (sections.length <= 1) {
    return "";
  }

  return "---\n\n" + sections.join("\n\n") + "\n\n---";
}
