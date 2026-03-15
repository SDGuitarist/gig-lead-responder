import { callClaude } from "../claude.js";
import { buildGeneratePrompt } from "../prompts/generate.js";
import type { Classification, Drafts, PricingResult } from "../types.js";
import { wrapEditInstructions } from "../utils/sanitize.js";

/** Shape returned by the generate prompt (reasoning is discarded, only drafts used downstream) */
interface GenerateResponse {
  reasoning: {
    details_present: string[];
    absences: string[];
    emotional_core: string;
    cinematic_opening: string;
    validation_line: string;
  };
  full_draft: string;
  compressed_draft: string;
}

const CONTACT_BLOCK = `\nAlex Guillen\nPacific Flow Entertainment\n(619) 755-3246`;

const validateGenerateResponse = (raw: unknown): GenerateResponse => {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) throw new Error("Expected JSON object from LLM");
  const obj = raw as Record<string, unknown>;
  if (typeof obj.full_draft !== "string" || !obj.full_draft) {
    throw new Error("LLM response missing full_draft");
  }
  if (typeof obj.compressed_draft !== "string" || !obj.compressed_draft) {
    throw new Error("LLM response missing compressed_draft");
  }
  return raw as GenerateResponse;
};

/**
 * Stage 4: Generate full draft + compressed draft.
 * Optionally accepts rewrite instructions from a failed verification gate.
 */
export async function generateResponse(
  classification: Classification,
  pricing: PricingResult,
  context: string,
  rewriteInstructions?: string[]
): Promise<Drafts> {
  const systemPrompt = buildGeneratePrompt(classification, pricing, context);

  let userMessage = "Reason about this lead, then write the two response drafts based on the classification, pricing, and context provided in the system prompt.";

  if (rewriteInstructions && rewriteInstructions.length > 0) {
    const MAX_INSTRUCTION_LENGTH = 200;
    const sanitized = rewriteInstructions
      .map((r) => r.length > MAX_INSTRUCTION_LENGTH ? r.slice(0, MAX_INSTRUCTION_LENGTH) + "…" : r)
      .map((r, i) => `${i + 1}. ${r}`)
      .join("\n");
    userMessage += "\n\n" + wrapEditInstructions(
      `Fix these specific issues from the previous draft:\n${sanitized}`
    );
  }

  const result = await callClaude<GenerateResponse>(
    systemPrompt,
    userMessage,
    undefined,
    validateGenerateResponse,
  );

  // GigSalad prohibits direct contact info — suppress contact block
  const suppressContact = classification.platform === "gigsalad";
  const fullDraft = suppressContact ? result.full_draft : ensureContactBlock(result.full_draft);

  // Truncate compressed_draft BEFORE contact block so the block is never sliced off
  const MAX_COMPRESSED_LENGTH = 2000;
  const rawCompressed = result.compressed_draft.length > MAX_COMPRESSED_LENGTH
    ? result.compressed_draft.slice(0, MAX_COMPRESSED_LENGTH)
    : result.compressed_draft;
  const compressedDraft = suppressContact ? rawCompressed : ensureContactBlock(rawCompressed);

  const compressedWordCount = countWords(compressedDraft);

  return {
    full_draft: fullDraft,
    compressed_draft: compressedDraft,
    compressed_word_count: compressedWordCount,
  };
}

function ensureContactBlock(draft: string): string {
  if (draft.includes("(619) 755-3246")) return draft;
  return draft.trimEnd() + "\n\n" + CONTACT_BLOCK;
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}
