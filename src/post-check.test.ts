import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { postCheckDrafts } from "./pipeline/post-check.js";

const CLEAN_DRAFT = "A solo ukulele set for your ceremony, ninety minutes under the oak tree. Rate: $650.\n\nAlex Guillen";

// ── Soft refusal detection ──

describe("postCheckDrafts — soft refusal detection", () => {
  it("catches 'not really my specialty' in full_draft", () => {
    const result = postCheckDrafts(
      "Ukulele is not really my specialty, but I can try.",
      CLEAN_DRAFT,
    );
    assert.ok(result.violations.some((v) => v.startsWith("soft_refusal_full")));
  });

  it("catches 'not really my specialty' in compressed_draft", () => {
    const result = postCheckDrafts(
      CLEAN_DRAFT,
      "Ukulele is not really my specialty, but I can try.",
    );
    assert.ok(result.violations.some((v) => v.startsWith("soft_refusal_compressed")));
  });

  it("catches 'may not be the best fit'", () => {
    const result = postCheckDrafts(
      "This may not be the best fit for what you need.",
      CLEAN_DRAFT,
    );
    assert.ok(result.violations.some((v) => v.startsWith("soft_refusal_full")));
  });

  it("catches 'you might want to look elsewhere'", () => {
    const result = postCheckDrafts(
      "You might want to look for a dedicated ukulele specialist.",
      CLEAN_DRAFT,
    );
    assert.ok(result.violations.some((v) => v.startsWith("soft_refusal_full")));
  });

  it("catches 'not something I typically offer'", () => {
    const result = postCheckDrafts(
      "That's not something I typically offer for events.",
      CLEAN_DRAFT,
    );
    assert.ok(result.violations.some((v) => v.startsWith("soft_refusal_full")));
  });

  it("catches 'I'd recommend looking elsewhere'", () => {
    const result = postCheckDrafts(
      "I'd recommend looking elsewhere for a banjo player.",
      CLEAN_DRAFT,
    );
    assert.ok(result.violations.some((v) => v.startsWith("soft_refusal_full")));
  });

  it("catches both soft refusal AND banned phrase in same draft", () => {
    const result = postCheckDrafts(
      "Ukulele is not really my specialty, but I'd be happy to help.",
      CLEAN_DRAFT,
    );
    assert.ok(result.violations.some((v) => v.startsWith("soft_refusal_full")));
    assert.ok(result.violations.some((v) => v.startsWith("banned_phrase_full")));
  });

  // False-positive guards
  it("does NOT flag 'A solo ukulele set for your ceremony'", () => {
    const result = postCheckDrafts(CLEAN_DRAFT, CLEAN_DRAFT);
    assert.ok(!result.violations.some((v) => v.includes("soft_refusal")));
  });

  it("does NOT flag 'I focus the setlist on your playlist'", () => {
    const result = postCheckDrafts(
      "I focus the setlist on your playlist and read the room from there. Rate: $650.\n\nAlex Guillen",
      CLEAN_DRAFT,
    );
    assert.ok(!result.violations.some((v) => v.includes("soft_refusal")));
  });
});

// ── A5: New soft-refusal patterns ──

describe("postCheckDrafts — A5 soft refusal patterns", () => {
  // VIOLATIONS
  const SHOULD_VIOLATE = [
    "I primarily focus on other styles",
    "I primarily specialize in different genres",
    "while drums isn't my main instrument",
    "while this style isn't my primary focus",
  ];

  for (const text of SHOULD_VIOLATE) {
    it(`flags: "${text}"`, () => {
      const result = postCheckDrafts(text, text);
      assert.ok(
        result.violations.some((v) => v.includes("soft_refusal")),
        `Expected soft_refusal violation for: "${text}"`,
      );
    });
  }

  // NO VIOLATION
  const SHOULD_NOT_VIOLATE = [
    "I primarily focus on creating the perfect atmosphere",
    "I focus primarily on Spanish guitar",
    "My primary focus is live acoustic music",
    "I bring a unique focus to every event",
  ];

  for (const text of SHOULD_NOT_VIOLATE) {
    it(`does not flag: "${text}"`, () => {
      const result = postCheckDrafts(text, text);
      assert.ok(
        !result.violations.some((v) => v.includes("soft_refusal")),
        `Unexpected soft_refusal violation for: "${text}"`,
      );
    });
  }
});
