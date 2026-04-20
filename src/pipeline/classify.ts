import { callClaude } from "../claude.js";
import { ClassificationError } from "../errors.js";
import { buildClassifyPrompt } from "../prompts/classify.js";
import { wrapUntrustedData } from "../utils/sanitize.js";
import type { Classification } from "../types.js";

const VALID_COMPETITION = new Set(["low", "medium", "high", "extreme"]);
const VALID_TIERS = new Set(["premium", "standard", "qualification"]);
const VALID_RATE_TIERS = new Set(["T1", "T2", "T3"]);
const VALID_ACTIONS = new Set(["quote", "assume_and_quote", "one_question"]);

const validateClassification = (raw: unknown): Classification => {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) throw new ClassificationError("Expected JSON object from LLM");
  const obj = raw as Record<string, unknown>;
  // Required fields
  if (!obj.format_recommended) throw new ClassificationError("Classification missing format_recommended");
  if (!obj.duration_hours) throw new ClassificationError("Classification missing duration_hours");
  if (!obj.rate_card_tier) throw new ClassificationError("Classification missing rate_card_tier");
  if (!obj.lead_source_column) throw new ClassificationError("Classification missing lead_source_column");
  // Branching-critical fields — invalid values cause silent wrong behavior downstream
  if (!VALID_COMPETITION.has(obj.competition_level as string)) {
    throw new ClassificationError(`Classification invalid competition_level: "${obj.competition_level}"`);
  }
  if (!VALID_TIERS.has(obj.tier as string)) {
    throw new ClassificationError(`Classification invalid tier: "${obj.tier}"`);
  }
  if (!VALID_RATE_TIERS.has(obj.rate_card_tier as string)) {
    throw new ClassificationError(`Classification invalid rate_card_tier: "${obj.rate_card_tier}"`);
  }
  if (!VALID_ACTIONS.has(obj.action as string)) {
    throw new ClassificationError(`Classification invalid action: "${obj.action}"`);
  }
  if (typeof obj.duration_hours !== "number" || obj.duration_hours <= 0) {
    throw new ClassificationError(`Classification invalid duration_hours: "${obj.duration_hours}"`);
  }
  if (obj.stated_budget !== null && typeof obj.stated_budget !== "number") {
    throw new ClassificationError(`Classification invalid stated_budget: expected number or null, got "${typeof obj.stated_budget}"`);
  }
  return raw as Classification;
};

/**
 * Stage 1: Classify a raw lead into structured JSON.
 * Implements PROTOCOL.md Steps 0-5.
 */
export async function classifyLead(rawText: string, today: string): Promise<Classification> {
  const systemPrompt = buildClassifyPrompt(today);
  const userMessage = `Classify this lead:\n\n${wrapUntrustedData("lead_email", rawText)}`;

  const result = await callClaude<Classification>(systemPrompt, userMessage, undefined, validateClassification);

  // Sanitize event_date_iso — LLM may return "March 22" or "TBD" instead of YYYY-MM-DD
  if (result.event_date_iso && !/^\d{4}-\d{2}-\d{2}$/.test(result.event_date_iso)) {
    console.warn(`Invalid event_date_iso from LLM: "${result.event_date_iso}" — treating as null`);
    result.event_date_iso = null;
  }

  // Sanitize venue_name — LLM may return empty string instead of null
  if (result.venue_name !== undefined && result.venue_name !== null && result.venue_name.trim() === "") {
    result.venue_name = null;
  }
  // Backward compat: old cached classifications may lack this field
  if (result.venue_name === undefined) {
    result.venue_name = null;
  }

  // Sanitize client_first_name — LLM may return empty string or omit entirely
  if (result.client_first_name !== undefined && result.client_first_name !== null && result.client_first_name.trim() === "") {
    result.client_first_name = null;
  }
  if (result.client_first_name === undefined) {
    result.client_first_name = null;
  }

  return result;
}
