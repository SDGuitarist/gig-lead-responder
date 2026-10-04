import { TIER_A_VENUES } from "../data/venues.js";
import type { Classification } from "../types.js";

interface ClassificationVerificationResult {
  classification: Classification;
  warnings: string[];
}

const CULTURAL_CONTEXT_PATTERNS = [
  /\bquincea(?:ñ|n)era\b/i,
  /\bmariachi\b/i,
  /\blas ma(?:ñ|n)anitas\b/i,
  /\bserenata\b/i,
  /\bmexican\b/i,
  /\bspanish guitar\b/i,
];

function addWarning(warnings: string[], warning: string): void {
  if (!warnings.includes(warning)) warnings.push(warning);
}

function recommendedFamily(format: Classification["format_recommended"]): string {
  if (format.startsWith("mariachi")) return "mariachi";
  if (format.startsWith("flamenco")) return "flamenco";
  if (format === "bolero_trio") return "bolero";
  if (format === "solo" || format === "duo") return "solo_duo";
  if (format.startsWith("sourced_cultural_")) return "sourced";
  return "unknown";
}

function parseBudget(rawText: string): number | null {
  const budgetMatch = rawText.match(/\$ ?(\d{2,5})(?:\.\d{2})?/);
  if (!budgetMatch) return null;
  const parsed = Number(budgetMatch[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseQuoteCount(rawText: string): number | null {
  const quoteMatch = rawText.match(/\b(\d{1,2})\s+(?:other\s+)?(?:quotes?|bids?|vendors?)\b/i);
  if (!quoteMatch) return null;
  const parsed = Number(quoteMatch[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

export function verifyClassificationHeuristics(
  rawText: string,
  classification: Classification,
): ClassificationVerificationResult {
  const warnings = [...classification.flagged_concerns];
  const family = recommendedFamily(classification.format_recommended);

  if (/\bmariachi\b/i.test(rawText) && family !== "mariachi") {
    addWarning(warnings, "classification_verify: raw lead mentions mariachi but recommended format is not mariachi");
  }
  if (/\bflamenco\b/i.test(rawText) && family !== "flamenco") {
    addWarning(warnings, "classification_verify: raw lead mentions flamenco but recommended format is not flamenco");
  }
  if (/\bbolero\b/i.test(rawText) && family !== "bolero") {
    addWarning(warnings, "classification_verify: raw lead mentions bolero but recommended format is not bolero");
  }

  const budget = parseBudget(rawText);
  if (budget !== null && classification.stated_budget === null) {
    addWarning(warnings, `classification_verify: raw lead mentions budget $${budget} but stated_budget is null`);
  }

  const quoteCount = parseQuoteCount(rawText);
  if (quoteCount !== null && quoteCount !== classification.competition_quote_count) {
    addWarning(
      warnings,
      `classification_verify: raw lead suggests ${quoteCount} competitor quotes but classification has ${classification.competition_quote_count}`,
    );
  }

  // A Tier A venue is auto-premium and premium means T3; pricing reads rate_card_tier,
  // so check that, not just the flag. Any warning holds the lead for Alex.
  const tierA = TIER_A_VENUES.find((v) => v.pattern.test(rawText));
  if (tierA && (classification.rate_card_tier !== "T3" || !classification.stealth_premium)) {
    addWarning(warnings, `classification_verify: Tier A venue ${tierA.name} but priced at ${classification.rate_card_tier}` +
      `${classification.stealth_premium ? "" : " and stealth_premium is false"}`);
  }

  // Graceful decline (port manifest R320): never auto-sent; Alex reads it first.
  if (classification.graceful_decline === true) {
    addWarning(warnings, "graceful_decline: format/fit or sensitivity trigger; Alex reviews before it goes out");
  }

  const hasCulturalSignal = CULTURAL_CONTEXT_PATTERNS.some((pattern) => pattern.test(rawText));
  if (hasCulturalSignal && !classification.cultural_context_active) {
    addWarning(warnings, "classification_verify: raw lead has cultural signals but cultural_context_active is false");
  }

  return {
    classification: {
      ...classification,
      flagged_concerns: warnings,
    },
    warnings: warnings.filter((warning) => !classification.flagged_concerns.includes(warning)),
  };
}
