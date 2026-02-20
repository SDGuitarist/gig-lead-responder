import "dotenv/config";
import { classifyLead } from "./pipeline/classify.js";
import { lookupPrice } from "./pipeline/price.js";
import { selectContext } from "./pipeline/context.js";
import { runWithVerification } from "./pipeline/verify.js";
import type { PipelineOutput } from "./types.js";

// Validate API key on startup
if (!process.env.ANTHROPIC_API_KEY) {
  console.error("Error: ANTHROPIC_API_KEY not set in .env file");
  process.exit(1);
}

const verbose = process.argv.includes("--verbose");
const jsonMode = process.argv.includes("--json");

async function main() {
  const totalStart = Date.now();
  const timing: Record<string, number> = {};

  // Read lead from stdin
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  const rawText = Buffer.concat(chunks).toString("utf-8").trim();

  if (!rawText) {
    console.error("Error: No lead text provided. Pipe text via stdin:");
    console.error("  echo 'lead text...' | npx tsx src/index.ts");
    process.exit(1);
  }

  // --- Stage 1: Classification ---
  if (!jsonMode) console.log("\n[1/5] Classifying lead...");
  let start = Date.now();
  const classification = await classifyLead(rawText);
  timing.classify = Date.now() - start;
  if (verbose && !jsonMode) {
    console.log(JSON.stringify(classification, null, 2));
  }

  // --- Stage 2: Pricing ---
  if (!jsonMode) console.log("[2/5] Looking up pricing...");
  start = Date.now();
  const pricing = lookupPrice(classification);
  timing.price = Date.now() - start;
  if (verbose && !jsonMode) {
    console.log(JSON.stringify(pricing, null, 2));
  }

  // --- Stage 3: Context Assembly ---
  if (!jsonMode) console.log("[3/5] Assembling context...");
  start = Date.now();
  const context = await selectContext(classification);
  timing.context = Date.now() - start;
  if (verbose && !jsonMode) {
    console.log(`Context assembled: ${context.length} characters`);
  }

  // --- Stage 4+5: Generate + Verify ---
  if (!jsonMode) console.log("[4/5] Generating response drafts...");
  if (!jsonMode) console.log("[5/5] Running verification gate...");
  start = Date.now();
  const { drafts, gate, verified } = await runWithVerification(classification, pricing, context);
  timing.generateAndVerify = Date.now() - start;

  timing.total = Date.now() - totalStart;

  // --- Output ---
  if (jsonMode) {
    const output: PipelineOutput = { classification, pricing, drafts, gate, verified, timing };
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  // Formatted output
  console.log("\n" + "=".repeat(60));
  console.log("CLASSIFICATION SUMMARY");
  console.log("=".repeat(60));
  console.log(`Mode:          ${classification.mode}`);
  console.log(`Competition:   ${classification.competition_level} (${classification.competition_quote_count} quotes)`);
  console.log(`Stealth Prem:  ${classification.stealth_premium ? "YES — " + classification.stealth_premium_signals.join(", ") : "No"}`);
  console.log(`Tier:          ${classification.tier} → Rate Card ${classification.rate_card_tier}`);
  console.log(`Format:        ${classification.format_requested} → ${classification.format_recommended}`);
  console.log(`Duration:      ${classification.duration_hours}hr`);
  console.log(`Cultural:      ${classification.cultural_context_active ? classification.cultural_tradition : "N/A"}`);
  console.log(`Timeline:      ${classification.timeline_band} → ${classification.close_type} close`);
  if (classification.flagged_concerns.length > 0) {
    console.log(`Concerns:      ${classification.flagged_concerns.join(", ")}`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("PRICING");
  console.log("=".repeat(60));
  console.log(`Format:   ${pricing.format} | ${pricing.duration_hours}hr | ${pricing.tier_key}`);
  console.log(`Anchor:   $${pricing.anchor}`);
  console.log(`Floor:    $${pricing.floor}`);
  console.log(`Quote:    $${pricing.quote_price} (${pricing.competition_position})`);

  console.log("\n" + "=".repeat(60));
  console.log("FULL DRAFT");
  console.log("=".repeat(60));
  console.log(drafts.full_draft);

  console.log("\n" + "=".repeat(60));
  console.log(`COMPRESSED DRAFT (${drafts.compressed_word_count} words)`);
  console.log("=".repeat(60));
  console.log(drafts.compressed_draft);

  console.log("\n" + "=".repeat(60));
  console.log(`VERIFICATION GATE: ${gate.gate_status.toUpperCase()}${verified ? "" : " (unverified — best attempt)"}`);
  console.log("=".repeat(60));
  console.log(`Validation:    "${gate.validation_line}"`);
  console.log(`Best line:     "${gate.best_line}"`);
  console.log(`Scene type:    ${gate.scene_type}`);
  console.log(`Scene quote:   "${gate.scene_quote}"`);
  console.log(`Competitor:    ${gate.competitor_test ? "FAIL — could be any vendor" : "PASS — unique"}`);

  if (gate.concern_traceability.length > 0) {
    console.log("Concerns traced:");
    for (const ct of gate.concern_traceability) {
      const status = ct.draft_sentence ? "OK" : "MISSING";
      console.log(`  [${status}] ${ct.concern}`);
    }
  }

  const checks = gate.gut_checks;
  const passed = Object.values(checks).filter(Boolean).length;
  console.log(`Gut checks:    ${passed}/9 passed`);

  if (gate.fail_reasons.length > 0) {
    console.log("Fail reasons:");
    for (const reason of gate.fail_reasons) {
      console.log(`  - ${reason}`);
    }
  }

  console.log("\n" + "-".repeat(60));
  console.log(`Timing: classify ${timing.classify}ms | price ${timing.price}ms | context ${timing.context}ms | generate+verify ${timing.generateAndVerify}ms | total ${timing.total}ms`);
  console.log("-".repeat(60));
}

main().catch((err) => {
  console.error("Pipeline error:", err.message);
  if (process.argv.includes("--verbose")) {
    console.error(err.stack);
  }
  process.exit(1);
});
