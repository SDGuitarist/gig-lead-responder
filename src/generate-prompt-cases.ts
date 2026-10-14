// The bounded classification inventory for the generate-prompt hashes and the arm manifest (plan
// docs/plans/2026-10-13-fix-clarification-draft-shape-plan.md, "The hash inventory", C0-C12). The classifications are
// those of src/verify-prompt-cases.ts (S0-S12) with one fixed PricingResult each. Not imported by the app.
import { createHash } from "node:crypto";
import { buildGeneratePrompt } from "./prompts/generate.js";
import { NO_DATE_TERMS, type PaymentTerms } from "./pipeline/payment-terms.js";
import type { Classification, PricingResult } from "./types.js";
import { VERIFY_CASES } from "./verify-prompt-cases.js";

export interface GenerateCase {
  id: string;
  what: string;
  classification: Classification;
  pricing: PricingResult;
  terms: PaymentTerms;
}

export const GENERATE_CONTEXT = "ctx";

export const GENERATE_CASES: GenerateCase[] = VERIFY_CASES.map((c) => ({
  id: `C${c.id.slice(1)}`,
  what: c.what,
  classification: c.classification,
  pricing: {
    format: c.classification.format_recommended, duration_hours: 2, tier_key: "T2P", anchor: 500, floor: 400,
    quote_price: 500, competition_position: "at anchor", budget: c.pricing.budget,
    ...(c.pricing.residency ? { residency: c.pricing.residency } : {}),
  } as PricingResult,
  terms: c.classification.platform === "gigsalad" ? { kind: "platform" } : NO_DATE_TERMS,
}));

export function generatePromptOf(id: string): string {
  const c = GENERATE_CASES.find((x) => x.id === id);
  if (!c) throw new Error(`generate case ${id} not found`);
  return buildGeneratePrompt(c.classification, c.pricing, GENERATE_CONTEXT, c.terms);
}

export const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

/** SHA-256 of the clarification-mode (C0) generate prompt: the prompt identity recorded in an arm manifest. */
export function probePromptSha256(): string {
  return sha256(generatePromptOf("C0"));
}

/**
 * The three spans plan 2 changes, found by literal anchors, each exactly once (the function throws otherwise):
 *   steps  = from the line beginning `1. **` up to, excluding, the line beginning `4. **` (the 5-step list, steps 1-3)
 *   words  = the line beginning `- Word count:`
 *   retain = the line beginning `- Must retain:`
 * Returns the prompt with each span replaced by a marker line, so what is left is "the prompt outside the spans".
 */
export function removeSpans(prompt: string): string {
  const lines = prompt.split("\n");
  const only = (re: RegExp, label: string) => {
    const at = lines.flatMap((l, i) => (re.test(l) ? [i] : []));
    if (at.length !== 1) throw new Error(`span anchor ${label}: found ${at.length} lines, expected 1`);
    return at[0];
  };
  const stepsFrom = only(/^1\. \*\*/, "steps start");
  const stepsTo = only(/^4\. \*\*/, "steps end");
  if (stepsTo <= stepsFrom) throw new Error("span anchor steps: end is before start");
  const words = only(/^- Word count:/, "words");
  const retain = only(/^- Must retain:/, "retain");
  const out: string[] = [];
  lines.forEach((l, i) => {
    if (i === stepsFrom) out.push("[span:steps]");
    else if (i > stepsFrom && i < stepsTo) return;
    else if (i === words) out.push("[span:words]");
    else if (i === retain) out.push("[span:retain]");
    else out.push(l);
  });
  return out.join("\n");
}

/** The text of the three spans (same anchors as removeSpans; throws unless each is found exactly once). */
export function spansOf(prompt: string): { steps: string; words: string; retain: string } {
  const lines = prompt.split("\n");
  const only = (re: RegExp, label: string) => {
    const at = lines.flatMap((l, i) => (re.test(l) ? [i] : []));
    if (at.length !== 1) throw new Error(`span anchor ${label}: found ${at.length} lines, expected 1`);
    return at[0];
  };
  const from = only(/^1\. \*\*/, "steps start");
  const to = only(/^4\. \*\*/, "steps end");
  if (to <= from) throw new Error("span anchor steps: end is before start");
  return {
    steps: lines.slice(from, to).join("\n"),
    words: lines[only(/^- Word count:/, "words")],
    retain: lines[only(/^- Must retain:/, "retain")],
  };
}
