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

// CONTRACT (Alex 2026-10-09, after the round 3 hard cap): this is a MINIMUM safety net behind the
// classifier's nonprofit_buyer, NOT a complete detector. A keyword list cannot be complete either way:
// it can hold an ordinary lead (an extra review, never a wrong price) and it can miss a nonprofit that
// uses none of these words (then only the classifier catches it; HANDOFF known gap).
// Words that say a nonprofit or fundraiser (R403 backup; Codex round 1 widened it). "Foundation" counts
// only as an organization, never a venue's "Foundation Room", a band called "The Foundation" or a
// foundation stone (case-sensitive name form, or "our foundation", or foundation + an event word).
const NONPROFIT_WORDS = /\b(?:non-?profit|fundrais\w*|charit(?:y|able)|donors?|galas?|auction|benefit(?:t)?ing|benefit\s+(?:dinner|gala|concert|event|show|night|luncheon|for)|PTA|parent[\s-]teacher|booster\s+club)\b|\b501\s?\(c\)/i;
const FOUNDATION_NAME = /\b(?!The\b)[A-Z][\w'&.-]*\s+Foundation\b(?!\s+Room)/;
const FOUNDATION_ORG = /\bour\s+foundation\b|\bfoundation(?:'s)?\s+(?:gala|dinner|board|donors?|fundraiser|benefit|luncheon)\b/i;
// Named nonprofits a lead can mention with no keyword (proper nouns, case-sensitive: not "rotary phone").
const NAMED_NONPROFIT = /\b(?:YMCA|YWCA|Rotary(?:\s+Club)?|Kiwanis|Lions\s+Club|Boys\s+(?:&|and)\s+Girls\s+Club|Junior\s+League)\b/;
// "PTO" is also paid time off (Codex round 2): it counts only when the lead also has school context.
const PTO_SCHOOL = (text: string) => /\bPTO\b/i.test(text) && /\b(?:school|parents?|teachers?|students?|elementary)\b/i.test(text);
const NONPROFIT_SIGNAL = {
  test: (text: string) => NONPROFIT_WORDS.test(text) || FOUNDATION_NAME.test(text) || FOUNDATION_ORG.test(text) || PTO_SCHOOL(text) || NAMED_NONPROFIT.test(text),
};

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

// Valentine's, Cinco de Mayo, Mother's Day (US: second Sunday of May), Fourth of July, NYE.
function holidayPeak(iso: string | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  if (!m) return null;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const fixed: Record<string, string> = { "2-14": "Valentine's Day", "5-5": "Cinco de Mayo", "7-4": "Fourth of July", "12-31": "New Year's Eve" };
  if (fixed[`${month}-${day}`]) return fixed[`${month}-${day}`];
  const may1 = new Date(Date.UTC(year, 4, 1)).getUTCDay(); // 0 = Sunday
  return month === 5 && day === 1 + ((7 - may1) % 7) + 7 ? "Mother's Day" : null;
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
  // Not for a nonprofit buyer (R403, Codex round 1): the venue alone never makes them T3; they are held
  // by the nonprofit check below instead.
  const nonprofit = classification.nonprofit_buyer === true || NONPROFIT_SIGNAL.test(rawText);
  const premiumTier = classification.rate_card_tier === "T3" || classification.rate_card_tier === "T4";
  if (tierA && !nonprofit && (!premiumTier || !classification.stealth_premium)) {
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

  // Nonprofit / fundraiser buyers (port manifest R403; Alex Sept 15 and 2026-10-09): routed on who pays,
  // never premium on the venue alone, and every one is held for Alex until the NP rates are set. A lead
  // that SAYS nonprofit but was not classified as one is held too (the model can miss who pays).
  if (classification.nonprofit_buyer === true) {
    addWarning(warnings, "nonprofit: NP track (decided by who pays, not the venue); Alex prices it until the NP rates are set");
  } else if (NONPROFIT_SIGNAL.test(rawText)) {
    addWarning(warnings, "classification_verify: raw lead mentions a nonprofit or fundraiser but nonprofit_buyer is false");
  }

  // T4 is direct luxury corporate only (R403, Alex 2026-10-09): never a platform lead or a wedding
  // ceremony. If the model still says T4, hold for Alex rather than reprice in code.
  const platformLead = classification.lead_source_column === "P"
    || ["gigsalad", "thebash", "yelp"].includes(String(classification.platform ?? ""));
  if (classification.rate_card_tier === "T4" && (platformLead || /\bceremony\b/i.test(rawText))) {
    addWarning(warnings, "t4: T4 is for direct luxury-corporate leads only (never a platform lead or a wedding ceremony); Alex prices it");
  }

  // Holiday/peak (port manifest R292): the Project quotes these "separately above standard
  // rates" with no number, so every one is held for Alex (Alex 2026-10-05, his date list).
  const peak = holidayPeak(classification.event_date_iso);
  if (peak) {
    addWarning(warnings, `holiday_peak: ${peak} (${classification.event_date_iso}), quoted separately above standard rates; Alex prices it`);
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
