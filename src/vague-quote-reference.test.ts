import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildGeneratePrompt } from "./prompts/generate.js";
import { defaultVagueFormat } from "./pipeline/classify.js";
import { NO_DATE_TERMS, type PaymentTerms } from "./pipeline/payment-terms.js";
import { COI_SENTENCES } from "./pipeline/coi.js";
import { PAYMENT_SENTENCES } from "./pipeline/payment-terms.js";
import { GENERATE_CASES, generatePromptOf, sha256 } from "./generate-prompt-cases.js";
import { readFileSync } from "node:fs";
import { VAGUE_QUOTE_REFERENCE_REPLY } from "./data/vague-quote-reference.js";
import { sharedWindows, summarizeRoute, type RouteRecord } from "./route-metrics.js";
import type { Classification, PricingResult } from "./types.js";

// Plan docs/plans/2026-10-13-feat-vague-lead-quote-with-question-plan.md (Revision 1b), V1-V7. Names start
// "Vague Reference V<n>". The block is a reference for a vague lead whose default format is quoted with one question.
const MARKER = "REFERENCE LEAD: VAGUE REQUEST";
// SHA-256 of src/prompts/classify.ts at 73fd38e (before the vague-lead route). Refresh only in a "snapshot refresh:" commit.
const CLASSIFY_PROMPT_SHA256 = "eb8c9b545d4e15ad2b782a86fd3c1d99744b04f2f66eaabfc0f30887a7c49d7d";
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
    const step4 = b.split("\n").find((l) => l.startsWith("4. ")) ?? "";
    const question = b.split("\n").find((l) => l.startsWith("THE QUESTION:")) ?? "";
    for (const [label, line] of [["step 4", step4], ["THE QUESTION paragraph", question]] as const) {
      assert.match(line, /this lead's own/i, label);
      assert.match(line, /not the example's/i, label);
    }
    assert.match(question, /exactly one question mark/);
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

describe("Vague Reference V6: a category-only vague lead gets the default format in code; an ensemble keeps unresolved", () => {
  const vague = (over: Partial<Classification> = {}) =>
    ({ ...c8.classification, action: "one_question", vagueness: "vague", format_recommended: "unresolved", ...over }) as Classification;

  it("Vague Reference V6 category-only text defaults to solo (incl. the 'how many players' lead)", () => {
    for (const text of ["Hi, we want live music for my parents' 30th anniversary in the spring. Not sure what kind of music would work or how many players. Any ideas?",
      "We have a group of 30 friends and want some live music.", "Live music for a group of family members, any ideas?",
      "Looking for some live music for a party.", "Need entertainment for an event next month.", "Do you play Latin music?", "Spanish guitar for a birthday?"]) {
      assert.equal(defaultVagueFormat(vague(), text).format_recommended, "solo", text);
    }
  });

  it("Vague Reference V6 a dinner, cocktail hour or dancing setting defaults to duo", () => {
    for (const text of ["Music for a dinner party, not sure what.", "Something for the cocktail hour at our wedding.", "We want live music and dancing."]) {
      assert.equal(defaultVagueFormat(vague(), text).format_recommended, "duo", text);
    }
  });

  for (const ensemble of ["Latin band", "a band", "a trio", "a quartet", "an orchestra", "an ensemble", "a group"]) {
    it(`Vague Reference V6 "${ensemble}" stays unresolved`, () => {
      assert.equal(defaultVagueFormat(vague(), `Looking for ${ensemble} for our company party.`).format_recommended, "unresolved");
      assert.equal(defaultVagueFormat(vague({ format_requested: ensemble }), "Live music please.").format_recommended, "unresolved");
    });
  }

  it("Vague Reference V6 the input is returned unchanged for a quote, a resolved format or a clear lead (overshoot controls)", () => {
    const text = "Looking for live music.";
    assert.equal(defaultVagueFormat(vague({ action: "quote" }), text).format_recommended, "unresolved");
    assert.equal(defaultVagueFormat(vague({ format_recommended: "mariachi_full" }), text).format_recommended, "mariachi_full");
    assert.equal(defaultVagueFormat(vague({ format_recommended: "flamenco_duo" }), text).format_recommended, "flamenco_duo");
    assert.equal(defaultVagueFormat(vague({ vagueness: "clear" }), text).format_recommended, "unresolved");
    assert.equal(defaultVagueFormat(vague({ action: "assume_and_quote" }), text).format_recommended, "unresolved");
  });

  it("Vague Reference V6 the action and vagueness are left as the classifier set them", () => {
    const out = defaultVagueFormat(vague(), "Looking for live music.");
    assert.equal(out.action, "one_question");
    assert.equal(out.vagueness, "vague");
  });

  it("Vague Reference V6b the classifier prompt is untouched (no ordinary lead can drift through it)", () => {
    const sha = sha256(readFileSync("src/prompts/classify.ts", "utf-8"));
    assert.equal(sha, CLASSIFY_PROMPT_SHA256);
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

describe("Vague Reference V8: the shared-window instrumentation (not an acceptance gate)", () => {
  const mandated = [PAYMENT_SENTENCES.noDate, COI_SENTENCES.default, "Send me the date once you have it and I'll check my calendar."];

  it("Vague Reference V8a a planted 40-character clause shared with the example is found", () => {
    const planted = "the usual mistake is booking by headcount";
    assert.ok(planted.length >= 40);
    assert.ok(sharedWindows(`Hi Sam, here is my take. ${planted}, so listen first. Alex Guillen`, VAGUE_QUOTE_REFERENCE_REPLY, mandated) > 0);
  });

  it("Vague Reference V8b unrelated text shares nothing", () => {
    assert.equal(sharedWindows("A spring evening on a patio, two hours, one guitar, a question about the music. Alex Guillen", VAGUE_QUOTE_REFERENCE_REPLY, mandated), 0);
  });

  it("Vague Reference V8c the app-mandated sentences alone share nothing (positive control: the cut works)", () => {
    assert.equal(sharedWindows(mandated.join(" "), VAGUE_QUOTE_REFERENCE_REPLY, mandated), 0);
    // without the cut the same text WOULD share windows with the example, so the control is not vacuous
    assert.ok(sharedWindows(mandated.join(" "), VAGUE_QUOTE_REFERENCE_REPLY, []) > 0);
  });
});

describe("Vague Reference V9: the report's formulas and denominators", () => {
  const route = (over: Partial<RouteRecord> = {}): RouteRecord => ({ action: "one_question", format_recommended: "solo", quote_price: 700,
    question_count: 1, price_figure_present: true, payment_kind: "sentence", payment_sentence_count: 1, coi_kind: "sentence",
    coi_sentence_count: 1, footer: false, shared_windows: 0, ...over });

  it("Vague Reference V9 the COI denominator counts a quote and excludes a graceful decline, a clarification and a residency (kind none)", () => {
    const s = summarizeRoute([
      { ok: true, verified: true, route: route() },
      { ok: true, verified: true, route: route({ coi_kind: "none", coi_sentence_count: 0 }) },
      { ok: true, verified: false, route: route({ coi_sentence_count: 0 }) },
    ]);
    assert.deepEqual(s.coi_sentence_once, { num: 1, den: 2 });
  });

  it("Vague Reference V9 each formula uses its own denominator", () => {
    const s = summarizeRoute([
      { ok: true, verified: true, route: route() },
      { ok: true, verified: false, route: route({ question_count: 2, price_figure_present: false, footer: true, shared_windows: 3 }) },
      { ok: true, verified: false, route: route({ format_recommended: "unresolved", quote_price: null, price_figure_present: false, payment_kind: "none", coi_kind: "none" }) },
      { ok: false },
    ]);
    assert.equal(s.runs, 4);
    assert.deepEqual(s.returned, { num: 3, den: 4 });
    assert.deepEqual(s.classifier_distribution, { solo: 2, unresolved: 1, "no classification": 1 });
    assert.deepEqual(s.quote_at_app_price, { num: 1, den: 2 });          // resolved-format returned drafts only
    assert.deepEqual(s.verified, { num: 1, den: 3 });
    assert.deepEqual(s.exactly_one_question, { num: 2, den: 3 });
    assert.deepEqual(s.payment_sentence_once, { num: 2, den: 2 });        // payment kind "sentence" only
    assert.deepEqual(s.no_footer, { num: 2, den: 3 });
    assert.deepEqual(s.shared_windows, { max: 3, drafts_above_zero: 1, of: 3 });
  });
});
