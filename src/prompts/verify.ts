import { CONCERN_4PIECE_ALT, CONCERN_FULL_ENSEMBLE, GUT_CHECK_THRESHOLD, GUT_CHECK_TOTAL, type Classification, type PricingResult } from "../types.js";
import { sanitizeClassification, wrapUntrustedData } from "../utils/sanitize.js";

/**
 * Builds the verification gate prompt.
 * Requires Claude to extract exact quotes from the draft as evidence.
 * Requires pricing for budget_acknowledged gut check.
 */
export function buildVerifyPrompt(
  classification: Classification,
  pricing: Pick<PricingResult, "budget">,
): string {
  const budget = pricing.budget;
  return `You are a quality gate for Pacific Flow Entertainment response drafts.

Your job: evaluate a draft response against the classification and return structured evidence. You must extract EXACT QUOTES from the draft — not paraphrases.

${wrapUntrustedData("lead_classification", JSON.stringify(sanitizeClassification(classification), null, 2))}

## EVALUATION CRITERIA

### 1. Validation Line
Extract the exact sentence from the draft that validates the CLIENT (not the event). This must be specific to them — not generic praise.

### 2. Best Line
Extract the single strongest sentence in the draft — the one that would make a reader stop scrolling.

### 3. Concern Traceability
For EACH flagged concern in the classification, find the exact sentence in the draft that addresses it. If a concern has no matching sentence, the draft_sentence MUST be empty string "" — this is an automatic FAIL.

Flagged concerns: ${JSON.stringify(sanitizeClassification(classification).flagged_concerns)}

### 4. Scene Quote
Extract the exact sentence that puts the reader IN a moment. This is the "cinematic" test.

### 5. Scene Type
- "cinematic": You can SEE the moment. Specific time, place, sensory detail. "The mariachi appears at her table and three generations go quiet."
- "structural": Describes what will happen in process terms. "I shape the music in phases." "I create a dynamic experience."
structural = AUTOMATIC FAIL

### 6. Competitor Test
Could another vendor have written this exact opening? If yes → competitor_test = true → FAIL.
The opening must contain an insight specific to THIS lead.

### 6b. Lead-Specificity Check
Does the opening sentence reference a CONCRETE DETAIL from the classification? This is different from the Competitor Test: competitor_test asks "could another vendor write this?" (voice/insight), while lead-specificity asks "does the opening reference a factual detail from this specific lead?" (grounding).
- Look at the FIRST sentence of the draft
- Check if it mentions a specific detail from the classification: event type, date, venue, format, cultural context, or any other concrete fact
- Generic openings like "What a beautiful event" or "Congratulations on your upcoming celebration" → lead_specific_opening = false
- Specific openings like "A mariachi serenata at sunset for your parents' 50th anniversary" → lead_specific_opening = true

### 7. Gut Checks (all boolean)
- can_see_it: Reader can visualize a specific moment
- validated_them: Draft validates the person, not just the event
- named_fear: Draft acknowledges what could go wrong or what burned them before
- differentiated: At least one line only THIS vendor would write
- preempted_questions: Price, logistics, format all addressed
- creates_relief: Reader would think "this person gets it"
- best_line_present: There's a genuinely strong line
- prose_flows: Reads as one continuous movement, not assembled sections
- competitor_test: false means PASS (no competitor would write this)
- lead_specific_opening: First sentence references a concrete detail from the classification (not generic)
- budget_acknowledged: ${buildBudgetInstruction(budget, classification)}
- past_date_acknowledged: ${buildPastDateInstruction(classification)}
- mariachi_pricing_format: ${buildMariachiPricingInstruction(classification)}
- cultural_vocabulary_used: ${buildCulturalVocabInstruction(classification)}

${classification.platform === "gigsalad"
    ? `### 8. Platform Policy Check — GigSalad (HARD GATE)
Scan the ENTIRE draft for any phone number, email address, website URL, social media handle (Instagram, Facebook, etc.), or off-platform contact language ("call me," "text me," "visit our site," "reach out directly," etc.).
If ANY of the above appears anywhere in the draft → gate_status = "fail" with fail_reason: "GigSalad platform policy violation: response contains external contact information."
This overrides all other checks — a draft that passes every other test but contains a URL still FAILS.
`
    : `### 8. Contact Block Check (HARD GATE)
Verify the draft ends with a contact block containing a name ("Alex Guillen"), business name ("Pacific Flow Entertainment"), and a phone number. All three must be present.
If the contact block is missing or incomplete → gate_status = "fail" with fail_reason: "Missing contact block: The Bash and direct leads must include Alex's contact information."
`}
### 9. Gate Status
- "pass": All of the following must be true:
  - scene_type is "cinematic"
  - competitor_test is false
  - All concern_traceability entries have non-empty draft_sentence
  - At least ${GUT_CHECK_THRESHOLD} of ${GUT_CHECK_TOTAL} gut_checks are true
  - Platform check passes (${classification.platform === "gigsalad" ? "no contact info detected" : "contact block present with name, business, phone"})
- "fail": Any of the above conditions not met

### 10. Fail Reasons
If gate_status is "fail", list the SPECIFIC items that need fixing. Be precise:
- BAD: "Improve the scene"
- GOOD: "Scene is structural ('I create phases of music') — rewrite with a specific cinematic moment (time, place, sensory detail)"

## OUTPUT FORMAT

Return ONLY this JSON (no markdown fences, no explanation):

{
  "validation_line": "exact quoted sentence",
  "best_line": "exact quoted sentence",
  "concern_traceability": [
    {"concern": "concern text", "draft_sentence": "exact quoted sentence or empty string"}
  ],
  "scene_quote": "exact quoted sentence",
  "scene_type": "cinematic" | "structural",
  "competitor_test": true | false,
  "gut_checks": {
    "can_see_it": boolean,
    "validated_them": boolean,
    "named_fear": boolean,
    "differentiated": boolean,
    "preempted_questions": boolean,
    "creates_relief": boolean,
    "best_line_present": boolean,
    "prose_flows": boolean,
    "competitor_test": boolean,
    "lead_specific_opening": boolean,
    "budget_acknowledged": boolean,
    "past_date_acknowledged": boolean,
    "mariachi_pricing_format": boolean,
    "cultural_vocabulary_used": boolean
  },
  "gate_status": "pass" | "fail",
  "fail_reasons": ["specific fix instruction 1", "..."]
}`;
}

/**
 * Build the budget_acknowledged gut check instruction based on budget tier.
 * When tier is "none", the check is a no-op (always true).
 */
function buildBudgetInstruction(
  budget: PricingResult["budget"],
  classification: Classification,
): string {
  if (budget.tier === "none") {
    return "Always true — no budget mismatch to acknowledge.";
  }

  const stated = classification.stated_budget;
  const deletion = `Deletion test: remove the sentence that references the client's stated budget ($${stated}) or the pricing gap. Does the remaining draft still work for any lead with any budget? If yes → false. The budget must be specifically addressed.`;

  if (budget.tier === "small") {
    return `${deletion} For "small" gap: draft names the rate directly in relation to stated budget ($${stated}).`;
  }

  if (budget.tier === "large") {
    const alt = budget.scoped_alternative;
    return `${deletion} For "large" gap: draft names a specific scoped alternative price ($${alt.price} for ${alt.duration_hours}hr).`;
  }

  // no_viable_scope
  return `${deletion} For "no_viable_scope": draft states the floor and suggests a concrete alternative.`;
}

/**
 * Build the past_date_acknowledged gut check instruction.
 * No-op (always true) when no past date detected.
 */
function buildPastDateInstruction(classification: Classification): string {
  if (!classification.past_date_detected) {
    return "Always true — no past date detected.";
  }
  return 'Draft must contain language clarifying the date (asking about the year, suggesting next occurrence). Deletion test: remove the date clarification — does the draft still work for a future event? If yes → false.';
}

/**
 * Build the mariachi_pricing_format gut check instruction.
 * No-op (always true) when no dual-format context exists.
 */
function buildMariachiPricingInstruction(classification: Classification): string {
  if (
    !classification.flagged_concerns.includes(CONCERN_4PIECE_ALT) &&
    !classification.flagged_concerns.includes(CONCERN_FULL_ENSEMBLE)
  ) {
    return "Always true — no dual-format context.";
  }
  if (classification.flagged_concerns.includes(CONCERN_4PIECE_ALT)) {
    return "First price presented must be the full ensemble (higher option). Deletion test: remove the context and does the high anchor still lead? If not → false.";
  }
  return "Always true — 4-piece is the lead format, no anchor-high requirement.";
}

/**
 * Build the cultural_vocabulary_used gut check instruction.
 * No-op (always true) when no cultural context is active.
 */
function buildCulturalVocabInstruction(classification: Classification): string {
  if (!classification.cultural_context_active) {
    return "Always true — no cultural context active.";
  }
  return 'Draft must use specific cultural terminology (e.g., "Nochebuena" not "Christmas Eve", "Las Mañanitas" not "birthday song"). Deletion test: swap the cultural term for a generic English equivalent — does the sentence still work? If yes → false.';
}
