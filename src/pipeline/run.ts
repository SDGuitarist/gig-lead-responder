import { classifyLead } from "./classify.js";
import { lookupPrice } from "./price.js";
import { selectContext } from "./context.js";
import { runWithVerification } from "./verify.js";
import type { PipelineOutput } from "../types.js";

/**
 * Optional hooks for progress reporting.
 * Server passes SSE callbacks; CLI and automation pass nothing.
 */
export interface PipelineHooks {
  onStageStart?(stage: number, name: string): void;
  onStageComplete?(stage: number, name: string, ms: number, result?: unknown): void;
}

/**
 * Run the full 5-stage pipeline: classify → price → context → generate → verify.
 * Shared by CLI, server, and future automation layer.
 */
export async function runPipeline(
  rawText: string,
  hooks?: PipelineHooks
): Promise<PipelineOutput> {
  const timing: Record<string, number> = {};
  const totalStart = Date.now();

  // Stage 1: Classification
  hooks?.onStageStart?.(1, "classify");
  let start = Date.now();
  const classification = await classifyLead(rawText);
  timing.classify = Date.now() - start;
  hooks?.onStageComplete?.(1, "classify", timing.classify, classification);

  // Stages 2+3: Pricing + Context (parallel — no dependency on each other)
  hooks?.onStageStart?.(2, "price");
  hooks?.onStageStart?.(3, "context");
  start = Date.now();
  const [pricing, context] = await Promise.all([
    Promise.resolve(lookupPrice(classification)),
    selectContext(classification),
  ]);
  timing.price = Date.now() - start;
  timing.context = timing.price; // ran in parallel, same wall time
  hooks?.onStageComplete?.(2, "price", timing.price, pricing);
  hooks?.onStageComplete?.(3, "context", timing.context, { length: context.length });

  // Stages 4+5: Generate + Verify (with rewrite loop)
  hooks?.onStageStart?.(4, "generate");
  hooks?.onStageStart?.(5, "verify");
  start = Date.now();
  const { drafts, gate, verified } = await runWithVerification(
    classification, pricing, context
  );
  timing.generateAndVerify = Date.now() - start;
  hooks?.onStageComplete?.(4, "generate", timing.generateAndVerify);
  hooks?.onStageComplete?.(5, "verify", timing.generateAndVerify, { gate, verified });

  timing.total = Date.now() - totalStart;

  return { classification, pricing, drafts, gate, verified, timing };
}
