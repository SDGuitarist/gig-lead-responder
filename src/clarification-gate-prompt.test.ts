import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { buildVerifyPrompt } from "./prompts/verify.js";
import { VERIFY_CASES, sectionOf, snapshotForm, voiceBlockOf } from "./verify-prompt-cases.js";

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
// "Byte-equal" means byte-equal OUTSIDE the voice-reference block: the snapshots store that block as a marker (its
// reference replies carry private venue text the leak check forbids in a new file). G8 pins the block itself by a
// SHA-256, so an edit inside it is caught without storing the text.
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
const promptOfRaw = (id: string) => buildVerifyPrompt(caseOf(id).classification, caseOf(id).pricing);
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

describe("Clarification Gate G2: every non-clarification mode is byte-equal to its snapshot outside the voice-reference block", () => {
  // S8 (one_question + vague + solo) became the vague-quote mode in plan 2026-10-14-fix-vague-quote-gate-opening-plan.md:
  // its text is pinned by src/vague-gate-prompt.test.ts (VG1, VG7), against the retained S8-pre-vague-gate snapshot.
  for (const id of ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S9", "S10", "S11", "S12"]) {
    it(`Clarification Gate G2 ${id} (${caseOf(id).what}) is byte-equal to its snapshot outside the voice block`, () => {
      const prompt = promptOf(id);
      assert.equal(prompt, snapshotOf(id));
      assert.ok(!/do NOT qualify|does NOT qualify/.test(prompt), "no clarification definition outside clarification mode");
    });
  }
});

describe("Clarification Gate G1 / G3: the clarification definition", () => {
  it("Clarification Gate G1 section 6b and the gut-check line are exactly the clarification definition", () => {
    const prompt = promptOf("S0");
    assert.equal(sectionOf(prompt, "6b"), CLARIFICATION_6B);
    assert.equal(lineOf(prompt), CLARIFICATION_OPENING_LINE);
    for (const phrase of ["your event", "this inquiry", "what you're looking for", "the right fit"]) {
      assert.ok(sectionOf(prompt, "6b").includes(`"${phrase}"`), phrase);
    }
  });

  it("Clarification Gate G3 both fail examples, the pass example and the deletion test are literal", () => {
    const six = sectionOf(promptOf("S0"), "6b");
    assert.ok(six.includes('Fail (compliment): "What a wonderful way to celebrate!"'));
    assert.ok(six.includes(`Fail (generic acknowledgement): "You're looking for the right music for your event."`));
    assert.ok(six.includes("Pass: \"You said live music next month and haven't picked a format yet"));
    assert.ok(six.includes("Deletion test: remove the words that came from this lead"));
  });
});

describe("Clarification Gate G4: sections 8 and 9 are never edited", () => {
  it("Clarification Gate G4 the section 8 and section 9 blocks of the clarification prompt equal the pre-change blocks", () => {
    const now = promptOf("S0");
    assert.equal(sectionOf(now, "9"), sectionOf(snapshotOf("S0"), "9"));
    assert.equal(sectionOf(now, "8"), sectionOf(snapshotOf("S0"), "8"));
    assert.match(sectionOf(now, "9"), /At least 16 of 18 gut_checks are true/);
  });

  it("Clarification Gate G4 sections 8 and 9 are byte-equal to the snapshot for every other case too", () => {
    for (const c of VERIFY_CASES) {
      const prompt = promptOf(c.id);
      assert.equal(sectionOf(prompt, "9"), sectionOf(snapshotOf(c.id), "9"), `${c.id} section 9`);
      assert.equal(sectionOf(prompt, "8"), sectionOf(snapshotOf(c.id), "8"), `${c.id} section 8`);
    }
  });
});

describe("Clarification Gate G5 / G7: the scope is the mode, not a keyword", () => {
  it("Clarification Gate G5 a quote with an unresolved format keeps the old 6b and gut-check line; clarification differs", () => {
    const clar = promptOf("S0");
    const nearMiss = promptOf("S9");
    assert.notEqual(sectionOf(clar, "6b"), sectionOf(nearMiss, "6b"));
    assert.notEqual(lineOf(clar), lineOf(nearMiss));
    assert.equal(sectionOf(nearMiss, "6b"), sectionOf(snapshotOf("S9"), "6b"));
    assert.equal(lineOf(nearMiss), lineOf(snapshotOf("S9")));
  });

  it("Clarification Gate G7 quote with an unresolved format (S9) does not use the definition (S8 is the vague-quote mode: VG1)", () => {
    for (const id of ["S9"]) {
      assert.ok(!sectionOf(promptOf(id), "6b").includes("This lead is vague"), id);
      assert.notEqual(lineOf(promptOf(id)), CLARIFICATION_OPENING_LINE, id);
    }
  });
});

describe("Clarification Gate G6: the change is exactly the two spans", () => {
  it("Clarification Gate G6 the pre-change clarification prompt with the two spans replaced equals the new prompt", () => {
    const before = snapshotOf("S0");
    const patched = before
      .replace(sectionOf(before, "6b"), CLARIFICATION_6B)
      .replace(lineOf(before), CLARIFICATION_OPENING_LINE);
    assert.notEqual(patched, before, "the replacement did something");
    assert.equal(promptOf("S0"), patched);
  });
});

describe("Clarification Gate G8: the voice-reference block is pinned by hash", () => {
  // SHA-256 of the "VOICE CALIBRATION REFERENCES" block of the unchanged prompt (identical for all 13 cases). Refresh it
  // only with a "snapshot refresh:" commit, like the snapshots.
  const VOICE_BLOCK_SHA256 = "a48c4fbed16d76a2c64c6326d912d45c29f5a3aec1c0c47e832149afb8fc89ef";

  it("Clarification Gate G8 the voice block of every case hashes to the pinned value", () => {
    for (const c of VERIFY_CASES) {
      const block = voiceBlockOf(buildVerifyPrompt(c.classification, c.pricing));
      assert.equal(createHash("sha256").update(block).digest("hex"), VOICE_BLOCK_SHA256, c.id);
    }
  });

  it("Clarification Gate G8 the block is non-trivial and holds both references (the hash is not of an empty string)", () => {
    const block = voiceBlockOf(promptOfRaw("S1"));
    assert.ok(block.length > 1000, `block length ${block.length}`);
    assert.match(block, /Reference: Sparse Cocktail/);
    assert.match(block, /Reference: Patterson/);
  });
});
