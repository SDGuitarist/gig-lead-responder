import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { setClaudeRequesterForTests } from "./claude.js";
import { generateResponse } from "./pipeline/generate.js";
import { NO_DATE_TERMS } from "./pipeline/payment-terms.js";
import type { Classification, PricingResult } from "./types.js";

// Plan docs/plans/2026-10-13-fix-clarification-pricing-validator-plan.md (Revision 1b), V1-V10: the clarification-mode
// draft check rejects text matching the supported PRICE GRAMMAR and the internal pricing terms, not the bare words
// "quote" and "rate". Names start "Clarification V<n>" so `npm run test:match -- "Clarification V3"` runs one.
// The model is stubbed: generateResponse gets the draft the test hands it.
afterEach(() => setClaudeRequesterForTests());

const SIGN = "\n\nAlex Guillen";
const QUESTION = "Are you picturing something intimate and in the background, or more of a featured moment?";

function classification(over: Partial<Classification> = {}): Classification {
  return {
    mode: "evaluation", action: "one_question", vagueness: "vague", competition_level: "medium", competition_quote_count: 0,
    stealth_premium: false, stealth_premium_signals: [], tier: "standard", rate_card_tier: "T2", lead_source_column: "P",
    price_point: "slight_premium", format_requested: "Latin band", format_recommended: "unresolved", duration_hours: 2,
    stated_budget: null, timeline_band: "comfortable", close_type: "soft_hold", cultural_context_active: false,
    cultural_tradition: null, planner_effort_active: false, social_proof_active: false, context_modifiers: [],
    event_date_iso: null, event_energy: null, flagged_concerns: ["vague format request"], venue_name: null,
    client_first_name: "Alondra", delivery_mode: "alex_performs", ...over,
  } as Classification;
}
const clarificationPricing = (): PricingResult => ({
  format: "unresolved", duration_hours: 2, tier_key: "clarify", anchor: 0, floor: 0, quote_price: 0,
  competition_position: "clarify before quoting", budget: { tier: "none" },
} as PricingResult);

/** Stub the model to return exactly these two drafts, then run the generate step. */
async function run(full: string, compressed: string, c: Classification = classification(), p: PricingResult = clarificationPricing()) {
  setClaudeRequesterForTests((async () => ({
    id: "m", type: "message", role: "assistant", model: "stub", stop_reason: "end_turn", stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 1 },
    content: [{ type: "text", text: JSON.stringify({
      reasoning: { details_present: ["a birthday"], absences: ["format"], emotional_core: "wants the right energy",
        cinematic_opening: "A birthday changes once the music locks in.", validation_line: "You knew a playlist is not enough." },
      full_draft: full, compressed_draft: compressed,
    }) }],
  })) as never);
  return generateResponse(c, p, "ctx", NO_DATE_TERMS);
}
/** A clarification draft pair with one question and this sentence in both drafts. */
const both = (sentence: string): [string, string] => [
  `Hi Alondra,\n\n${sentence} ${QUESTION}${SIGN}`,
  `Hi Alondra, ${sentence} ${QUESTION}${SIGN}`,
];
const PRICING_LANGUAGE = /must not include pricing language/;
async function passes(sentence: string) {
  const [f, c] = both(sentence);
  const drafts = await run(f, c);
  assert.ok(drafts.full_draft.length > 0, sentence);
}
async function rejects(sentence: string) {
  const [f, c] = both(sentence);
  await assert.rejects(run(f, c), PRICING_LANGUAGE, sentence);
}

describe("Clarification V1 / V2: the bridge words are allowed", () => {
  it("Clarification V1 'Before I quote, one question' returns the drafts and does not throw", async () => {
    await passes("Before I quote, one question.");
  });

  it("Clarification V2 'quote' and 'rate' in ordinary use do not throw", async () => {
    for (const s of ["Before I send you a quote, one thing.", "That changes the format and the quote.", "I'll send a specific recommendation and a rate.",
      "Most vendors pick a format and quote it.", "My rate is high for a reason.", "I have a package for the evening."]) {
      await passes(s);
    }
  });
});

describe("Clarification V3 / V4: dollar figures and the internal terms are rejected", () => {
  it("Clarification V3 a dollar figure is rejected in every written form", async () => {
    for (const s of ["It starts at $1200.", "About $ 850 for that.", "Roughly $1,200 all in."]) await rejects(s);
  });

  it("Clarification V4a 'anchor' is rejected", async () => { await rejects("The anchor for this is a conversation."); });
  it("Clarification V4b 'floor' is rejected", async () => { await rejects("Our floor is a firm number."); });
  it("Clarification V4c 'investment' is rejected", async () => { await rejects("It is a modest investment for the night."); });
});

describe("Clarification V5: an amount with a currency marker is rejected", () => {
  it("Clarification V5 digits next to a currency word, or USD", async () => {
    for (const s of ["That runs 800 dollars.", "It is 1,500 bucks.", "Around 950 USD.", "USD 900 covers it."]) await rejects(s);
  });

  it("Clarification V5b a spelled-out amount next to a currency word", async () => {
    for (const s of ["It is a thousand dollars.", "One thousand dollars covers it.", "Fifteen hundred dollars all in."]) await rejects(s);
  });

  it("Clarification V5c a k amount", async () => {
    for (const s of ["It lands near 1.5k.", "Budget about 2k."]) await rejects(s);
  });
});

describe("Clarification V6: ordinary numbers are not prices", () => {
  it("Clarification V6 a guest count, a duration or a year does not throw", async () => {
    for (const s of ["For 100 guests that is a big room.", "Two hours or three hours is typical.", "This was a 2026 wedding.", "Plan on 1 to 2 hours of music.",
      "A hundred guests changes the setup."]) {
      await passes(s);
    }
  });
});

describe("Clarification V7: the error names the match and only the match", () => {
  const prefix = (field: string, match: string) => `Clarification mode ${field} must not include pricing language: "${match}"`;
  const messageOf = async (full: string, compressed: string) => {
    try { await run(full, compressed); } catch (e) { return String((e as Error).message); }
    return "";
  };

  it("Clarification V7 the full draft: exact message with the matched text", async () => {
    const msg = await messageOf(`Hi Alondra,\n\nIt starts at $1200 for the night. ${QUESTION}${SIGN}`, `Hi Alondra, ${QUESTION}${SIGN}`);
    assert.equal(msg, prefix("full_draft", "$1200"));
  });

  it("Clarification V7 the compressed draft: exact message with the matched text", async () => {
    const msg = await messageOf(`Hi Alondra,\n\nA nice evening. ${QUESTION}${SIGN}`, `Hi Alondra, that is 800 dollars. ${QUESTION}${SIGN}`);
    assert.equal(msg, prefix("compressed_draft", "800 dollars"));
  });

  it("Clarification V7 the message carries no other part of the draft", async () => {
    const secret = "The marigold-orchard pavilion booking";
    const msg = await messageOf(`Hi Alondra,\n\n${secret} is $1200. ${QUESTION}${SIGN}`, `Hi Alondra, ${QUESTION}${SIGN}`);
    assert.ok(!msg.includes(secret) && !msg.includes("marigold"), msg);
    assert.ok(msg.length <= prefix("full_draft", "$1200").length, "bounded by the field name plus the match");
  });
});

describe("Clarification V8 / V9: the scope and the question rule", () => {
  it("Clarification V8 a quoted (non-clarification) draft with the word quote and a dollar figure still returns", async () => {
    const quoted = classification({ action: "quote", vagueness: "clear", format_recommended: "solo" });
    const pricing = { ...clarificationPricing(), format: "solo", tier_key: "T2P", anchor: 500, floor: 400, quote_price: 500 } as PricingResult;
    const drafts = await run(`Hi Alondra,\n\nSolo guitar is $500 for two hours, my quote. ${QUESTION}${SIGN}`,
      `Hi Alondra, $500 for two hours. ${QUESTION}${SIGN}`, quoted, pricing);
    assert.ok(drafts.full_draft.includes("$500"));
  });

  it("Clarification V9 two question marks still throw 'exactly one question'", async () => {
    await assert.rejects(run(`Hi Alondra,\n\nWhat kind? ${QUESTION}${SIGN}`, `Hi Alondra, ${QUESTION}${SIGN}`), /must contain exactly one question/);
  });
});

describe("Clarification V11: the validator is not quadratic on a long draft", () => {
  it("Clarification V11 a 50,000-character run of number words goes through the validator in well under a second", async () => {
    const long = "a ".repeat(25_000).trim(); // no price; the unbounded number-word run took about 2 s on this
    const t0 = Date.now();
    const drafts = await run(`Hi Alondra,\n\n${long}. ${QUESTION}${SIGN}`, `Hi Alondra, ${QUESTION}${SIGN}`);
    const ms = Date.now() - t0;
    assert.ok(drafts.full_draft.length > 40_000, "the long draft went through the validator");
    assert.ok(ms < 700, `took ${ms} ms`);
  });
});

describe("Clarification V10: the documented boundary (an unmarked amount and price vocabulary pass)", () => {
  it("Clarification V10 'around fifteen hundred', 'starts low' and 'on the higher end' do not throw", async () => {
    for (const s of ["It is around fifteen hundred for that.", "It starts low and grows with the hours.", "My rate is on the higher end."]) {
      await passes(s);
    }
  });
});
