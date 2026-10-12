// src/data/t4-reference.ts
// The T4 (luxury corporate) reference lead: one reply Alex sent, anonymized, and the order it follows
// (port manifest R020-R025; plan docs/plans/2026-10-11-feat-t4-reference-lead-plan.md, Revision 1b).
//
// Deliberately NOT in VOICE_REFERENCES: that list feeds the verify prompt and every lead's examples. This
// example is for T4 leads only, and only buildGeneratePrompt imports this module (T6 checks it).
//
// The reply is Alex's approved text with: the client's first name changed to "Dana", the price replaced by
// [QUOTED_PRICE], the deposit amount removed, the business name and phone removed. Its payment sentence is the one
// the app picks for an event 14 days or fewer away (src/pipeline/payment-terms.ts); the block tells the model
// the real sentence comes from the Quote Terms section, never from this example.

import type { Classification } from "../types.js";
import { wrapVoiceReference } from "../utils/sanitize.js";
import { VENUE_HISTORY_HEADER } from "../venue-history.js";

export const T4_REFERENCE_REPLY = `Hi Dana,

I'm available Thursday, October 8. Sunset is about 6:25, so 5 to 7 on the Del's beach catches the last daylight and the fire taking over, with guitar underneath.

Putting a bonfire inside a three-day program is a smart call. It's the hour people put the agenda down and talk to each other.

Surf and wind swallow a guitar, so I set levels from where your guests sit, present but under conversation. How many people are you expecting around the fire? That tells me how to size the sound.

Solo guitar, two hours: [QUOTED_PRICE], sound system included. Spanish guitar, bossa nova, familiar songs. My only electrical need is one standard 110V outlet within 25 feet, plus an armless chair. I can send the Del a COI.

Full payment holds the date. Want me to lock it in?

Alex Guillen`;

/** The two opening orders. The urgent band answers the date before anything else (R025, deviation 2). */
const OPENING_URGENT = "OPENING: availability first, then the cinematic line.";
const OPENING_OTHER = "OPENING: cinematic line first, then availability.";

/**
 * The `## REFERENCE LEAD: T4 CORPORATE` section for buildGeneratePrompt, or "" for any lead that is not T4.
 * The seven steps are R021; the bracketed fill-in template (R022) is deliberately not shipped: a model given
 * `[One verified fact about their time and place]` fills it with an invented one.
 */
export function buildT4ReferenceBlock(classification: Pick<Classification, "rate_card_tier" | "timeline_band">): string {
  if (classification.rate_card_tier !== "T4") return "";
  const opening = classification.timeline_band === "urgent" ? OPENING_URGENT : OPENING_OTHER;
  return `## REFERENCE LEAD: T4 CORPORATE

This lead is luxury corporate. Below is one reply Alex sent to a lead like it, then the order it follows and the rules for using it. Take the ORDER. Do not take its sentences or its images: re-derive every detail from THIS lead.

${wrapVoiceReference(1, "t4_corporate", T4_REFERENCE_REPLY)}

${opening}

The order, as steps:
1. Availability: the date, answered plainly (see OPENING for where it goes).
2. One verifiable local fact tied to THEIR exact window. This is the wedge.
3. Validate the decision THEY made, then one line on what that moment does for their people.
4. One physical problem of this setting, only when the lead's own details give one (a beach, a terrace, a patio, a long room). If the lead gives none, leave the problem out; say what Alex does about it in your own words.
5. One question, framed as logistics and not as price.
6. The price as a single number with the duration, then the genre default, the setup needs and the COI in one short paragraph.
7. The payment sentence and one direct close.

NO INVENTED FACTS: state a time, a number, a date fact or a physical detail of the place only when the lead or a section above gives it to you. The example's sunset time was looked up for that lead; you cannot look anything up. With no given fact, build the wedge from the lead's own window and setting. Do not add wind, water, noise, light or any condition the lead did not name. Use only the times the lead states. Put no clock time of your own on a moment inside their window (no "by 5:15", no "around 6:30"): say "as the evening opens" or "once guests arrive" instead.

ONLY PLAYED SPACES: name a venue's room or area as one Alex knows only when a "## ${VENUE_HISTORY_HEADER}" section above names that venue. Otherwise do not say or imply Alex has played there. Even when a section names the venue, say only what that section says; never add that Alex knows its spaces, rooms or acoustics.

PAYMENT: the sentence comes from the Quote Terms section only. The example's payment sentence belongs to that lead's date; do not copy it.

DO NOT REUSE the example's own moves: its sunset line, its "agenda" line, its surf-and-wind line, its way of setting sound levels, its list of genres (the genre default comes from the voice rules, not from the example), or any clause of it. A draft that shares a clause with the example is wrong even when the idea fits.

The price comes from the PRICE LINE section only; [QUOTED_PRICE] in the example is not a price. Never mention battery-powered sound. The example runs 141 words; keep the word limits in the drafting steps.

No sentence of the example may appear in your draft. The example describes one lead's venue; it is not evidence about any other venue.`;
}
