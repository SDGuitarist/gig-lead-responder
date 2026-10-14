import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { coerceLeadWords, groundLeadWords, leadWordsOf, normalForm, LEAD_WORDS_MAX_LENGTH } from "./lead-words.js";
import { sanitizeClassification } from "./utils/sanitize.js";
import { buildGeneratePrompt } from "./prompts/generate.js";
import { buildVerifyPrompt } from "./prompts/verify.js";
import { GENERATE_CASES } from "./generate-prompt-cases.js";
import { VAGUE_GATE_CASES } from "./verify-prompt-cases.js";
import type { Classification, PricingResult } from "./types.js";

// Plan docs/plans/2026-10-14-feat-lead-words-field-plan.md (Revision 1c). Names start "Lead Words LW<n>".
const NONE = { occasion: null, time_frame: null, doubt: null };

describe("Lead Words LW1/LW10: the shape boundary never throws", () => {
  it("Lead Words LW10 a non-object, array, null, string or missing value is all-null", () => {
    for (const v of [undefined, null, "a wedding", ["a wedding"], 7, true]) assert.deepEqual(coerceLeadWords(v), NONE, String(v));
  });

  it("Lead Words LW10 a member that is not a string, is empty, or is over the cap becomes null; extra keys are dropped", () => {
    const long = "x".repeat(LEAD_WORDS_MAX_LENGTH + 1);
    const ok = "y".repeat(LEAD_WORDS_MAX_LENGTH);
    assert.deepEqual(coerceLeadWords({ occasion: 5, time_frame: "   ", doubt: long, extra: "z" }), NONE);
    assert.deepEqual(coerceLeadWords({ occasion: ok, time_frame: " next month ", doubt: null }), { occasion: ok, time_frame: "next month", doubt: null });
  });

  it("Lead Words LW10 leadWordsOf reads a stored malformed value as all-null and a missing one as all-null", () => {
    assert.deepEqual(leadWordsOf({} as Classification), NONE);
    assert.deepEqual(leadWordsOf({ lead_words: "a wedding" } as unknown as Classification), NONE);
    assert.deepEqual(leadWordsOf({ lead_words: { occasion: "a wedding", time_frame: null, doubt: null } } as Classification),
      { occasion: "a wedding", time_frame: null, doubt: null });
  });
});

describe("Lead Words LW11: grounding is lexical, with a token-level negation guard and a doubt shape", () => {
  const ground = (words: Partial<typeof NONE>, lead: string) => groundLeadWords({ ...NONE, ...words }, lead);

  it("Lead Words LW11 keeps a phrase that differs from the lead only by case, spaces, a line break, an accent or apostrophe style", () => {
    assert.equal(ground({ occasion: "My Mom's 60th Birthday" }, "it's for my   mom’s 60th\nbirthday").occasion, "My Mom's 60th Birthday");
    assert.equal(ground({ occasion: "quinceanera" }, "a quinceañera in June").occasion, "quinceanera");
    assert.equal(ground({ occasion: "quinceañera" }, "a quinceanera in June").occasion, "quinceañera");
    assert.equal(ground({ time_frame: "next month" }, "We need music NEXT\tMONTH.").time_frame, "next month");
  });

  it("Lead Words LW11 nulls a paraphrase and a phrase absent from the lead", () => {
    assert.equal(ground({ occasion: "a milestone birthday" }, "my mom turns 60").occasion, null);
    assert.equal(ground({ time_frame: "this spring" }, "sometime next year").time_frame, null);
  });

  it("Lead Words LW11 the negation guard: a negator token right before the span nulls occasion and time_frame", () => {
    for (const lead of ["this is not a wedding", "this is (not a wedding)", "NOT, a wedding", "it isn't a wedding", "it wasn't a wedding", "no a wedding", "never a wedding", "without a wedding"]) {
      assert.equal(ground({ occasion: "a wedding" }, lead).occasion, null, lead);
    }
    assert.equal(ground({ time_frame: "next month" }, "not next month").time_frame, null);
  });

  it("Lead Words LW11 control: a negator inside another word does not trigger the guard, and one clean occurrence is enough", () => {
    assert.equal(ground({ occasion: "a wedding" }, "I know a wedding band").occasion, "a wedding");
    assert.equal(ground({ occasion: "a wedding" }, "nothing a wedding planner could fix").occasion, "a wedding");
    assert.equal(ground({ occasion: "a wedding" }, "not a wedding, no, but a wedding next June").occasion, "a wedding");
    // a stated limit, pinned: the guard looks at the ONE token before the span, so a negator further away is not seen
    assert.equal(ground({ occasion: "a wedding" }, "we don't want a wedding").occasion, "a wedding");
  });

  it("Lead Words LW11 doubt: kept with a bounded marker, exempt from the negation guard, null without a marker or when it equals the occasion", () => {
    assert.equal(ground({ doubt: "not sure what kind of music" }, "Hi, I'm not sure what kind of music would work.").doubt, "not sure what kind of music");
    assert.equal(ground({ doubt: "no idea what to pick" }, "we have no idea what to pick").doubt, "no idea what to pick");
    assert.equal(ground({ doubt: "which kind of music works" }, "which kind of music works for a dinner?").doubt, "which kind of music works");
    assert.equal(ground({ doubt: "a birthday party" }, "a birthday party in June").doubt, null, "no doubt marker");
    assert.equal(ground({ occasion: "not sure what music", doubt: "not sure what music" }, "we are not sure what music").doubt, null, "equals the occasion");
    assert.equal(ground({ doubt: "not sure what kind of music" }, "we want a band").doubt, null, "absent from the lead");
  });

  it("Lead Words LW11 normalForm is deterministic", () => {
    assert.equal(normalForm("  Café’s “Best”\n  Night  "), "cafe's \"best\" night");
  });
});

describe("Lead Words LW14/LW8: a malformed stored value reaches a prompt only as all-null", () => {
  const c8 = GENERATE_CASES.find((c) => c.id === "C8");
  assert.ok(c8);
  const cls = (lead_words: unknown) => ({ ...c8.classification, lead_words }) as unknown as Classification;
  const generate = (c: Classification) => buildGeneratePrompt(c, c8.pricing as PricingResult, "ctx", { kind: "none" } as never);
  const verifyCase = VAGUE_GATE_CASES.find((c) => c.id === "S13");
  assert.ok(verifyCase);
  const verify = (lw: unknown) => buildVerifyPrompt({ ...verifyCase.classification, lead_words: lw } as unknown as Classification, verifyCase.pricing);
  const MALFORMED = ["a wedding", ["a wedding"], { occasion: 5, time_frame: null, doubt: null }, { occasion: "x".repeat(81), time_frame: null, doubt: null }];

  it("Lead Words LW14 sanitizeClassification: absent stays absent, present is read through the accessor", () => {
    assert.ok(!("lead_words" in sanitizeClassification({ ...c8.classification } as Classification)));
    for (const bad of MALFORMED) assert.deepEqual(sanitizeClassification(cls(bad)).lead_words, NONE);
    assert.deepEqual(sanitizeClassification(cls({ occasion: "a wedding", time_frame: null, doubt: null, extra: 1 })).lead_words,
      { occasion: "a wedding", time_frame: null, doubt: null });
  });

  it("Lead Words LW14 the generate and verify builders give byte-equal prompts for malformed and all-null values", () => {
    for (const bad of MALFORMED) {
      assert.equal(generate(cls(bad)), generate(cls(NONE)), JSON.stringify(bad));
      assert.equal(verify(bad), verify(NONE), JSON.stringify(bad));
      assert.ok(!generate(cls(bad)).includes("a wedding"), "the malformed text is not in the generate prompt");
    }
    // positive control: a valid phrase is present, so the comparison above is not vacuous
    assert.ok(generate(cls({ occasion: "my mom's 60th birthday", time_frame: null, doubt: null })).includes("my mom's 60th birthday"));
    assert.ok(verify({ occasion: "my mom's 60th birthday", time_frame: null, doubt: null }).includes("my mom's 60th birthday"));
  });
});
