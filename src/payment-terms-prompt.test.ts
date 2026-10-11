import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildGeneratePrompt } from "./prompts/generate.js";
import { lookupPrice } from "./pipeline/price.js";
import { PAYMENT_SENTENCES, paymentLine, type PaymentTerms } from "./pipeline/payment-terms.js";
import type { Classification, PricingResult } from "./types.js";

// Payment terms plan (2026-10-11), P7 and P8. P8's fixtures were captured from a clean worktree of 38acd73 by
// scripts/capture-prompt-baseline.ts; regenerate + `diff -r` is the provenance check (plan, P8).
const OLD_LINE = "- A 50% deposit holds the date. Say it plainly, once, near the price.";
const inputs = JSON.parse(readFileSync("src/fixtures/prompt-baseline-inputs.json", "utf-8")) as
  Array<{ name: string; context: string; classification: Classification }>;
const terms = (c: Classification): PaymentTerms =>
  c.platform === "gigsalad" ? { kind: "platform" } : { kind: "sentence", sentence: PAYMENT_SENTENCES.noDate };

describe("payment terms in the generate prompt", () => {
  it("P8: every other prompt line is byte-identical to the 38acd73 baseline", () => {
    for (const { name, context, classification } of inputs) {
      const before = readFileSync(`src/fixtures/prompt-baseline/${name}.txt`, "utf-8");
      assert.equal(before.split(OLD_LINE).length - 1, 1, `${name}: the old line occurs once in the baseline`);
      const t = terms(classification);
      const now = buildGeneratePrompt(classification, lookupPrice(classification), context, t);
      assert.equal(now, before.replace(OLD_LINE, paymentLine(t)), name);
    }
  });

  const c = inputs[0].classification;
  const pricing = lookupPrice(c);
  it("P7: a dated sentence appears in exactly one payment line, and the old line is gone", () => {
    const prompt = buildGeneratePrompt(c, pricing, "ctx", { kind: "sentence", sentence: PAYMENT_SENTENCES.full });
    assert.equal(prompt.split(PAYMENT_SENTENCES.full).length - 1, 1);
    assert.equal(prompt.split("- Payment:").length - 1, 1);
    assert.ok(!prompt.includes("Say it plainly, once, near the price"));
  });

  it("P7: platform says the platform handles it; unknown platform claims nothing; none has no payment line", () => {
    const platform = buildGeneratePrompt(c, pricing, "ctx", { kind: "platform" });
    assert.ok(platform.includes("- Payment: the platform handles payment."));
    const unknown = buildGeneratePrompt(c, pricing, "ctx", { kind: "unknown_platform" });
    assert.ok(unknown.includes("- Payment: say nothing about payment"));
    assert.ok(!unknown.includes("platform handles"));
    for (const p of [platform, unknown]) for (const s of Object.values(PAYMENT_SENTENCES)) assert.ok(!p.includes(s), s);
    const clar = { ...c, action: "one_question", format_recommended: "unresolved" } as Classification;
    assert.ok(!buildGeneratePrompt(clar, pricing as PricingResult, "ctx", { kind: "none" }).includes("- Payment:"));
  });
});
