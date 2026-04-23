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
