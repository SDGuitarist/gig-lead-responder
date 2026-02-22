import { classifyLead } from "./pipeline/classify.js";
import { lookupPrice, detectBudgetGap } from "./pipeline/price.js";
import { enrichClassification } from "./pipeline/enrich.js";
import { getTodayISO } from "./utils/dates.js";
import { selectContext } from "./pipeline/context.js";
import { generateResponse } from "./pipeline/generate.js";
import { verifyGate, runWithVerification } from "./pipeline/verify.js";
import type { Classification, Drafts, GateResult, PipelineOutput, PricingResult } from "./types.js";

/** Progress event emitted between pipeline stages. */
export interface StageEvent {
  stage: number;
  name: string;
  status: "running" | "done";
  ms?: number;
  result?: unknown;
}

/** Optional callback for streaming stage progress (SSE, console, etc.) */
export type OnStage = (event: StageEvent) => void;

/**
 * Compute a 0-100 confidence score based on how much pipeline intelligence
 * was activated and verified for this lead.
 *
 * - gate_status pass:           +40
 * - verified (within retries):  +20
 * - stealth_premium detected:   +10
 * - cultural_context activated:  +10
 * - competition handling:        +10
 * - concern traceability:        +10
 */
function computeConfidence(
  gate: GateResult,
  verified: boolean,
  classification: Classification,
): number {
  let score = 0;

  if (gate.gate_status === "pass") score += 40;
  if (verified) score += 20;
  if (classification.stealth_premium) score += 10;
  if (classification.cultural_context_active) score += 10;
  if (classification.competition_quote_count > 0) score += 10;

  // All concerns traced to draft sentences, or no concerns to trace
  const allTraced =
    gate.concern_traceability.length === 0 ||
    gate.concern_traceability.every((ct) => ct.draft_sentence !== "");
  if (allTraced) score += 10;

  return score;
}

/**
 * Run the full 5-stage pipeline: classify → price → context → generate → verify.
 *
 * @param rawText  - The raw lead text (email body, form submission, etc.)
 * @param onStage  - Optional callback for progress updates (SSE streaming, console logs)
 * @param platform - Optional platform source (stamped on classification for policy rules)
 * @returns PipelineOutput with classification, pricing, drafts, gate, and confidence score
 */
export async function runPipeline(
  rawText: string,
  onStage?: OnStage,
  platform?: Classification["platform"],
): Promise<PipelineOutput> {
  const timing: Record<string, number> = {};
  const totalStart = Date.now();
  const today = getTodayISO();

  // --- Stage 1: Classification ---
  onStage?.({ stage: 1, name: "classify", status: "running" });
  let start = Date.now();
  const classification = await classifyLead(rawText, today);
  if (platform) classification.platform = platform;
  timing.classify = Date.now() - start;
  onStage?.({
    stage: 1, name: "classify", status: "done",
    ms: timing.classify, result: classification,
  });

  // --- Stage 2: Pricing + Budget Gap ---
  onStage?.({ stage: 2, name: "price", status: "running" });
  start = Date.now();
  let pricing = lookupPrice(classification);
  // Detect budget gap and attach to pricing result
  pricing.budget = detectBudgetGap(
    classification.stated_budget,
    pricing.floor,
    pricing.format,
    pricing.duration_hours,
    pricing.tier_key,
  );
  // Enrich classification (may override format, tier, close_type)
  const enriched = enrichClassification(classification, pricing, today);
  // Re-price if enrichment changed the format (e.g., mariachi_4piece → mariachi_full)
  if (enriched.format_recommended !== classification.format_recommended) {
    pricing = lookupPrice(enriched);
    pricing.budget = detectBudgetGap(
      enriched.stated_budget,
      pricing.floor,
      pricing.format,
      pricing.duration_hours,
      pricing.tier_key,
    );
  }
  timing.price = Date.now() - start;
  onStage?.({
    stage: 2, name: "price", status: "done",
    ms: timing.price, result: pricing,
  });

  // --- Stage 3: Context Assembly ---
  onStage?.({ stage: 3, name: "context", status: "running" });
  start = Date.now();
  const context = await selectContext(enriched);
  timing.context = Date.now() - start;
  onStage?.({
    stage: 3, name: "context", status: "done",
    ms: timing.context, result: { length: context.length },
  });

  // --- Stage 4+5: Generate + Verify ---
  onStage?.({ stage: 4, name: "generate", status: "running" });
  onStage?.({ stage: 5, name: "verify", status: "running" });
  start = Date.now();
  const { drafts, gate, verified } = await runWithVerification(
    enriched, pricing, context,
  );
  timing.generateAndVerify = Date.now() - start;
  onStage?.({ stage: 4, name: "generate", status: "done", ms: timing.generateAndVerify });
  onStage?.({ stage: 5, name: "verify", status: "done", ms: timing.generateAndVerify });

  timing.total = Date.now() - totalStart;

  const confidence_score = computeConfidence(gate, verified, enriched);

  return {
    classification: enriched, pricing, drafts, gate, verified, timing, confidence_score,
  };
}

/** Result of an edit pipeline run (context → generate with instructions → verify). */
export interface EditPipelineResult {
  drafts: Drafts;
  gate: GateResult;
}

/**
 * Re-run the generate+verify stages with edit instructions.
 * Used for SMS edit replies — classification and pricing are reused from the
 * original pipeline run, only context assembly + generation + verification re-run.
 */
export async function runEditPipeline(
  classification: Classification,
  pricing: PricingResult,
  instructions: string,
): Promise<EditPipelineResult> {
  const context = await selectContext(classification);
  const drafts = await generateResponse(classification, pricing, context, [instructions]);
  const gate = await verifyGate(drafts, classification, pricing);
  return { drafts, gate };
}
