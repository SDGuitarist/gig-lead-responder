import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildGeneratePrompt } from "./prompts/generate.js";
import { buildClassifyPrompt } from "./prompts/classify.js";
import { NO_DATE_TERMS, type PaymentTerms } from "./pipeline/payment-terms.js";
import { COI_SENTENCES } from "./pipeline/coi.js";
import { PAYMENT_SENTENCES } from "./pipeline/payment-terms.js";
import { GENERATE_CASES, generatePromptOf, sha256 } from "./generate-prompt-cases.js";
import { readFileSync } from "node:fs";
import { VAGUE_QUOTE_REFERENCE_REPLY } from "./data/vague-quote-reference.js";
import type { Classification, PricingResult } from "./types.js";

// Plan docs/plans/2026-10-13-feat-vague-lead-quote-with-question-plan.md (Revision 1b), V1-V7. Names start
// "Vague Reference V<n>". The block is a reference for a vague lead whose default format is quoted with one question.
const MARKER = "REFERENCE LEAD: VAGUE REQUEST";
const c8 = GENERATE_CASES.find((c) => c.id === "C8");
assert.ok(c8);

const promptWith = (over: Partial<Classification> = {}, terms: PaymentTerms = NO_DATE_TERMS, pricingOver: Partial<PricingResult> = {}) =>
  buildGeneratePrompt({ ...c8.classification, ...over } as Classification, { ...c8.pricing, ...pricingOver } as PricingResult, "ctx", terms);
const has = (prompt: string) => prompt.includes(MARKER);

describe("Vague Reference V1: the block applies to a vague lead whose default format is quoted", () => {
  it("Vague Reference V1 a one_question, vague, solo lead with sentence terms gets the block exactly once", () => {
    const prompt = promptWith();
    assert.equal(prompt.split(MARKER).length - 1, 1);
    // after the voice examples and before the reasoning step
    assert.ok(prompt.indexOf("## VOICE EXAMPLES") < prompt.indexOf(MARKER), "after the voice examples");
    assert.ok(prompt.indexOf(MARKER) < prompt.indexOf("## STEP 1"), "before the reasoning step");
  });

  it("Vague Reference V1 duo applies too, and so do coi_required and a small budget gap (positive controls)", () => {
    assert.ok(has(promptWith({ format_recommended: "duo" })));
    assert.ok(has(promptWith({ coi_required: true })));
    assert.ok(has(promptWith({}, NO_DATE_TERMS, { budget: { tier: "small", gap: 100 } })));
  });
});

describe("Vague Reference V2: each withheld condition removes the block on its own", () => {
  const withheld: Array<[string, () => string]> = [
    ["clarification (unresolved)", () => promptWith({ format_recommended: "unresolved" })],
    ["quote", () => promptWith({ action: "quote", vagueness: "clear" })],
    ["assume_and_quote", () => promptWith({ action: "assume_and_quote" })],
    ["clear vagueness", () => promptWith({ vagueness: "clear" })],
    ["a graceful decline", () => promptWith({ graceful_decline: true })],
    ["a past date", () => promptWith({ past_date_detected: true })],
    ["a large budget gap", () => promptWith({}, NO_DATE_TERMS, { budget: { tier: "large", gap: 500, scoped_alternative: { format: "solo", duration_hours: 1, price: 400 } } as never })],
    ["no_viable_scope", () => promptWith({}, NO_DATE_TERMS, { budget: { tier: "no_viable_scope", gap: 400 } })],
    ["a residency", () => promptWith({}, NO_DATE_TERMS, { residency: { tier: "R2", cadence: "weekly", hours: 2, rate: 300, floor: 250, reason: null } })],
    ["GigSalad platform payment", () => promptWith({ platform: "gigsalad" }, { kind: "platform" })],
    ["The Bash platform payment", () => promptWith({ platform: "thebash" }, { kind: "platform" })],
    ["an unknown-platform lead", () => promptWith({}, { kind: "unknown_platform" })],
    ["a nonprofit buyer", () => promptWith({ nonprofit_buyer: true })],
    ["cultural context active", () => promptWith({ cultural_context_active: true, cultural_tradition: "spanish_latin" })],
    ["sourced delivery", () => promptWith({ delivery_mode: "alex_sources" })],
    ["hybrid delivery", () => promptWith({ delivery_mode: "hybrid" })],
    ["a format other than solo or duo", () => promptWith({ format_recommended: "mariachi_full" })],
    ["a T4 lead (it has its own reference)", () => promptWith({ rate_card_tier: "T4" })],
  ];
  for (const [label, build] of withheld) {
    it(`Vague Reference V2 ${label}: the block is withheld`, () => { assert.equal(has(build()), false); });
  }
});

describe("Vague Reference V3 / V4 / V5: the example and the rules", () => {
  const block = () => {
    const prompt = promptWith();
    return prompt.slice(prompt.indexOf(MARKER), prompt.indexOf("## STEP 1"));
  };

  it("Vague Reference V3 the example keeps the price as a placeholder and carries no phone, footer or business name", () => {
    const reply = VAGUE_QUOTE_REFERENCE_REPLY;
    assert.match(reply, /\[QUOTED_PRICE\]/);
    assert.ok(!/\$\s?\d/.test(reply), "no dollar figure");
    assert.ok(!/\(\d{3}\)\s?\d{3}/.test(reply), "no phone number");
    assert.ok(!/Pacific Flow/.test(reply), "no business name");
    assert.ok(reply.trimEnd().endsWith("Alex Guillen"), "signs with the name only");
    assert.ok(reply.startsWith("Hi Dana,"), "opens with the name (Alex's choice (a))");
  });

  it("Vague Reference V4 the block says the Quote Terms sentences come from Quote Terms, the question is this lead's own, and no other sentence is reused", () => {
    const b = block();
    assert.match(b, /Quote Terms section/);
    assert.match(b, /copy(?:ied)? (?:them )?exactly/i);
    assert.match(b, /this lead's own/i);
    assert.match(b, /not the example's/i);
    assert.match(b, /No other sentence of the example may appear/);
  });

  it("Vague Reference V5 the example carries the app's payment and COI sentences once each, Alex's date sentence once, and one question mark", () => {
    const reply = VAGUE_QUOTE_REFERENCE_REPLY;
    const once = (needle: string) => assert.equal(reply.split(needle).length - 1, 1, needle);
    once(PAYMENT_SENTENCES.noDate);
    once(COI_SENTENCES.default);
    once("Send me the date once you have it and I'll check my calendar.");
    assert.equal((reply.match(/\?/g) ?? []).length, 1);
    assert.ok(!reply.includes(COI_SENTENCES.required), "not the timeline COI sentence");
  });
});

describe("Vague Reference V6: the classifier splits a category-only request from an explicit ensemble", () => {
  const prompt = buildClassifyPrompt("2026-10-12");
  const special = prompt.slice(prompt.indexOf("SPECIAL CASE"), prompt.indexOf("### Step 2.75"));

  it("Vague Reference V6 a category-only request defaults to solo or duo and is told NOT to use unresolved", () => {
    assert.match(special, /CATEGORY-ONLY/);
    assert.match(special, /format_recommended = "solo"/);
    assert.match(special, /duo/);
    assert.match(special, /Do NOT use "unresolved"/);
  });

  it("Vague Reference V6 an explicit ensemble keeps unresolved", () => {
    assert.match(special, /EXPLICIT ENSEMBLE/);
    assert.match(special, /"Latin band"/);
    assert.match(special, /format_recommended = "unresolved"/);
  });
});

describe("Vague Reference V7: only the cases the block is meant to change change", () => {
  const hashes = JSON.parse(readFileSync("src/fixtures/generate-prompt-hashes.json", "utf-8")) as Record<string, string>;
  const CHANGED = new Set(["C8", "C15", "C16"]);
  for (const c of GENERATE_CASES) {
    if (c.id === "C0-outside-spans") continue;
    it(`Vague Reference V7 ${c.id} (${c.what}) ${CHANGED.has(c.id) ? "DIFFERS from" : "equals"} its stored hash`, () => {
      const now = sha256(generatePromptOf(c.id));
      if (CHANGED.has(c.id)) assert.notEqual(now, hashes[c.id]);
      else assert.equal(now, hashes[c.id]);
    });
  }
});
