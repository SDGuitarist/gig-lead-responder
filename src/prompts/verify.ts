import type { Classification } from "../types.js";

/**
 * Builds the verification gate prompt.
 * Requires Claude to extract exact quotes from the draft as evidence.
 */
export function buildVerifyPrompt(classification: Classification): string {
  return `You are a quality gate for Pacific Flow Entertainment response drafts.

Your job: evaluate a draft response against the classification and return structured evidence. You must extract EXACT QUOTES from the draft — not paraphrases.

## CLASSIFICATION
${JSON.stringify(classification, null, 2)}

## EVALUATION CRITERIA

### 1. Validation Line
Extract the exact sentence from the draft that validates the CLIENT (not the event). This must be specific to them — not generic praise.

### 2. Best Line
Extract the single strongest sentence in the draft — the one that would make a reader stop scrolling.

### 3. Concern Traceability
For EACH flagged concern in the classification, find the exact sentence in the draft that addresses it. If a concern has no matching sentence, the draft_sentence MUST be empty string "" — this is an automatic FAIL.

Flagged concerns: ${JSON.stringify(classification.flagged_concerns)}

### 4. Scene Quote
Extract the exact sentence that puts the reader IN a moment. This is the "cinematic" test.

### 5. Scene Type
- "cinematic": You can SEE the moment. Specific time, place, sensory detail. "The mariachi appears at her table and three generations go quiet."
- "structural": Describes what will happen in process terms. "I shape the music in phases." "I create a dynamic experience."
structural = AUTOMATIC FAIL

### 6. Competitor Test
Could another vendor have written this exact opening? If yes → competitor_test = true → FAIL.
The opening must contain an insight specific to THIS lead.

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

${classification.platform === "gigsalad"
    ? `### 8. Platform Policy Check — GigSalad (HARD GATE)
Scan the ENTIRE draft for any phone number, email address, website URL, social media handle (Instagram, Facebook, etc.), or off-platform contact language ("call me," "text me," "visit our site," "reach out directly," etc.).
If ANY of the above appears anywhere in the draft → gate_status = "fail" with fail_reason: "GigSalad platform policy violation: response contains external contact information."
This overrides all other checks — a draft that passes every other test but contains a URL still FAILS.

`
    : ""}### ${classification.platform === "gigsalad" ? "9" : "8"}. Gate Status
- "pass": All of the following must be true:
  - scene_type is "cinematic"
  - competitor_test is false
  - All concern_traceability entries have non-empty draft_sentence
  - At least 7 of 9 gut_checks are true${classification.platform === "gigsalad" ? "\n  - Platform policy check passes (no contact info detected)" : ""}
- "fail": Any of the above conditions not met

### ${classification.platform === "gigsalad" ? "10" : "9"}. Fail Reasons
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
    "competitor_test": boolean
  },
  "gate_status": "pass" | "fail",
  "fail_reasons": ["specific fix instruction 1", "..."]
}`;
}
