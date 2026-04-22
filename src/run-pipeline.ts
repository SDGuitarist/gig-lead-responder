import { classifyLead } from "./pipeline/classify.js";
import { lookupPrice, detectBudgetGap } from "./pipeline/price.js";
import { enrichClassification } from "./pipeline/enrich.js";
import { getTodayISO } from "./utils/dates.js";
import { selectContext } from "./pipeline/context.js";
import { generateResponse } from "./pipeline/generate.js";
import { verifyGate, runWithVerification } from "./pipeline/verify.js";
import { lookupVenueContext } from "./venue-lookup.js";
import { extractZipFromAddress, lookupTravelFee } from "./travel-fee.js";
import { checkHardGate } from "./pipeline/hard-gate.js";
import { postCheckDrafts } from "./pipeline/post-check.js";
import { logVenueMiss } from "./db/index.js";
import type { Classification, Drafts, GateResult, PipelineOutput, PricingResult, TravelFeeData, VenueContext } from "./types.js";

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
  const MAX_RAW_TEXT_LENGTH = 50_000;
  if (rawText.length > MAX_RAW_TEXT_LENGTH) {
    const originalLength = rawText.length;
    rawText = rawText.slice(0, MAX_RAW_TEXT_LENGTH);
    console.warn(`Truncated lead text from ${originalLength} to ${MAX_RAW_TEXT_LENGTH} chars`);
  }

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

  // --- Hard gate (deterministic checks — format mismatch, red flags) ---
  const hardGate = checkHardGate(classification, rawText);

  // Attach red flag warnings to classification so downstream stages see them
  if (hardGate.flags.length > 0) {
    classification.flagged_concerns = [
      ...classification.flagged_concerns,
      ...hardGate.flags,
    ];
  }

  // If hard gate fails, skip AI stages entirely — return template decline
  if (!hardGate.pass) {
    timing.total = Date.now() - totalStart;
    const declineText = hardGate.decline_draft || "This lead requires manual review.";
    return {
      classification,
      pricing: {
        format: classification.format_recommended,
        duration_hours: classification.duration_hours,
        tier_key: "T2P",
        anchor: 0,
        floor: 0,
        quote_price: 0,
        competition_position: "n/a — hard gate decline",
        budget: { tier: "none" },
      },
      drafts: {
        full_draft: declineText,
        compressed_draft: declineText,
        compressed_word_count: declineText.split(/\s+/).filter(Boolean).length,
      },
      gate: {
        validation_line: "",
        best_line: "",
        concern_traceability: [],
        scene_quote: "",
        scene_type: "structural",
        competitor_test: false,
        gut_checks: {
          can_see_it: false, validated_them: false, named_fear: false,
          differentiated: false, preempted_questions: false, creates_relief: false,
          best_line_present: false, prose_flows: false, competitor_test: false,
          lead_specific_opening: false, budget_acknowledged: false,
          past_date_acknowledged: false, mariachi_pricing_format: false,
          cultural_vocabulary_used: false, sounds_like_alex: false,
          genre_default_stated: false, timeline_acknowledged: false,
          compressed_validation_present: false,
        },
        gate_status: "fail",
        fail_reasons: hardGate.fail_reasons,
      },
      verified: false,
      timing,
      confidence_score: 0,
    };
  }

  // --- Travel lookup (between classify and price — deterministic, no AI) ---
  let travelData: TravelFeeData | null = null;
  const zip = extractZipFromAddress(rawText);
  if (zip) {
    const travelResult = lookupTravelFee(zip);
    if (travelResult.type === "hit") {
      travelData = travelResult.data;
    }
    // miss or error: no travel data, pricing proceeds without travel component
  }

  // --- Stage 2: Pricing + Budget Gap ---
  onStage?.({ stage: 2, name: "price", status: "running" });
  start = Date.now();
  let pricing = lookupPrice(classification, travelData);
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
    pricing = lookupPrice(enriched, travelData);
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

  // --- Venue Lookup (between Stage 2 and 3) ---
  let venueContext: VenueContext | null = null;
  if (enriched.venue_name) {
    const result = await lookupVenueContext(enriched.venue_name);
    if (result.type === "hit") venueContext = result.data;
    if (result.type === "miss") logVenueMiss(enriched.venue_name, undefined);
    // type === "error": logged inside lookupVenueContext, no miss record
  }

  // --- Stage 3: Context Assembly ---
  onStage?.({ stage: 3, name: "context", status: "running" });
  start = Date.now();
  const context = await selectContext(enriched, venueContext);
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

  // --- Post-check (deterministic — auto-fix em dashes, flag banned phrases) ---
  const postCheck = postCheckDrafts(
    drafts.full_draft,
    drafts.compressed_draft,
    enriched.platform,
  );

  // Apply auto-fixes (em dashes replaced with commas)
  const cleanedDrafts: Drafts = {
    full_draft: postCheck.full_draft,
    compressed_draft: postCheck.compressed_draft,
    compressed_word_count: drafts.compressed_word_count,
  };

  // Append code-detected violations to gate fail_reasons
  const finalGate: GateResult = postCheck.violations.length > 0
    ? {
        ...gate,
        gate_status: "fail",
        fail_reasons: [...gate.fail_reasons, ...postCheck.violations],
      }
    : gate;

  const finalVerified = verified && postCheck.violations.length === 0;

  timing.total = Date.now() - totalStart;

  const confidence_score = computeConfidence(finalGate, finalVerified, enriched);

  return {
    classification: enriched,
    pricing,
    drafts: cleanedDrafts,
    gate: finalGate,
    verified: finalVerified,
    timing,
    confidence_score,
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
  // Backward compat: old classification records stored before C1 lack venue_name
  classification.venue_name = classification.venue_name ?? null;

  let venueContext: VenueContext | null = null;
  if (classification.venue_name) {
    const result = await lookupVenueContext(classification.venue_name);
    if (result.type === "hit") venueContext = result.data;
    if (result.type === "miss") logVenueMiss(classification.venue_name, undefined);
  }

  const context = await selectContext(classification, venueContext);
  const drafts = await generateResponse(classification, pricing, context, [instructions]);
  const gate = await verifyGate(drafts, classification, pricing);

  // Post-check: auto-fix em dashes, flag banned phrases
  const postCheck = postCheckDrafts(drafts.full_draft, drafts.compressed_draft, classification.platform);
  const cleanedDrafts: Drafts = {
    full_draft: postCheck.full_draft,
    compressed_draft: postCheck.compressed_draft,
    compressed_word_count: drafts.compressed_word_count,
  };
  const finalGate: GateResult = postCheck.violations.length > 0
    ? { ...gate, gate_status: "fail", fail_reasons: [...gate.fail_reasons, ...postCheck.violations] }
    : gate;

  return { drafts: cleanedDrafts, gate: finalGate };
}
