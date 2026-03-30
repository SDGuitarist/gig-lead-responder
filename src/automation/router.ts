import type { PipelineOutput, Format } from "../types.js";
import type { ParsedLead, AutoSendResult, HoldResult, RouterResult } from "./types.js";

/**
 * Format families — same-family corrections are NOT edge cases.
 * Cross-family corrections (e.g., flamenco → mariachi) ARE edge cases.
 */
const FORMAT_FAMILIES: Record<string, readonly Format[]> = {
  solo: ["solo", "duo"],
  flamenco: ["flamenco_duo", "flamenco_trio"],
  mariachi: ["mariachi_4piece", "mariachi_full"],
  bolero: ["bolero_trio"],
};

function getFormatFamily(format: Format): string {
  for (const [family, formats] of Object.entries(FORMAT_FAMILIES)) {
    if ((formats as readonly string[]).includes(format)) return family;
  }
  return "unknown";
}

/**
 * Route a processed lead to auto-send or hold for manual review.
 *
 * Any single trigger = hold. Multiple triggers accumulate reasons.
 * Low-confidence parses ALWAYS hold — no exceptions.
 */
export function routeLead(
  lead: ParsedLead,
  output: PipelineOutput,
  budgetThreshold: number = 3000
): RouterResult {
  const reasons: string[] = [];
  const { classification, pricing, verified } = output;

  // --- Mandatory holds ---

  // Low parse confidence — ALWAYS hold (Codex fix #4)
  if (lead.parseConfidence === "low") {
    reasons.push("Low parse confidence — manual review required");
  }

  // Yelp not enriched — ALWAYS hold
  if (lead.platform === "yelp" && !lead.enriched) {
    reasons.push("Yelp lead not enriched from portal — truncated message");
  }

  // Gate failed after all retries
  if (!verified) {
    reasons.push("Verification gate failed after retries");
  }

  // --- Pricing guardrails ---

  // High budget quote
  if (pricing.quote_price > budgetThreshold) {
    reasons.push(`Quote $${pricing.quote_price} exceeds threshold $${budgetThreshold}`);
  }

  // Unverified solo/duo rates — hold until confirmed (Codex fix #7)
  // NOTE: Remove this guardrail once solo/duo rates are verified against rate card
  // Rates were verified 2026-03-29 — this guardrail can now be removed
  // Keeping commented out as reference:
  // if (classification.format_recommended === "solo" || classification.format_recommended === "duo") {
  //   reasons.push("Solo/duo rates — verify against rate card before auto-send");
  // }

  // --- Classification-based holds ---

  // Flagged concerns
  if (classification.flagged_concerns.length > 0) {
    reasons.push(`${classification.flagged_concerns.length} flagged concern(s)`);
  }

  // Major format correction (cross-family)
  const requestedFamily = guessFormatFamily(classification.format_requested);
  const recommendedFamily = getFormatFamily(classification.format_recommended);
  if (requestedFamily && recommendedFamily && requestedFamily !== recommendedFamily) {
    reasons.push(`Cross-family format correction: ${classification.format_requested} → ${classification.format_recommended}`);
  }

  // Vague lead with one-question action
  if (classification.vagueness === "vague" && classification.action === "one_question") {
    reasons.push("Vague lead — needs clarifying question");
  }

  // High-value assumption (stealth premium + assume_and_quote)
  if (classification.action === "assume_and_quote" && classification.stealth_premium) {
    reasons.push("High-value assumption (stealth premium + assumed quote)");
  }

  // --- Decision ---

  if (reasons.length > 0) {
    return { action: "hold", lead, pipelineOutput: output, reasons } satisfies HoldResult;
  }

  return { action: "auto-send", lead, pipelineOutput: output } satisfies AutoSendResult;
}

/**
 * Best-effort guess at format family from the raw format_requested string.
 * This is free-text from the client, so it may not match any known format.
 */
function guessFormatFamily(requested: string): string | null {
  const lower = requested.toLowerCase();
  if (/mariachi/i.test(lower)) return "mariachi";
  if (/flamenco/i.test(lower)) return "flamenco";
  if (/bolero/i.test(lower)) return "bolero";
  if (/solo|guitar|acoustic|classical/i.test(lower)) return "solo";
  if (/duo|pair|two/i.test(lower)) return "solo"; // duo is in solo family
  return null; // Unknown — can't determine family
}
