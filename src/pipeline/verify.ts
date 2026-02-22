import { callClaude } from "../claude.js";
import { buildVerifyPrompt } from "../prompts/verify.js";
import { generateResponse } from "./generate.js";
import type { Classification, Drafts, GateResult, PricingResult } from "../types.js";

/**
 * Run the verification gate on a set of drafts.
 * Requires pricing for budget_acknowledged gut check.
 */
export async function verifyGate(
  drafts: Drafts,
  classification: Classification,
  pricing: PricingResult,
): Promise<GateResult> {
  const systemPrompt = buildVerifyPrompt(classification, pricing);
  const userMessage = `Evaluate this draft:\n\n## FULL DRAFT\n${drafts.full_draft}\n\n## COMPRESSED DRAFT\n${drafts.compressed_draft}`;

  return await callClaude<GateResult>(systemPrompt, userMessage);
}

/**
 * Stage 5: Generate drafts → verify → rewrite if needed.
 * Max 2 retries (3 total attempts). Returns last attempt if all fail.
 */
export async function runWithVerification(
  classification: Classification,
  pricing: PricingResult,
  context: string,
  maxRetries: number = 2
): Promise<{ drafts: Drafts; gate: GateResult; verified: boolean }> {
  let drafts = await generateResponse(classification, pricing, context);
  let gate = await verifyGate(drafts, classification, pricing);

  if (gate.gate_status === "pass") {
    return { drafts, gate, verified: true };
  }

  // Rewrite loop
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.warn(`Gate FAILED (attempt ${attempt}/${maxRetries + 1}). Reasons: ${gate.fail_reasons.join("; ")}`);
    console.warn("Rewriting with targeted instructions...");

    drafts = await generateResponse(classification, pricing, context, gate.fail_reasons);
    gate = await verifyGate(drafts, classification, pricing);

    if (gate.gate_status === "pass") {
      console.log(`Gate PASSED on attempt ${attempt + 1}.`);
      return { drafts, gate, verified: true };
    }
  }

  // All retries exhausted — return last attempt with verified: false
  console.warn(`Gate still FAILED after ${maxRetries + 1} attempts. Returning best attempt with verified: false.`);
  return { drafts, gate, verified: false };
}
