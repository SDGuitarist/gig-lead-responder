import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { openingOf, sentenceCount, wordCount } from "./draft-opening.js";

// Codex code review round 1, P2-2 (docs/reviews/2026-10-13-clarification-gate-code-codex-round1.md): the runner's
// `opening` is the first CONTENT sentence of a draft, with a leading salutation removed whether it shares the line
// or has its own. Names start "Draft Opening O<n>".
describe("Draft Opening: the first content sentence", () => {
  it("Draft Opening O1 a same-line salutation is removed", () => {
    assert.equal(openingOf("Hi Sarah, a good night. Solo guitar, $650, 2 hours."), "a good night.");
    assert.equal(openingOf("Hello Sam Lee, a quiet start. Then the room fills."), "a quiet start.");
    assert.equal(openingOf("Hi, a good night. More."), "a good night.");
  });

  it("Draft Opening O2 a salutation on its own line is removed", () => {
    assert.equal(openingOf("Hi Sarah,\n\nA good night. Solo guitar."), "A good night.");
    assert.equal(openingOf("Dear Alondra,\nA private evening, then the question."), "A private evening, then the question.");
  });

  it("Draft Opening O3 a draft with no salutation keeps its first sentence", () => {
    assert.equal(openingOf("Spring in San Diego, a private event coming together. And more."), "Spring in San Diego, a private event coming together.");
    assert.equal(openingOf("  \n\nOne line only"), "One line only");
  });

  it("Draft Opening O4 a comma-ending phrase that is not a salutation is NOT removed (positive control)", () => {
    assert.equal(openingOf("Before I say anything else,\nthis is the line."), "Before I say anything else,");
    assert.equal(openingOf("Spring, a private event. More."), "Spring, a private event.");
    assert.equal(openingOf("Highly rated, and booked for a wedding. More."), "Highly rated, and booked for a wedding.");
  });

  it("Draft Opening O5 an empty draft is an empty opening", () => {
    assert.equal(openingOf(""), "");
    assert.equal(openingOf("  \n "), "");
  });
});

describe("Draft Opening: counts for the shape measurement", () => {
  it("Draft Opening O6 sentences and words exclude the salutation and the sign-off", () => {
    const d = "Hi Sarah,\n\nA good night is coming. It runs 2.5 hours! Which do you prefer: quiet or featured?\n\nAlex Guillen";
    assert.equal(sentenceCount(d), 3);
    assert.equal(wordCount(d), 16);
  });

  it("Draft Opening O7 a decimal or an abbreviation without a following space is not a break; empty is zero", () => {
    assert.equal(sentenceCount("It is 3.5 hours.\nAlex Guillen"), 1);
    assert.equal(sentenceCount(""), 0);
    assert.equal(wordCount(""), 0);
  });

  it("Draft Opening O8 a draft without a sign-off keeps its last sentence (positive control)", () => {
    assert.equal(sentenceCount("One. Two. Three"), 3);
    assert.equal(wordCount("One. Two. Three"), 3);
  });
});
