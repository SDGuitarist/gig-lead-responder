import { callClaude } from "../claude.js";
import { buildGeneratePrompt } from "../prompts/generate.js";
import type { Classification, Drafts, PricingResult } from "../types.js";

const CONTACT_BLOCK = `\nAlex Guillen\nPacific Flow Entertainment\n(619) 755-3246`;

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

  let userMessage = "Write the two response drafts for this lead based on the classification, pricing, and context provided in the system prompt.";

  if (rewriteInstructions && rewriteInstructions.length > 0) {
    userMessage += `\n\nREWRITE INSTRUCTIONS — Fix these specific issues from the previous draft:\n${rewriteInstructions.map((r, i) => `${i + 1}. ${r}`).join("\n")}`;
  }

  const result = await callClaude<{ full_draft: string; compressed_draft: string }>(
    systemPrompt,
    userMessage
  );

  // GigSalad prohibits direct contact info — suppress contact block
  const suppressContact = classification.platform === "gigsalad";
  const fullDraft = suppressContact ? result.full_draft : ensureContactBlock(result.full_draft);
  const compressedDraft = suppressContact ? result.compressed_draft : ensureContactBlock(result.compressed_draft);

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
