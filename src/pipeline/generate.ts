import { callClaude } from "../claude.js";
import { buildGeneratePrompt } from "../prompts/generate.js";
import type { Classification, Drafts, GateResult, PricingResult } from "../types.js";
import { wrapEditInstructions } from "../utils/sanitize.js";

/** Positive signals from a failed gate — what worked and should be kept. */
export interface PositiveSignals {
  best_line: string;
  validation_line: string;
}

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

const SIGN_OFF = `\nAlex Guillen`;

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
  rewriteInstructions?: string[],
  positiveSignals?: PositiveSignals,
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

    if (positiveSignals) {
      userMessage += "\n\nKEEP THESE (they worked well in the previous draft):"
        + `\n- Best line: "${positiveSignals.best_line}"`
        + `\n- Validation line: "${positiveSignals.validation_line}"`
        + "\nPreserve these lines or improve them — do not discard what already works.";
    }
  }

  const result = await callClaude<GenerateResponse>(
    systemPrompt,
    userMessage,
    undefined,
    validateGenerateResponse,
  );

  // GigSalad prohibits direct contact info — suppress contact block
  const suppressContact = classification.platform === "gigsalad";
  const fullDraft = suppressContact ? result.full_draft : ensureSignOff(result.full_draft);

  // Truncate compressed_draft BEFORE contact block so the block is never sliced off
  const MAX_COMPRESSED_LENGTH = 2000;
  const rawCompressed = result.compressed_draft.length > MAX_COMPRESSED_LENGTH
    ? result.compressed_draft.slice(0, MAX_COMPRESSED_LENGTH)
    : result.compressed_draft;
  const compressedDraft = suppressContact ? rawCompressed : ensureSignOff(rawCompressed);

  const compressedWordCount = countWords(compressedDraft);

  return {
    full_draft: fullDraft,
    compressed_draft: compressedDraft,
    compressed_word_count: compressedWordCount,
  };
}

function ensureSignOff(draft: string): string {
  if (draft.includes("Alex Guillen")) return draft;
  return draft.trimEnd() + "\n\n" + SIGN_OFF;
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}
