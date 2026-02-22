import { callClaude } from "../claude.js";
import { buildClassifyPrompt } from "../prompts/classify.js";
import type { Classification } from "../types.js";

/**
 * Stage 1: Classify a raw lead into structured JSON.
 * Implements PROTOCOL.md Steps 0-5.
 */
export async function classifyLead(rawText: string, today: string): Promise<Classification> {
  const systemPrompt = buildClassifyPrompt(today);
  const userMessage = `Classify this lead:\n\n${rawText}`;

  const result = await callClaude<Classification>(systemPrompt, userMessage);

  // Validate critical fields exist
  if (!result.format_recommended) {
    throw new Error("Classification missing format_recommended");
  }
  if (!result.duration_hours) {
    throw new Error("Classification missing duration_hours");
  }
  if (!result.rate_card_tier) {
    throw new Error("Classification missing rate_card_tier");
  }
  if (!result.lead_source_column) {
    throw new Error("Classification missing lead_source_column");
  }

  return result;
}
