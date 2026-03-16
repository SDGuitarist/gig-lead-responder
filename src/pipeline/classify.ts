import { callClaude } from "../claude.js";
import { buildClassifyPrompt } from "../prompts/classify.js";
import { wrapUntrustedData } from "../utils/sanitize.js";
import type { Classification } from "../types.js";

const validateClassification = (raw: unknown): Classification => {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) throw new Error("Expected JSON object from LLM");
  const obj = raw as Record<string, unknown>;
  if (!obj.format_recommended) throw new Error("Classification missing format_recommended");
  if (!obj.duration_hours) throw new Error("Classification missing duration_hours");
  if (!obj.rate_card_tier) throw new Error("Classification missing rate_card_tier");
  if (!obj.lead_source_column) throw new Error("Classification missing lead_source_column");
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
