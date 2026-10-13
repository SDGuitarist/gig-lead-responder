import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildVerifyPrompt } from "./prompts/verify.js";
import { VERIFY_CASES, sectionOf, snapshotForm } from "./verify-prompt-cases.js";

// The clarification definition, as the plan (Revision 1b, D1) specifies it. The test holds its own copy: it is the pin.
const CLARIFICATION_6B = [
  "### 6b. Lead-Specificity Check",
  "This lead is vague: the form gave no date, venue, guest count or format, so the opening cannot cite them. The first sentence passes only if it repeats or restates a fact or an uncertainty the lead itself supplied: the occasion or event type the lead wrote (a birthday, a wedding, a party), the time frame the lead wrote (next month, this winter, spring), or the lead's own stated doubt (\"not sure what kind of music\"). References that could be said to any inquiry do NOT qualify: \"your event\", \"this inquiry\", \"what you're looking for\", \"the right fit\", \"the right music\", \"what would work best\".",
  "- Look at the FIRST sentence of the draft",
  "- Deletion test: remove the words that came from this lead; if the sentence still works for any inquiry → lead_specific_opening = false",
  "- Pass: \"You said live music next month and haven't picked a format yet, which is the right moment for one question.\"",
  "- Fail (compliment): \"What a wonderful way to celebrate!\"",
  "- Fail (generic acknowledgement): \"You're looking for the right music for your event.\"",
  "",
].join("\n");
const CLARIFICATION_OPENING_LINE = "- lead_specific_opening: Apply section 6b (clarification mode): the first sentence repeats a fact or an uncertainty this lead supplied; generic references that fit any inquiry do not count.";
const OPENING_LINE_PREFIX = "- lead_specific_opening:";
const lineOf = (prompt: string) => {
  const found = prompt.split("\n").filter((l) => l.startsWith(OPENING_LINE_PREFIX));
  assert.equal(found.length, 1, "exactly one lead_specific_opening gut-check line");
  return found[0];
};


// Plan docs/plans/2026-10-13-fix-clarification-gate-opening-plan.md (Revision 1b), G0-G7: the verify prompt's
// lead-specificity rule is scoped to clarification mode, and every other mode is byte-identical to the snapshots in
// src/fixtures/verify-prompt-baseline/. Names start "Clarification Gate G<n>".
//
// THE SNAPSHOTS ARE INTENTIONALLY STALE on any unrelated edit to buildVerifyPrompt: G2 then fails. The only way to
// update them is `npx tsx scripts/snapshot-verify-prompts.ts` in a commit whose message begins "snapshot refresh:"
// with a reviewed diff of the prompt change that caused it.

const caseOf = (id: string) => {
  const c = VERIFY_CASES.find((x) => x.id === id);
  assert.ok(c, `case ${id}`);
  return c;
};
const promptOf = (id: string) => snapshotForm(buildVerifyPrompt(caseOf(id).classification, caseOf(id).pricing));
const snapshotOf = (id: string) => readFileSync(`src/fixtures/verify-prompt-baseline/${id}.txt`, "utf-8");

describe("Clarification Gate G0: the section extractor", () => {
  it("Clarification Gate G0 finds 6b, 7a, 7b, 8 and 9 with their own heading, and throws on an absent or unknown id", () => {
    const quote = promptOf("S1");
    for (const [id, heading] of [["6b", "### 6b. Lead-Specificity Check"], ["7a", "### 7a. "], ["7b", "### 7b. "], ["8", "### 8. "], ["9", "### 9. Gate Status"]] as const) {
      const body = sectionOf(quote, id);
      assert.ok(body.startsWith(heading), `${id}: ${body.slice(0, 40)}`);
      assert.ok(body.split("\n").length > 1, `${id} has a body`);
      assert.ok(!/^### /m.test(body.split("\n").slice(1).join("\n")), `${id} stops before the next heading`);
    }
    assert.ok(sectionOf(promptOf("S6"), "7c").startsWith("### 7c. "));
    assert.ok(sectionOf(promptOf("S5"), "7d").startsWith("### 7d. "));
    assert.throws(() => sectionOf(quote, "7c"), /found 0 headings/);
    assert.throws(() => sectionOf(quote, "42"), /found 0 headings/);
  });
});

describe("Clarification Gate G2: every non-clarification mode is byte-equal to its snapshot", () => {
  for (const id of ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8", "S9", "S10", "S11", "S12"]) {
    it(`Clarification Gate G2 ${id} (${caseOf(id).what}) is byte-equal to its snapshot`, () => {
      const prompt = promptOf(id);
      assert.equal(prompt, snapshotOf(id));
      assert.ok(!/do NOT qualify|does NOT qualify/.test(prompt), "no clarification definition outside clarification mode");
    });
  }
});
