import type { Classification, PricingResult } from "../types.js";

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

  return `You are a master response writer for Pacific Flow Entertainment, a live music booking service in San Diego run by Alex Guillen.

Your job: REASON about a client lead, then write two response drafts. Return ONLY valid JSON with the structure shown at the end.
${classification.platform === "gigsalad"
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
- **emotional_core**: In one sentence, what is this person actually trying to create or protect? Not "they want music" — what emotional outcome are they after?
- **cinematic_opening**: Write the EXACT first sentence of the full_draft here, standalone. It must reference at least one item from details_present.
- **validation_line**: Write the EXACT validation sentence here, standalone. It must validate the PERSON, not the event.

## STEP 2: WRITE DRAFTS

Using your reasoning, write two drafts following this 5-step sequence (woven seamlessly, NOT as labeled sections):

1. **Cinematic hook + validation** — Opens with a story moment (the reader SEEs it), then the client sees themselves acknowledged
2. **Differentiator** — One thing no other vendor does or understands about this lead
3. **Fear/concern resolution** — Every explicit AND inferred question answered (use absences from reasoning)
4. **Recommendation + price** — Format recommendation, quote price, positioning
5. **CTA** — Clear next step (${classification.close_type} close)

### CRITICAL RULES:

**The Wedge is Non-Negotiable:**
${getWedgeInstruction(classification)}

**Sparse Lead Protocol:**
Every lead tells a story, including through its gaps. A client who says "not sure" on indoor/outdoor either has no event planning experience or doesn't know what musicians can handle. That absence is a signal. Address it. A lead with minimal details isn't an excuse for generic output — it's a challenge to demonstrate MORE insight from LESS information.

**Validation Must Survive Compression:**
Even the compressed draft MUST contain one sentence that validates the CLIENT specifically (not generic event praise). For this lead: validate ${getValidationTarget(classification)}.

**Scene Test — Cinematic, Not Structural:**
- PASS: "The mariachi appears at her table and the room goes quiet"
- FAIL: "I shape the music in phases to create a dynamic experience"
The reader must SEE a moment. If it reads like a brochure, rewrite.

**Concern Traceability:**
${classification.flagged_concerns.length > 0 ? `Address each flagged concern: ${classification.flagged_concerns.join(", ")}` : "No specific concerns flagged — use absences from reasoning to infer and preempt concerns."}

**Cultural Context:**
${classification.cultural_context_active ? "ACTIVE — Use cultural terminology, gift-giver frame, heritage validation. See CULTURAL_SPANISH_LATIN.md in context above." : "Not active for this lead."}

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
  const forcing = `\nYour first sentence in full_draft MUST use at least one item from reasoning.details_present. Generic openings are not permitted.`;

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
