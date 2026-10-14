import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { GENERATE_CASES, generatePromptOf, removeSpans, sha256 } from "./generate-prompt-cases.js";

// Plan docs/plans/2026-10-13-fix-clarification-draft-shape-plan.md (Revision 1b), P1-P8. Names start
// "Clarification Shape P<n>". The generate prompt carries private venue text, so what is pinned for the non-clarification
// cases is a SHA-256, not the text (src/fixtures/generate-prompt-hashes.json). The hashes are intentionally stale on any
// unrelated edit to the generate prompt: P4 then fails, and they change only in a commit whose message begins
// "snapshot refresh:" with the reviewed prompt diff (scripts/snapshot-generate-prompts.ts).
const hashes = JSON.parse(readFileSync("src/fixtures/generate-prompt-hashes.json", "utf-8")) as Record<string, string>;

describe("Clarification Shape P4 / P5: nothing outside the three spans changes", () => {
  for (const c of GENERATE_CASES.filter((x) => x.id !== "C0")) {
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
