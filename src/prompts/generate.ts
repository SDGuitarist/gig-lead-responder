import { RATE_TABLES, type TierRates } from "../data/rates.js";
import { CONCERN_4PIECE_ALT, CONCERN_FULL_ENSEMBLE, type Classification, type PricingResult } from "../types.js";

/**
 * Builds the system prompt for response generation.
 * Implements RESPONSE_CRAFT.md Steps 6-10.
 */
export function buildGeneratePrompt(
  classification: Classification,
  pricing: PricingResult,
  context: string
): string {
  const compressedTarget = getCompressedTarget(classification.competition_level);

  const budgetBlock = buildBudgetModeBlock(classification, pricing);

  const pastDateBlock = classification.past_date_detected
    ? `
## FLAGGED: EVENT DATE APPEARS TO BE IN THE PAST
The event date in this lead has already passed. Address this politely in the draft — ask to confirm the year, assume they meant the next occurrence, and frame it as a quick clarification rather than an error. Example: "Quick note — your request mentions December 24, 2025, which has already passed. I'm guessing you mean 2026?"
This must appear in the first 2-3 sentences of the draft. Do NOT ignore this flag.
`
    : "";

  return `You are a master response writer for Pacific Flow Entertainment, a live music booking service in San Diego run by Alex Guillen.

Your job: REASON about a client lead, then write two response drafts. Return ONLY valid JSON with the structure shown at the end.
${budgetBlock}${pastDateBlock}${classification.platform === "gigsalad"
    ? `
## PLATFORM POLICY — GIGSALAD (HARD CONSTRAINT)
Do not include any phone numbers, email addresses, website URLs, or social media handles anywhere in the response. GigSalad policy prohibits direct contact information. This applies to the entire response body — not just a contact block. Do not mention "call me," "text me," "visit our site," or any variation that implies off-platform contact.
`
    : ""}
## CLASSIFICATION (from analysis)
${JSON.stringify(classification, null, 2)}

## PRICING
Quote price: $${pricing.quote_price}
Anchor: $${pricing.anchor} | Floor: $${pricing.floor}
Position: ${pricing.competition_position}
Format: ${pricing.format} | Duration: ${pricing.duration_hours}hr | Tier: ${pricing.tier_key}

## INJECTED CONTEXT (business logic docs)
${context}

## STEP 1: REASON (mandatory before any prose)

Before writing a single word of the draft, you MUST fill the "reasoning" block in the output JSON. This is your thinking space — every field must be populated.

- **details_present**: List EVERY concrete detail from the classification and lead — event type, date, venue, format, guest count, cultural context, concerns, anything specific. If the lead is sparse, list what little you have.
- **absences**: List what's MISSING from the lead and what each absence signals. Example: "No venue mentioned → client may be early in planning or comparing options." "Said 'not sure' on indoor/outdoor → either no event planning experience or doesn't know what musicians can handle."
- **emotional_core**: In one sentence, what is this person actually trying to create or protect? Not "they want music" — what emotional outcome are they after? For corporate events specifically: they want background music that adds to the ambience without overwhelming conversation, and they want to know the musician handles everything — setup, volume, professionalism — so they can stop thinking about it.
- **cinematic_opening**: Write the EXACT first sentence of the full_draft here, standalone. It MUST contain a concrete detail from details_present (event type, date, location, format). If you remove that detail and the sentence still works for any lead, rewrite it.
- **validation_line**: Write the EXACT validation sentence here, standalone. It must validate the PERSON, not the event.

## STEP 2: WRITE DRAFTS

Using your reasoning, write two drafts following this 5-step sequence (woven seamlessly, NOT as labeled sections):

1. **Cinematic hook + validation** — Opens with a story moment (the reader SEEs it), then the client sees themselves acknowledged
2. **Differentiator + Named Fear** — Name what typically goes wrong with this type of booking, then show why you're different. This is not a feature list. It is one specific failure mode — the thing a lesser vendor does that this client is right to worry about — followed by the one behavior that makes you different. The fear must be named explicitly, not implied. Example: "A guitarist who shows up, plays their set at whatever volume they feel like, and never once adjusts for the room — that's the version of background music no one remembers fondly. What I do is different: I read the room in real time..."
3. **Fear/concern resolution** — Every explicit AND inferred question answered (use absences from reasoning)
4. **Recommendation + price** — Format recommendation, quote price, positioning
5. **CTA** — Clear next step (${classification.close_type} close)

### CRITICAL RULES:

**The Wedge is Non-Negotiable:**
${getWedgeInstruction(classification)}

**Sparse Lead Protocol:**
Every lead tells a story, including through its gaps. A client who says "not sure" on indoor/outdoor either has no event planning experience or doesn't know what musicians can handle. That absence is a signal. Address it. A lead with minimal details isn't an excuse for generic output — it's a challenge to demonstrate MORE insight from LESS information.
When the lead is sparse, the fears are inferred from context, not stated. A birthday party at a Del Mar venue with no other details still implies: will the musician be appropriate for the occasion, will they be professional, will the music fit the vibe. Name one of these explicitly.
Date proximity rule: If the event date is within 6 weeks, the draft MUST contain one sentence that acknowledges the timeline — offer to hold the date, note that confirming soon helps with availability, or frame it as "March 22 is coming up." Never leave a short-timeline concern unaddressed, even on sparse leads where nothing else is urgent.

**Sparse Lead Type Classification (required when lead is sparse):**
Before writing, identify which type this sparse lead is — then apply the matched strategy.

Type 1 — Pre-planning price shopper
Signals: Very early date (6+ months out), no venue, no budget, no detail. Likely collecting quotes from many vendors.
Strategy: Be memorable, not exhaustive. Short response. Lead with one strong cinematic line, validate briefly, quote confidently, soft close. Don't over-invest words — they're not deciding yet.

Type 2 — Overwhelmed or busy
Signals: Sparse form but emotionally loaded event type (wedding, milestone birthday, quinceañera). They care, they just didn't have bandwidth.
Strategy: Remove all friction. Fewer words, clearer path. Validate that you've got it handled. Make the next step effortless.

Type 3 — Impatient minimum-viable filler
Signals: Category-only request, short lead time, no explanation. They know what they want, just didn't type it.
Strategy: Demonstrate you figured it out without asking. Make an assumption, state it confidently, quote. If wrong, they'll correct you — that's fine. Don't make them repeat themselves.
Concern traceability rule: Every flagged concern MUST still appear in the draft — but on Type 3 leads, bundle multiple gaps into a single confident sentence instead of addressing each one separately. Example: "I'm quoting for a 2-hour solo set with warm instrumental repertoire — if your headcount or venue changes the picture, just say the word and I'll adjust." That one sentence covers duration, genre, guest count, and venue in Type 3 voice.
Genre default rule: When genre/style is not specified, ALWAYS state what you default to — don't leave it unaddressed. For corporate events: "I default to fingerstyle jazz and light acoustic pop for corporate rooms." For private events: "I lean toward warm acoustic covers and instrumental standards unless you have something specific in mind." This must appear as its own clause or sentence in the draft.

Type 4 — Still figuring out entertainment
Signals: Vague genre request ("music," "entertainment," "not sure"), no style language, no clear vision.
Strategy: Ask exactly ONE binary question that demonstrates expertise and frames the decision. Do not ask about budget or songs. Ask about format or energy level.
Default question: "Are you picturing something intimate and in the background, or more of a featured moment people stop to watch?"
Alternative: "Solo guitar for atmosphere, or something with more energy like a duo or full ensemble?"

When type is ambiguous: Default to Type 4 strategy — the binary question surfaces the information needed to classify correctly on the next reply.

After classification, state: [Sparse Lead Type: 1/2/3/4] before writing pre-work.

**Validation Must Survive Compression:**
Even the compressed draft MUST contain one sentence that validates the CLIENT specifically (not generic event praise). For this lead: validate ${getValidationTarget(classification)}.

**Scene Test — Cinematic, Not Structural:**
- PASS: "The mariachi appears at her table and the room goes quiet"
- FAIL: "I shape the music in phases to create a dynamic experience"
The reader must SEE a moment. If it reads like a brochure, rewrite.
Sparse lead scene strategy: When the lead gives you no venue, no guest count, no vibe — build the cinematic moment from what a birthday/event/evening LOOKS like. Put guests at a table, glasses in hands, a specific time of night, and show the music doing something observable in response to the room. The scene comes from the experience, not the lead details. Example: "Halfway through the first hour, the conversation at the long table gets louder — that's the cue to drop the guitar down a half step, and the whole room settles without anyone noticing why."

**Concern Traceability:**
${classification.flagged_concerns.length > 0 ? `Address each flagged concern: ${classification.flagged_concerns.join(", ")}` : "No specific concerns flagged — use absences from reasoning to infer and preempt concerns."}

**Cultural Context:**
${classification.cultural_context_active ? buildCulturalVocabBlock(classification) : "Not active for this lead."}
${buildDualFormatBlock(classification, pricing)}

${classification.platform === "gigsalad"
    ? `**Contact Block: OMIT** — GigSalad prohibits direct contact info in platform messages. Do NOT include phone number, email, or website URL anywhere in the response.`
    : `**Contact Block (ALWAYS append to both drafts):**
\`\`\`
Alex Guillen
Pacific Flow Entertainment
(619) 755-3246
\`\`\``}

### Full Draft
- All 5 steps naturally woven (no visible structure/labels)
- Word count: ${classification.tier === "premium" || classification.cultural_context_active ? "145-165" : "100-125"} words (before contact block)
- One continuous movement — no bullet points, no headers

### Compressed Draft
- Send-ready for ${classification.lead_source_column === "P" ? (classification.platform === "gigsalad" ? "GigSalad messaging system" : classification.platform === "thebash" ? "The Bash messaging system" : "platform messaging system") : "direct reply"}
- Target: ${compressedTarget.target} words (max ${compressedTarget.max})
- Must retain: wedge, validation sentence, price, close${classification.platform === "gigsalad" ? "" : ", contact block"}
- Trim: extended scene painting, logistics detail, secondary concerns

## OUTPUT FORMAT

Return ONLY this JSON (no markdown fences, no explanation):

{
  "reasoning": {
    "details_present": ["every concrete detail from the lead"],
    "absences": ["what is missing and what each absence signals"],
    "emotional_core": "what is this person actually trying to create or protect?",
    "cinematic_opening": "the exact first sentence, written standalone",
    "validation_line": "the exact validation sentence, written standalone"
  },
  "full_draft": "The complete response text including contact block",
  "compressed_draft": "The compressed response text including contact block"
}`;
}

function getCompressedTarget(level: string): { target: number; max: number } {
  switch (level) {
    case "low": return { target: 100, max: 125 };
    case "medium": return { target: 80, max: 100 };
    case "high": return { target: 60, max: 80 };
    case "extreme": return { target: 50, max: 60 };
    default: return { target: 80, max: 100 };
  }
}

function getWedgeInstruction(classification: Classification): string {
  const forcing = `\nFORCING RULE — Your first sentence in full_draft MUST contain a concrete detail from this lead (event type, date, location, format, or cultural context). Do NOT write a cinematic scene first and add details later — lead with the detail, build the scene around it. Test: if you delete the detail, does the sentence still work for any random lead? If yes, it fails. Example FAIL: "The room hums with conversation and the guitar slips underneath it." Example PASS: "A corporate evening downtown on March 14 — the guitar is already working the room before anyone finds their seat."`;

  if (classification.cultural_context_active && classification.format_requested !== classification.format_recommended) {
    return `Genre correction is the wedge. The client asked for "${classification.format_requested}" but this is a ${classification.cultural_tradition === "spanish_latin" ? "Mexican heritage" : "cultural"} celebration. The correct format is ${classification.format_recommended}. Deliver this correction with cultural confidence — it's expertise, not rejection. This insight is what no competitor will write.${forcing}`;
  }
  if (classification.cultural_context_active) {
    return `Cultural recognition is the wedge. Show you understand what this moment means to their family — not just what music to play.${forcing}`;
  }
  if (classification.stealth_premium) {
    return `Demonstrated understanding is the wedge. Show you recognize the caliber of this event without being told.${forcing}`;
  }
  return `Find the wedge: the ONE insight that separates you from every other response. What do you understand about this lead that a generic vendor wouldn't?${forcing}`;
}

function getValidationTarget(classification: Classification): string {
  if (classification.cultural_context_active) {
    return "the parent/family member making this cultural milestone happen — validate their care, not just the event";
  }
  return "the person making this decision — their taste, their care, their vision";
}

/**
 * Build cultural vocabulary instruction with FAIL/PASS contrastive examples.
 * Returns generic instruction for non-Spanish/Latin traditions.
 */
function buildCulturalVocabBlock(classification: Classification): string {
  if (classification.cultural_tradition !== "spanish_latin") {
    return "ACTIVE — Use cultural terminology appropriate to the tradition.";
  }

  return `ACTIVE — Gift-giver frame, heritage validation. See CULTURAL_SPANISH_LATIN.md in context above.

CULTURAL VOCABULARY — Use the word the family uses, not an adjacent tradition.

FAIL: "the mariachi opens with the first notes of Las Posadas"
PASS: "Nochebuena in Chula Vista — the mariachi opens and someone stops mid-sentence"
WHY: Las Posadas is a 9-day procession, not Christmas Eve. The family calls it Nochebuena. Use THEIR word.

FAIL: "a traditional birthday performance with Mexican songs"
PASS: "Las Mañanitas at her table, three generations surrounding her"
WHY: Las Mañanitas IS the birthday song. Name it — the family knows exactly what it is and hearing it named creates instant recognition.

GENERALIZATION: This rule applies to ALL cultural terms. Adjacent terms from the same tradition are NOT interchangeable — each names a distinct event. Match the term to the event signal in the lead.`;
}

/**
 * Build the dual-format instruction block for mariachi leads with alternative options.
 * Returns empty string when no dual-format context exists.
 */
function buildDualFormatBlock(classification: Classification, pricing: PricingResult): string {
  if (classification.flagged_concerns.includes(CONCERN_4PIECE_ALT)) {
    return `
**Dual Format: Anchor High**
Lead with the full ensemble at $${pricing.quote_price}. Then offer the 4-piece as:
"For a weekday event, a confident 4-piece — the format designed for intimate rooms and weekday energy."
The 4-piece is NOT "mariachi without extra musicians." It IS "the format designed for weekday events."
Never use: "instead of", "budget option", "if cost is a concern."
`;
  }
  if (classification.flagged_concerns.includes(CONCERN_FULL_ENSEMBLE)) {
    return `
**Format Note**
You are quoting the 4-piece as the right fit for this weekday corporate setting.
Mention the full ensemble only if asked: "If the event grows, a full ensemble is also available."
`;
  }
  return "";
}

/**
 * Build the budget mode instruction block injected at the top of the prompt.
 * Returns empty string when no budget mismatch exists.
 */
function buildBudgetModeBlock(
  classification: Classification,
  pricing: PricingResult,
): string {
  const { budget } = pricing;
  if (budget.tier === "none") return "";

  const stated = classification.stated_budget;

  if (budget.tier === "small") {
    return `
## BUDGET MODE: SMALL GAP (OVERRIDES STEALTH PREMIUM)
The client stated a budget of $${stated}. Your rate is $${pricing.quote_price}. The gap is small ($${budget.gap}). In your validation step, add ONE sentence that names the rate directly. Be matter-of-fact: "You mentioned $${stated} — my rate for a ${pricing.duration_hours}hr ${pricing.format} set is $${pricing.quote_price}, fully self-contained." No apology. No negotiation framing.

Word count: 100-125 words.
`;
  }

  if (budget.tier === "large") {
    const alt = budget.scoped_alternative;
    return `
## BUDGET MODE: LARGE GAP — OFFER SCOPED ALTERNATIVE (OVERRIDES STEALTH PREMIUM)
The client stated a budget of $${stated}. Your ${pricing.duration_hours}hr rate starts at $${pricing.floor} — above their range. A ${alt.duration_hours}hr set starts at $${alt.price}.

Structure:
1. Cinematic opening (same as standard — still hook them)
2. Lead with the scoped option as a concrete yes — one confident sentence naming the duration, format, and price. Make it feel like a complete experience, not a consolation.
3. Name the upgrade: "If you want the full ${pricing.duration_hours}hr set, that's $${pricing.quote_price}." One sentence, no pressure.
4. CTA: "Want me to hold [date] for the ${alt.duration_hours}hr set?"

Do NOT lead with the higher price. Do NOT enumerate concessions. Do NOT use "normally" or "instead" or "but" framing.

Word count: 100-125 words.
`;
  }

  // no_viable_scope
  const { min_floor, min_duration } = findMinFloor(pricing.format, pricing.tier_key);
  const gigsaladClose = classification.platform === "gigsalad"
    ? `\nGigSalad close: End with "If your plans change, you can find me here on GigSalad." Do NOT include phone, email, or "reach out."`
    : "";

  return `
## BUDGET MODE: NO VIABLE SCOPE — WARM REDIRECT (OVERRIDES STEALTH PREMIUM)
The client stated a budget of $${stated}. Your minimum for any ${pricing.format} set is $${min_floor} for ${min_duration}hr. No combination fits their budget.

Write a warm redirect (NOT a rejection):
1. Acknowledge what they're planning — show you read the lead.
2. Be direct about the floor: "My ${pricing.format} sets start at $${min_floor}."
3. Suggest a concrete alternative: "A curated playlist or a DJ could work well for your setting and budget."
4. Leave the door open: "If your budget shifts, I'd love to help."

Tone: warm, respectful, not dismissive. No cinematic opening. No wedge instruction.${gigsaladClose}

Word count: 50-75 words.
`;
}

/**
 * Find the minimum floor price across all durations for a format+tier_key.
 * Used by no_viable_scope mode to state the absolute minimum.
 */
function findMinFloor(
  format: PricingResult["format"],
  tier_key: string,
): { min_floor: number; min_duration: number } {
  const rateTable = RATE_TABLES[format];
  let min_floor = Infinity;
  let min_duration = 0;

  for (const [durationKey, tiers] of Object.entries(rateTable)) {
    const rates = tiers[tier_key as keyof TierRates];
    if (rates && rates.floor < min_floor) {
      min_floor = rates.floor;
      min_duration = Number(durationKey);
    }
  }

  return { min_floor, min_duration };
}
