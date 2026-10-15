import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { coerceLeadWords, groundLeadWords, leadWordsOf, normalForm, LEAD_WORDS_MAX_LENGTH } from "./lead-words.js";
import { sanitizeClassification } from "./utils/sanitize.js";
import { buildGeneratePrompt } from "./prompts/generate.js";
import { buildVerifyPrompt } from "./prompts/verify.js";
import { GENERATE_CASES } from "./generate-prompt-cases.js";
import ts from "typescript";
import { classifyLead } from "./pipeline/classify.js";
import { setClaudeRequesterForTests } from "./claude.js";
import { buildClassifyPrompt } from "./prompts/classify.js";
import { VAGUE_GATE_CASES, sectionOf } from "./verify-prompt-cases.js";
import { NO_DATE_TERMS } from "./pipeline/payment-terms.js";
import type { Classification, PricingResult } from "./types.js";

// Plan docs/plans/2026-10-14-feat-lead-words-field-plan.md (Revision 1c). Names start "Lead Words LW<n>".
const NONE: { occasion: string | null; time_frame: string | null; doubt: string | null } = { occasion: null, time_frame: null, doubt: null };

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

describe("Lead Words LW2/LW6: the classifier path", () => {
  const c8 = GENERATE_CASES.find((c) => c.id === "C8");
  assert.ok(c8);
  const respond = (body: unknown) =>
    setClaudeRequesterForTests((async () => ({ id: "m", type: "message", role: "assistant", model: "t", stop_reason: "end_turn",
      stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 }, content: [{ type: "text", text: JSON.stringify(body) }] })) as never);
  const lead = "Hi, my mom's 60th birthday is next month. Not sure what kind of music would work.";

  it("Lead Words LW2 classifyLead keeps a verbatim phrase, nulls a paraphrase, and a missing field is all-null", async () => {
    try {
      respond({ ...c8.classification, lead_words: { occasion: "my mom's 60th birthday", time_frame: "this spring", doubt: "Not sure what kind of music" } });
      const r = await classifyLead(lead, "2026-10-12");
      assert.deepEqual(r.lead_words, { occasion: "my mom's 60th birthday", time_frame: null, doubt: "Not sure what kind of music" });
      respond({ ...c8.classification });
      assert.deepEqual((await classifyLead(lead, "2026-10-12")).lead_words, NONE);
      respond({ ...c8.classification, lead_words: "my mom's 60th birthday" });
      assert.deepEqual((await classifyLead(lead, "2026-10-12")).lead_words, NONE);
    } finally { setClaudeRequesterForTests(); }
  });

  it("Lead Words LW6 the classifier prompt documents the field and has the schema line", () => {
    const prompt = buildClassifyPrompt("2026-10-12");
    assert.ok(prompt.includes('"lead_words": { "occasion": string | null, "time_frame": string | null, "doubt": string | null }'));
    assert.ok(prompt.includes("lead_words (every lead): short phrases COPIED from the lead's own message"));
    assert.ok(prompt.includes("code discards any phrase that is not in the lead"));
  });
});

describe("Lead Words LW4/LW12: the drafter section", () => {
  const c8 = GENERATE_CASES.find((c) => c.id === "C8");
  assert.ok(c8);
  const MARK = "## WHAT THE LEAD WROTE";
  const gen = (over: Partial<Classification>, words?: unknown) =>
    buildGeneratePrompt({ ...c8.classification, ...over, ...(words === undefined ? {} : { lead_words: words }) } as unknown as Classification, c8.pricing as PricingResult, "ctx", NO_DATE_TERMS);
  const W = { occasion: "my mom's 60th birthday", time_frame: null, doubt: "not sure what kind of music" };
  const scoped = { action: "one_question", vagueness: "vague" } as Partial<Classification>;

  it("Lead Words LW4 a vague one_question lead with a phrase gets the section, with only the non-null phrases, wrapped", () => {
    const p = gen(scoped, W);
    assert.equal(p.split(MARK).length - 1, 1);
    assert.ok(p.includes("my mom's 60th birthday") && p.includes("not sure what kind of music"));
    const block = p.slice(p.indexOf(MARK)).split("\n## ")[0];
    assert.ok(!block.includes("time_frame"), "a null phrase is not listed");
    assert.ok(p.slice(p.indexOf(MARK)).includes("<lead_words"), "wrapped as untrusted data");
  });

  it("Lead Words LW4 each withheld case on its own: all null, quote, clear, assume_and_quote, missing field", () => {
    assert.ok(!gen(scoped, NONE).includes(MARK));
    assert.ok(!gen(scoped).includes(MARK));
    assert.ok(!gen({ ...scoped, action: "quote" }, W).includes(MARK));
    assert.ok(!gen({ ...scoped, vagueness: "clear" }, W).includes(MARK));
    assert.ok(!gen({ ...scoped, action: "assume_and_quote" }, W).includes(MARK));
    assert.ok(gen({ ...scoped, format_recommended: "unresolved" }, W).includes(MARK), "clarification mode is in scope (Alex's D5a)");
  });

  it("Lead Words LW12 the section sits after the classification block and before the voice examples, reference blocks and STEP 1, with the precedence sentence", () => {
    const p = gen(scoped, W);
    const at = p.indexOf(MARK);
    assert.ok(p.indexOf('lead_classification') < at, "after the classification block");
    for (const later of ["## VOICE EXAMPLES", "## REFERENCE LEAD", "## STEP 1", "## INJECTED CONTEXT"]) {
      const i = p.indexOf(later);
      if (i !== -1) assert.ok(at < i, `before ${later}`);
    }
    assert.ok(p.includes("This sentence overrides the order of any reference below for the FIRST sentence"));
    assert.ok(p.includes("REFERENCE LEAD: VAGUE REQUEST"), "positive control: the vague-quote reference block is present and later");
  });
});

describe("Lead Words LW5: the verifier sentence", () => {
  const sec = (cls: Classification) => buildVerifyPrompt(cls, { budget: { tier: "none" } });
  const base = VAGUE_GATE_CASES.find((c) => c.id === "S13");
  assert.ok(base);
  const SENT = "`lead_words` in the classification holds phrases the lead itself wrote";
  const W = { occasion: "my mom's 60th birthday", time_frame: null, doubt: null };

  it("Lead Words LW5 the sentence is in the two scoped modes with a phrase, and only there", () => {
    const vq = { ...base.classification } as Classification;                                    // vague-quote mode
    const clar = { ...base.classification, format_recommended: "unresolved" } as Classification; // clarification mode
    assert.ok(sec({ ...vq, lead_words: W } as Classification).includes(SENT));
    assert.ok(sec({ ...clar, lead_words: W } as Classification).includes(SENT));
    assert.ok(!sec({ ...vq, lead_words: NONE } as Classification).includes(SENT), "all null: today's text");
    assert.ok(!sec(vq).includes(SENT), "absent: today's text");
    assert.ok(!sec({ ...vq, action: "quote", vagueness: "clear", lead_words: W } as Classification).includes(SENT), "not a scoped mode");
  });

  it("Lead Words LW5 all-null and absent give the same 6b text and opening line (the lower-confidence fallback is today's text)", () => {
    const vq = { ...base.classification } as Classification;
    const withNull = sec({ ...vq, lead_words: NONE } as Classification);
    const absent = sec(vq);
    assert.equal(sectionOf(withNull, "6b"), sectionOf(absent, "6b"));
    const opening = (p: string) => p.split("\n").find((l) => l.startsWith("- lead_specific_opening:"));
    assert.equal(opening(withNull), opening(absent));
    assert.ok(!sectionOf(withNull, "6b").includes("lead_words"), "no lead_words sentence when all null");
  });
});

/**
 * Every way TypeScript source can touch a `lead_words` property outside the accessor (Codex code R2 P2-2): dot access,
 * string-literal bracket access, and object destructuring (declaration, parameter, or assignment pattern).
 */
function rawLeadWordsReads(sf: ts.SourceFile): number {
  let n = 0;
  const isPattern = (o: ts.Node) => ts.isBinaryExpression(o.parent) && o.parent.operatorToken.kind === ts.SyntaxKind.EqualsToken && o.parent.left === o;
  const visit = (node: ts.Node) => {
    if (ts.isPropertyAccessExpression(node) && node.name.text === "lead_words") n++;
    else if (ts.isElementAccessExpression(node) && ts.isStringLiteralLike(node.argumentExpression) && node.argumentExpression.text === "lead_words") n++;
    else if (ts.isBindingElement(node) && ts.isObjectBindingPattern(node.parent)
      && (node.propertyName ? (ts.isIdentifier(node.propertyName) || ts.isStringLiteralLike(node.propertyName)) && node.propertyName.text === "lead_words"
        : ts.isIdentifier(node.name) && node.name.text === "lead_words")) n++;
    else if (ts.isShorthandPropertyAssignment(node) && node.name.text === "lead_words" && ts.isObjectLiteralExpression(node.parent) && isPattern(node.parent)) n++;
    else if (ts.isPropertyAssignment(node) && (ts.isIdentifier(node.name) || ts.isStringLiteralLike(node.name)) && node.name.text === "lead_words"
      && ts.isObjectLiteralExpression(node.parent) && isPattern(node.parent)) n++;
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return n;
}

describe("Lead Words LW15: the measurement seam and the raw-consumer inventory (Codex code R1)", () => {
  const c8 = GENERATE_CASES.find((c) => c.id === "C8");
  assert.ok(c8);
  const fake = (leadWords: unknown, over: Record<string, unknown> = {}) => async () => ({
    id: "m", type: "message", role: "assistant", model: "t", stop_reason: "end_turn", stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 1 },
    content: [{ type: "text", text: JSON.stringify({ ...c8.classification, lead_words: leadWords, ...over }) }] });
  const lead = "Hi, my mom's 60th birthday is next month. Not sure what kind of music would work.";

  it("Lead Words LW15 groundingRun runs the production classifyLead: a copied phrase is returned and kept, a paraphrase is returned and dropped", async () => {
    const { groundingRun } = await import("./lead-words-measure.js");
    const r = await groundingRun(lead, "2026-10-12", fake({ occasion: "my mom's 60th birthday", time_frame: "this spring", doubt: null }));
    assert.deepEqual(r.returned, { occasion: "my mom's 60th birthday", time_frame: "this spring", doubt: null });
    assert.deepEqual(r.kept, { occasion: "my mom's 60th birthday", time_frame: null, doubt: null });
  });

  it("Lead Words LW15 the production validation applies: a classification the validator rejects is an error, not a measurement", async () => {
    const { groundingRun } = await import("./lead-words-measure.js");
    // validateClassification throws on a missing format_recommended; callClaude retries once, then the call rejects
    await assert.rejects(groundingRun(lead, "2026-10-12", fake({ occasion: "my mom's 60th birthday" }, { format_recommended: "" })));
  });

  const seq = (texts: string[]) => {
    let calls = 0;
    const requester = async () => ({
      id: "m", type: "message", role: "assistant", model: "t", stop_reason: "end_turn", stop_sequence: null,
      usage: { input_tokens: 1, output_tokens: 1 }, content: [{ type: "text", text: texts[Math.min(calls++, texts.length - 1)] }] });
    return { requester, calls: () => calls };
  };
  const body = (leadWords: unknown, over: Record<string, unknown> = {}) => JSON.stringify({ ...c8.classification, lead_words: leadWords, ...over });
  const PHRASES = { occasion: "my mom's 60th birthday", time_frame: "this spring", doubt: null };

  it("Lead Words LW15 a valid retry response wrapped in code fences with surrounding whitespace is parsed like production (Codex code R2 P1-1)", async () => {
    const { groundingRun } = await import("./lead-words-measure.js");
    const s = seq([body(PHRASES, { format_recommended: "" }), "\n  ```json\n" + body(PHRASES) + "\n```  \n\n"]);
    const r = await groundingRun(lead, "2026-10-12", s.requester);
    assert.equal(s.calls(), 2, "the first response failed validation and was retried");
    assert.deepEqual(r.returned, PHRASES);
    assert.deepEqual(r.kept, { occasion: "my mom's 60th birthday", time_frame: null, doubt: null });
  });

  it("Lead Words LW15 positive control: an unfenced valid response is read the same way, in one call", async () => {
    const { groundingRun } = await import("./lead-words-measure.js");
    const s = seq([body(PHRASES)]);
    const r = await groundingRun(lead, "2026-10-12", s.requester);
    assert.equal(s.calls(), 1);
    assert.deepEqual(r.returned, PHRASES);
  });

  it("Lead Words LW15 the requester is restored after a run (no leak into other tests)", async () => {
    const { groundingRun } = await import("./lead-words-measure.js");
    await groundingRun(lead, "2026-10-12", fake(NONE));
    assert.deepEqual((await groundingRun(lead, "2026-10-12", fake({ occasion: "my mom's 60th birthday" }))).returned,
      { occasion: "my mom's 60th birthday", time_frame: null, doubt: null });
  });

  it("Lead Words LW15 summarizeOpening counts over ALL runs: a no-draft run stays in the denominator (the plan's 20 of 50)", async () => {
    const { summarizeOpening } = await import("./route-metrics.js");
    const runs = [
      ...Array.from({ length: 30 }, () => ({ ok: true, gate_detail: { false_checks: ["lead_specific_opening"] } })),
      ...Array.from({ length: 10 }, () => ({ ok: true, gate_detail: { false_checks: [] as string[] } })),
      ...Array.from({ length: 10 }, () => ({ ok: false })),
    ];
    assert.deepEqual(summarizeOpening(runs), { runs: 50, returned: 40, no_draft: 10, opening_false: 30 });
    // positive control: the returned-draft numbers are unchanged by the no-draft runs
    assert.equal(summarizeOpening(runs.filter((r) => r.ok)).opening_false, 30);
  });

  it("Lead Words LW15 raw reads of .lead_words outside the accessor are an allowlist, and a new consumer fails the test", async () => {
    const { readFileSync, readdirSync, statSync } = await import("node:fs");
    const { join } = await import("node:path");
    const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => {
      const p = join(dir, n);
      return statSync(p).isDirectory() ? (n === "fixtures" || n === "node_modules" ? [] : walk(p)) : p.endsWith(".ts") && !p.endsWith(".test.ts") ? [p] : [];
    });
    const found: Record<string, number> = {};
    for (const f of [...walk("src"), ...walk("scripts")]) {
      const n = rawLeadWordsReads(ts.createSourceFile(f, readFileSync(f, "utf-8"), ts.ScriptTarget.Latest, true));
      if (n > 0) found[f] = n;
    }
    // The accessor itself; the producer in classifyLead/validateClassification (assignments); the measurement seam reading
    // the production result; sanitize's presence check; the report reading an already-coerced stored record.
    assert.deepEqual(found, {
      "src/lead-words.ts": 1,
      "src/pipeline/classify.ts": 4,   // validateClassification (assign + read) and classifyLead (assign + read)
      "src/lead-words-measure.ts": 2,  // the production result, and the model's raw JSON before the code check (intentional)
      "src/utils/sanitize.ts": 1,
      "scripts/clarification-arm-report.ts": 1,
    });
  });

  it("Lead Words LW15 the raw-read scanner rejects dot, bracket and destructuring reads, and allows the accessor and writes (Codex code R2 P2-2)", () => {
    const count = (src: string) => rawLeadWordsReads(ts.createSourceFile("x.ts", src, ts.ScriptTarget.Latest, true));
    // regression controls: each of these is a raw read and must be counted
    assert.equal(count("const a = c.lead_words;"), 1, "dot access");
    assert.equal(count('const a = c["lead_words"];'), 1, "bracket access, double quotes");
    assert.equal(count("const a = c['lead_words'];"), 1, "bracket access, single quotes");
    assert.equal(count("const { lead_words } = c;"), 1, "destructuring");
    assert.equal(count("const { lead_words: lw } = c;"), 1, "destructuring with rename");
    assert.equal(count('const { "lead_words": lw } = c;'), 1, "destructuring with a quoted key");
    assert.equal(count("function f({ lead_words }: X) { return 1; }"), 1, "parameter destructuring");
    assert.equal(count("let lead_words; ({ lead_words } = c);"), 1, "destructuring assignment");
    // positive controls: the accessor, an unrelated property, an object literal that only WRITES the field
    assert.equal(count("const a = leadWordsOf(c);"), 0, "the accessor");
    assert.equal(count("const a = c.lead_words_count;"), 0, "a different property");
    assert.equal(count("const o = { lead_words: x };"), 0, "writing the field in a literal");
    assert.equal(count("const o = { ...c, lead_words };"), 0, "writing the field by shorthand");
  });
});
