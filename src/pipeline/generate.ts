import { callClaude } from "../claude.js";
import { GenerationError } from "../errors.js";
import { buildGeneratePrompt } from "../prompts/generate.js";
import type { Classification, Drafts, GateResult, PricingResult } from "../types.js";
import { escapeForPrompt, wrapEditInstructions } from "../utils/sanitize.js";
import { mentionsPrice } from "../utils/price-mention.js";
import { insertPriceBlock, priceBlockFor } from "./price-block.js";

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
  strategic_reserve?: unknown;
}

const SIGN_OFF = `\nAlex Guillen`;
const PRICE_SIGNAL_PATTERN = /\$\s?\d|\brate\b|\bquote\b|\banchor\b|\bfloor\b|\binvestment\b/i;

const RESERVE_MAX_CHARS = 240;
// More than one sentence: an end mark followed by more text. Errs toward dropping
// (an abbreviation like "Mrs. Lopez" drops the insight, which is the safe side).
const MULTI_SENTENCE = /[.!?](?=\s+\S)/;

/**
 * Port manifest R018: insights the first reply didn't use, banked for follow-ups.
 * Parsed once: up to 3 trimmed non-empty strings; anything else is dropped. A bad
 * reserve never blocks a draft (it only feeds a later follow-up).
 */
export function normalizeStrategicReserve(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.replace(/\s+/g, " ").trim())
    // "One sentence, never a price" is enforced here, not trusted to the prompt
    // (Codex round 1, reserve/auth range): an entry that breaks it is dropped.
    .filter((v) => v.length > 0 && v.length <= RESERVE_MAX_CHARS && !mentionsPrice(v) && !MULTI_SENTENCE.test(v))
    .slice(0, 3);
}

const validateGenerateResponse = (raw: unknown): GenerateResponse => {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) throw new GenerationError("Expected JSON object from LLM");
  const obj = raw as Record<string, unknown>;
  if (typeof obj.full_draft !== "string" || !obj.full_draft) {
    throw new GenerationError("LLM response missing full_draft");
  }
  if (typeof obj.compressed_draft !== "string" || !obj.compressed_draft) {
    throw new GenerationError("LLM response missing compressed_draft");
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
        + `\n- Best line: "${escapeForPrompt(positiveSignals.best_line)}"`
        + `\n- Validation line: "${escapeForPrompt(positiveSignals.validation_line)}"`
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

  // Truncate compressed_draft BEFORE contact block so the block is never sliced off
  const MAX_COMPRESSED_LENGTH = 2000;
  const rawCompressed = result.compressed_draft.length > MAX_COMPRESSED_LENGTH
    ? result.compressed_draft.slice(0, MAX_COMPRESSED_LENGTH)
    : result.compressed_draft;

  // NP2 (plan 2026-10-09 row C): the app's price line + in-kind line replace the model's [[PRICE: ...]] marker.
  // Order: cut first (the cut can never slice the block), then insert, then the sign-off. A marker the cut
  // removed, or a missing one, leaves no block: the post-check holds the draft.
  const block = priceBlockFor(classification, pricing);
  const full = insertPriceBlock(result.full_draft, block);
  const compressed = insertPriceBlock(rawCompressed, block);
  const fullDraft = suppressContact ? full : ensureSignOff(full);
  const compressedDraft = suppressContact ? compressed : ensureSignOff(compressed);

  const compressedWordCount = countWords(compressedDraft);

  if (classification.action === "one_question" && classification.format_recommended === "unresolved") {
    enforceClarificationDraft("full_draft", fullDraft);
    enforceClarificationDraft("compressed_draft", compressedDraft);
  }

  return {
    full_draft: fullDraft,
    compressed_draft: compressedDraft,
    compressed_word_count: compressedWordCount,
    strategic_reserve: normalizeStrategicReserve(result.strategic_reserve),
  };
}

function enforceClarificationDraft(field: "full_draft" | "compressed_draft", draft: string): void {
  const questionMarks = (draft.match(/\?/g) ?? []).length;
  if (questionMarks !== 1) {
    throw new GenerationError(`Clarification mode ${field} must contain exactly one question`);
  }

  if (PRICE_SIGNAL_PATTERN.test(draft)) {
    throw new GenerationError(`Clarification mode ${field} must not include pricing language`);
  }
}

function ensureSignOff(draft: string): string {
  if (draft.includes("Alex Guillen")) return draft;
  return draft.trimEnd() + "\n\n" + SIGN_OFF;
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}
