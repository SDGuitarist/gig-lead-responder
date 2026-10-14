import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { GENERATE_CASES, generatePromptOf, removeSpans, sha256, spansOf } from "./generate-prompt-cases.js";

// Plan docs/plans/2026-10-13-fix-clarification-draft-shape-plan.md (Revision 1b), P1-P8. Names start
// "Clarification Shape P<n>". The generate prompt carries private venue text, so what is pinned for the non-clarification
// cases is a SHA-256, not the text (src/fixtures/generate-prompt-hashes.json). The hashes are intentionally stale on any
// unrelated edit to the generate prompt: P4 then fails, and they change only in a commit whose message begins
// "snapshot refresh:" with the reviewed prompt diff (scripts/snapshot-generate-prompts.ts).
const hashes = JSON.parse(readFileSync("src/fixtures/generate-prompt-hashes.json", "utf-8")) as Record<string, string>;

describe("Clarification Shape P4 / P5: nothing outside the three spans changes", () => {
  // C8, C15 and C16 are the cases the vague-lead reference block (plan 2026-10-13-feat-vague-lead-quote-with-question)
  // is MEANT to change; src/vague-quote-reference.test.ts (V7) asserts that they differ. C0 is pinned by P5 below.
  const CHANGED_BY_THE_VAGUE_ROUTE = new Set(["C8", "C15", "C16"]);
  for (const c of GENERATE_CASES.filter((x) => x.id !== "C0" && !CHANGED_BY_THE_VAGUE_ROUTE.has(x.id))) {
    it(`Clarification Shape P4 ${c.id} (${c.what}) hashes to its pre-change value`, () => {
      assert.equal(sha256(generatePromptOf(c.id)), hashes[c.id]);
    });
  }

  it("Clarification Shape P5 the clarification prompt outside the three spans hashes to its pre-change value", () => {
    assert.equal(sha256(removeSpans(generatePromptOf("C0"))), hashes["C0-outside-spans"]);
  });

  it("Clarification Shape P5a an edit INSIDE a span leaves the outside-spans hash unchanged (positive control)", () => {
    const base = generatePromptOf("C0");
    const edit = (re: RegExp, to: string) => {
      assert.ok(re.test(base), String(re));
      return base.replace(re, to);
    };
    for (const edited of [
      edit(/^- Word count:.*$/m, "- Word count: ANY NUMBER"),
      edit(/^- Must retain:.*$/m, "- Must retain: ANYTHING"),
      edit(/^2\. \*\*Differentiator[^\n]*$/m, "2. **Differentiator** ANYTHING"),
    ]) {
      assert.notEqual(edited, base);
      assert.equal(sha256(removeSpans(edited)), hashes["C0-outside-spans"]);
    }
  });

  it("Clarification Shape P5b an edit OUTSIDE the spans changes the outside-spans hash (negative control)", () => {
    const base = generatePromptOf("C0");
    for (const line of ["- Ask exactly ONE binary clarifying question.", "- Do NOT state a price, rate, anchor, floor, or package."]) {
      assert.equal(base.split(line).length - 1, 1, line);
      assert.notEqual(sha256(removeSpans(base.replace(line, line + " EDITED"))), hashes["C0-outside-spans"], line);
    }
  });

  it("Clarification Shape P5c an anchor found zero or two times throws", () => {
    const base = generatePromptOf("C0");
    assert.throws(() => removeSpans(base.replace(/^- Must retain:.*$/m, "- Keep:")), /found 0 lines/);
    assert.throws(() => removeSpans(base + "\n- Must retain: again"), /found 2 lines/);
    assert.throws(() => removeSpans(base.replace(/^4\. \*\*.*$/m, "4. text")), /found 0 lines/);
  });
});

const clarification = () => generatePromptOf("C0");
const stepLine = (steps: string, n: number) => {
  const found = steps.split("\n").filter((l) => l.startsWith(`${n}. **`));
  assert.equal(found.length, 1, `step ${n}`);
  return found[0];
};

describe("Clarification Shape P1: steps 1-3 for a vague lead", () => {
  it("Clarification Shape P1 step 1 opens with a fact or uncertainty the lead supplied, step 2 is one sentence, step 3 is one bundled sentence and is not skipped", () => {
    const { steps } = spansOf(clarification());
    assert.match(stepLine(steps, 1), /a fact or an uncertainty the lead supplied/);
    assert.match(stepLine(steps, 2), /clarification mode: ONE sentence/);
    assert.match(stepLine(steps, 2), /no "most vendors" contrast/);
    assert.match(stepLine(steps, 3), /ONE bundled sentence/);
    assert.match(stepLine(steps, 3), /answers every flagged concern together/);
    assert.ok(!/SKIP/.test(stepLine(steps, 3)), "step 3 is not skipped (the concern traceability sentence is still requested)");
    assert.match(spansOf(clarification()).steps + generatePromptOf("C0").split("\n").filter((l) => l.startsWith("4. **")).join("\n"), /SKIP in clarification mode/);
  });
});

describe("Clarification Shape P2 / P3: length and the compressed retain list", () => {
  it("Clarification Shape P2 the full draft range is 70 to 100 words and 4 to 6 sentences, not the generic ranges", () => {
    const { words } = spansOf(clarification());
    assert.match(words, /70 to 100 words/);
    assert.match(words, /4 to 6 sentences/);
    for (const old of ["100-125", "125-145", "145-165"]) assert.ok(!words.includes(old), old);
  });

  it("Clarification Shape P3 the compressed draft keeps wedge, validation and close and no longer retains a price", () => {
    const { retain } = spansOf(clarification());
    assert.match(retain, /wedge, validation sentence/);
    assert.match(retain, /close/);
    assert.ok(!/price/.test(retain), retain);
  });

  it("Clarification Shape P3 a quote prompt still retains a price (positive control)", () => {
    assert.match(spansOf(generatePromptOf("C1")).retain, /price, close/);
    assert.match(spansOf(generatePromptOf("C1")).words, /100-125 words/);
  });
});

describe("Clarification Shape P6 / P8: the hard constraint and the concern line are untouched", () => {
  it("Clarification Shape P6 the Clarification Mode HARD CONSTRAINT block is byte-for-byte what it was", () => {
    const block = [
      "**Clarification Mode (HARD CONSTRAINT):**",
      "- Ask exactly ONE binary clarifying question.",
      "- Do NOT state a price, rate, anchor, floor, or package.",
      "- Do NOT pretend the format is settled.",
      "- The question must narrow the musical direction, not gather admin details.",
      '- Good: "Are you picturing something intimate and in the background, or more of a featured moment people stop to watch?"',
      '- Bad: "What is your budget?" "What songs do you want?" "Can you send more details?"',
      "",
    ].join("\n");
    assert.equal(clarification().split(block).length - 1, 1);
  });

  it("Clarification Shape P8 the flagged concern is still requested, and step 3 asks for the sentence that carries it", () => {
    const prompt = clarification();
    assert.match(prompt, /Address each flagged concern: vague format request/);
    assert.match(stepLine(spansOf(prompt).steps, 3), /every flagged concern together/);
  });
});
