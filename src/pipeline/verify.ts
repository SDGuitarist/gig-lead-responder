import { callClaude } from "../claude.js";
import { VerificationError } from "../errors.js";
import { buildVerifyPrompt } from "../prompts/verify.js";
import { generateResponse, type PositiveSignals } from "./generate.js";
import { GUT_CHECK_KEYS, type Classification, type Drafts, type GateResult, type PricingResult } from "../types.js";

// Parses the model's gate result field by field into a trusted GateResult, or
// throws (callClaude retries once, then the lead fails safe). Before, two fields
// were checked to be arrays and the rest was cast (Codex round 1, finding 2).
const validateGateResult = (raw: unknown): GateResult => {
  const fail = (what: string): never => {
    throw new VerificationError(`LLM gate result invalid: ${what}`);
  };
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) fail("expected a JSON object");
  const obj = raw as Record<string, unknown>;
  const str = (k: string): string => (typeof obj[k] === "string" ? (obj[k] as string) : fail(`${k} must be a string`));
  const bool = (v: unknown, k: string): boolean => (typeof v === "boolean" ? v : fail(`${k} must be a boolean`));

  if (obj.gate_status !== "pass" && obj.gate_status !== "fail") fail(`gate_status "${String(obj.gate_status)}"`);
  if (obj.scene_type !== "cinematic" && obj.scene_type !== "structural") fail(`scene_type "${String(obj.scene_type)}"`);
  if (!Array.isArray(obj.fail_reasons) || !obj.fail_reasons.every((r) => typeof r === "string")) {
    fail("fail_reasons must be an array of strings");
  }
  if (!Array.isArray(obj.concern_traceability)) fail("concern_traceability must be an array");
  const traceability = (obj.concern_traceability as unknown[]).map((e, i) => {
    const row = e as Record<string, unknown> | null;
    if (typeof row !== "object" || row === null || typeof row.concern !== "string" || typeof row.draft_sentence !== "string") {
      return fail(`concern_traceability[${i}] must be {concern, draft_sentence} strings`);
    }
    return { concern: row.concern, draft_sentence: row.draft_sentence };
  });
  const gc = obj.gut_checks;
  if (typeof gc !== "object" || gc === null || Array.isArray(gc)) fail("gut_checks must be an object");
  const gutChecks = Object.fromEntries(
    GUT_CHECK_KEYS.map((k) => [k, bool((gc as Record<string, unknown>)[k], `gut_checks.${k}`)]),
  ) as GateResult["gut_checks"];

  const failReasons = obj.fail_reasons as string[];
  // A reported sourced-integrity failure always fails the gate, whatever status
  // the model wrote (port manifest R338: the Project's gate fails on it).
  // Likewise a graceful-decline failure (port manifest R320).
  const gateStatus = failReasons.some((r) => r.startsWith("Sourced integrity failed") || r.startsWith("Graceful decline failed"))
    ? "fail" : obj.gate_status;

  return {
    validation_line: str("validation_line"),
    best_line: str("best_line"),
    concern_traceability: traceability,
    scene_quote: str("scene_quote"),
    scene_type: obj.scene_type as GateResult["scene_type"],
    competitor_test: bool(obj.competitor_test, "competitor_test"),
    gut_checks: gutChecks,
    gate_status: gateStatus as GateResult["gate_status"],
    fail_reasons: failReasons,
  };
};

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

  return await callClaude<GateResult>(systemPrompt, userMessage, undefined, validateGateResult);
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

    const keepSignals: PositiveSignals = {
      best_line: gate.best_line,
      validation_line: gate.validation_line,
    };
    drafts = await generateResponse(classification, pricing, context, gate.fail_reasons, keepSignals);
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
