import type { LeadRecord } from "../types.js";

/**
 * Value-add type per follow-up number.
 * Each follow-up adds something NEW — never "just checking in."
 */
const VALUE_ADD_TYPES = [
  "song_suggestion",   // 1st: "I was thinking about your event — here's a song that always works..."
  "testimonial",       // 2nd: "Just finished a similar event — brief testimonial..."
  "urgency",           // 3rd: "Holding your date open but have another inquiry..."
] as const;

/**
 * Build the system prompt for generating a follow-up message.
 *
 * The prompt receives lead context (event type, date, venue, original draft)
 * and the follow-up number to determine tone and value-add type.
 */
export function buildFollowUpPrompt(lead: LeadRecord, followUpNumber: number): string {
  const valueAddType = VALUE_ADD_TYPES[followUpNumber - 1] ?? VALUE_ADD_TYPES[2];

  // Parse classification for event context (if available)
  let eventContext = "";
  if (lead.classification_json) {
    try {
      const c = JSON.parse(lead.classification_json);
      const parts: string[] = [];
      if (c.event_energy) parts.push(`Event energy: ${c.event_energy}`);
      if (c.cultural_context_active) parts.push(`Cultural context: ${c.cultural_tradition || "active"}`);
      if (c.format_recommended) parts.push(`Format: ${c.format_recommended}`);
      if (c.duration_hours) parts.push(`Duration: ${c.duration_hours}hr`);
      if (parts.length > 0) eventContext = parts.join(" | ");
    } catch {
      // classification_json was corrupt — proceed without it
    }
  }

  return `You are Alex Guillen, a live musician in San Diego who runs Pacific Flow Entertainment. You are writing a SHORT follow-up message to a client who received your initial quote but hasn't replied yet.

## HARD CONSTRAINTS
- NEVER say "just checking in," "following up," "wanted to touch base," or any variation. Every follow-up must ADD something new.
- Keep it under 3 sentences. This is an SMS-length message, not an email.
- Write in first person as Alex. Warm, professional, not salesy.
- Do NOT include any contact info, sign-off, or signature.
- Do NOT repeat pricing or quote details from the original response.
- The message should feel like a casual, thoughtful text from a real person.

## LEAD CONTEXT
- Event type: ${lead.event_type || "unknown"}
- Event date: ${lead.event_date || "not specified"}
- Venue: ${lead.venue || "not specified"}
- Client name: ${lead.client_name || "unknown"}
${eventContext ? `- ${eventContext}` : ""}
${lead.compressed_draft ? `\n## ORIGINAL RESPONSE (for context continuity — do NOT repeat it)\n${lead.compressed_draft}` : ""}

## YOUR TASK: Follow-up #${followUpNumber} — ${valueAddType.replace(/_/g, " ")}

${getValueAddInstructions(valueAddType, lead)}

Return ONLY the follow-up message text. No JSON, no labels, no explanation.`;
}

function getValueAddInstructions(
  type: (typeof VALUE_ADD_TYPES)[number],
  lead: LeadRecord,
): string {
  switch (type) {
    case "song_suggestion":
      return `Write a message that shares a specific song or musical moment relevant to their ${lead.event_type || "event"}. Example tone: "I was putting together a setlist for a similar event and thought of [song] — it always gets [specific reaction]. Would be perfect for your ${lead.event_type || "event"}."`;

    case "testimonial":
      return `Write a message that briefly mentions a recent similar event you played. Example tone: "Just wrapped up a ${lead.event_type || "similar event"} last weekend — [one vivid detail about the moment]. Made me think of your upcoming event."`;

    case "urgency":
      return `Write a message that gently notes availability. Example tone: "Wanted to make sure you saw my message. I'm holding ${lead.event_date || "your date"} open but have another inquiry coming in for that weekend."`;
  }
}
