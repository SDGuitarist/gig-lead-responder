import { TIER_A_VENUES } from "../data/venues.js";
import { lookupResidencyRate } from "./price.js";
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
  gigsaladPage?: boolean,
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

  // Port manifest R358: the count GigSalad displays (the page parser's own line) is the
  // only source when present; a number the client wrote elsewhere does not override it.
  // Only the LAST line counts: the parser writes it last, and a client can type a
  // "Competition:" line into Details, which lands earlier.
  // A page that shows no count (business account) means 0, per the classify rule; an
  // invented or client-written number is held there too (Alex 2026-10-05).
  // Only when the CALLER says rawText IS a parsed GigSalad page (Codex R358 rounds 1-2): in
  // any other text, including a GigSalad email, a client could type these lines.
  const lastLine = gigsaladPage === true ? rawText.split("\n").at(-1) ?? "" : "";
  const displayed = /^Competition: (\d+) quotes sent by other members\b.*$/.exec(lastLine);
  const notShown = lastLine === "Competition: not shown on this GigSalad page (unknown)";
  if (displayed && Number(displayed[1]) !== classification.competition_quote_count) {
    addWarning(warnings, `classification_verify: GigSalad displays ${displayed[1]} competitor quotes but classification has ` +
      `${classification.competition_quote_count}`);
  }
  if (notShown && classification.competition_quote_count !== 0) {
    addWarning(warnings, "classification_verify: GigSalad displays no count, so competition_quote_count must be 0, " +
      `but classification has ${classification.competition_quote_count}`);
  }
  const quoteCount = displayed || notShown ? null : parseQuoteCount(rawText);
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

  // Residency (port manifest R278/R286): every residency lead is held for Alex,
  // with what the app would quote or why it quotes nothing.
  if (classification.engagement_type === "residency") {
    if (classification.format_recommended !== "solo") {
      addWarning(warnings, `residency: recurring ${classification.format_recommended} priced as private events, no discount; Alex decides`);
    } else {
      const tier = classification.residency_tier ?? "R2";
      const q = lookupResidencyRate(tier, classification.duration_hours, classification.residency_cadence ?? null);
      addWarning(warnings, q.rate === null
        ? `residency: ${tier}, no price stated: ${q.reason}`
        : `residency: ${tier} ${q.cadence} ${q.hours}h at $${q.rate} per night; Alex reviews every residency`);
    }
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
