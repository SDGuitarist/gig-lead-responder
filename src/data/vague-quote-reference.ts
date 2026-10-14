// src/data/vague-quote-reference.ts
// The vague-lead reference: one reply Alex approved for a lead that gave no format, and the order it follows (plan
// docs/plans/2026-10-13-feat-vague-lead-quote-with-question-plan.md, Revision 1b).
//
// Deliberately NOT in VOICE_REFERENCES (that list feeds the verify prompt and every lead's examples) and not the T4
// reference: only buildGeneratePrompt imports this module, for a vague lead whose default format is quoted.
//
// The reply is Alex's own, written for a made-up lead ("my parents' 30th anniversary in the spring"), with: the greeting
// a placeholder first name (his choice (a): the example shows a name; a lead with no name still gets no salutation, see
// the SALUTATION rule), the price replaced by [QUOTED_PRICE], his contact footer dropped, and the payment and COI
// sentences taken from the code constants (they are the sentences the app picks for a lead with no date and no COI
// requirement; the block tells the model the real ones come from the Quote Terms section).

import type { Classification } from "../types.js";
import { COI_SENTENCES } from "../pipeline/coi.js";
import { PAYMENT_SENTENCES } from "../pipeline/payment-terms.js";
import { wrapVoiceReference } from "../utils/sanitize.js";
import { VENUE_HISTORY_HEADER } from "../venue-history.js";

/**
 * Alex's setup sentence, his own fact about his rig. The block lets the model use it word for word (Alex's decision on
 * Codex R1 finding 3, 2026-10-14: "accept your own words"), so the shared-window check cuts it like the Quote Terms.
 */
export const VAGUE_QUOTE_SETUP_SENTENCE = "I bring my own sound and need one outlet and an armless chair, so home, backyard, or restaurant all work.";

export const VAGUE_QUOTE_REFERENCE_REPLY = `Hi Dana,

Picture your parents' 30th: toasts done, the guitar soft enough that one of them reaches for the other's hand without deciding to. You're the one making sure thirty years gets celebrated out loud.

The usual mistake is booking by headcount, then nobody can hear the toasts. For parties like this, most families go with solo Spanish guitar: warm covers and standards that sit under the conversation. Bigger crowd or dancing, I add a second musician. Background while people talk, or a dance floor?

Two hours solo is [QUOTED_PRICE]. ${VAGUE_QUOTE_SETUP_SENTENCE} ${COI_SENTENCES.default} Send me the date once you have it and I'll check my calendar. ${PAYMENT_SENTENCES.noDate}

Alex Guillen`;

const wordCount = (t: string) => t.split(/\s+/).filter(Boolean).length;

/**
 * The `## REFERENCE LEAD: VAGUE REQUEST` section for buildGeneratePrompt. The gate (which leads get it) lives in
 * buildVagueQuoteReferenceSection in src/prompts/generate.ts, next to the T4 gate; this is only the text.
 */
export function buildVagueQuoteReferenceBlock(_classification?: Pick<Classification, "action">): string {
  return `## REFERENCE LEAD: VAGUE REQUEST, DEFAULT FORMAT QUOTED

This lead did not say what format it wants. Below is one reply Alex sent to a lead like it, then the order it follows and the rules for using it. Take the ORDER. Do not take its sentences or its images: re-derive every detail from THIS lead.

${wrapVoiceReference(1, "vague_quote", VAGUE_QUOTE_REFERENCE_REPLY)}

The order, as steps:
1. One cinematic line built from what THIS lead said (the occasion, the time frame, their own doubt), then one sentence that validates what THEY are doing.
2. One named mistake, said plainly: the usual way this kind of booking goes wrong.
3. The default format in a sentence or two (the Recommended format in the classification), and why it fits this kind of occasion. A second musician only for a bigger crowd or dancing.
4. ONE binary question that narrows the musical direction for THIS lead. It is this lead's own question, not the example's.
5. The price as a single number with the duration, the setup needs in one short sentence (you may use the example's own setup sentence word for word: it is Alex's fact about his rig), then the COI and payment sentences exactly as the Quote Terms section gives them.
6. When the lead gave no date, one sentence asking for it, before the payment sentence.

NO INVENTED FACTS: state a time, a number, a date fact or a physical detail of the place only when the lead or a section above gives it to you. The example's scene is invented for that lead; build yours from the occasion, the time frame and the doubt this lead wrote. Add no wind, water, noise or light the lead did not name.

QUOTE TERMS: the payment sentence and the COI sentence come from the Quote Terms section only, and you copy them exactly. The example's two sentences are the DEFAULT ones for a lead with no date and no COI requirement; this lead's may differ. The example's date sentence belongs to a lead with no date: use it only when this lead gave none.

THE QUESTION: exactly one question mark in the draft. It is this lead's own, not the example's, and it chooses between two musical directions; it does not ask about budget, songs or admin details.

ONLY PLAYED SPACES: name a venue's room or area as one Alex knows only when a "## ${VENUE_HISTORY_HEADER}" section above names that venue. Otherwise do not say or imply Alex has played there.

DO NOT REUSE the example's own moves: its toast line, its "headcount" line, its pairing of sound and conversation, or any clause of it. No other sentence of the example may appear in your draft, apart from the Quote Terms sentences above and the one setup sentence.

The price comes from the PRICE LINE section only; [QUOTED_PRICE] in the example is not a price. Make no promise about volume. The example runs ${wordCount(VAGUE_QUOTE_REFERENCE_REPLY)} words; keep the word limits in the drafting steps.`;
}
