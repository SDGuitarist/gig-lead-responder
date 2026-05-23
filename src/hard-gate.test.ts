import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checkHardGate } from "./pipeline/hard-gate.js";
import { sanitizeClassification } from "./utils/sanitize.js";
import type { Classification } from "./types.js";

function makeClassification(overrides: Partial<Classification> = {}): Classification {
  return {
    mode: "evaluation",
    action: "quote",
    vagueness: "clear",
    competition_level: "medium",
    competition_quote_count: 5,
    stealth_premium: false,
    stealth_premium_signals: [],
    tier: "standard",
    rate_card_tier: "T2",
    lead_source_column: "P",
    price_point: "slight_premium",
    format_requested: "guitarist",
    format_recommended: "solo",
    duration_hours: 2,
    stated_budget: null,
    timeline_band: "comfortable",
    close_type: "soft_hold",
    cultural_context_active: false,
    cultural_tradition: null,
    planner_effort_active: false,
    social_proof_active: false,
    context_modifiers: [],
    event_date_iso: null,
    event_energy: null,
    flagged_concerns: [],
    venue_name: null,
    client_first_name: null,
    ...overrides,
  };
}

// ── Check 3: Capability alias map ──

describe("checkHardGate — capability alias map", () => {
  it("passes with no flags for 'ukulele'", () => {
    const result = checkHardGate(
      makeClassification({ format_requested: "ukulele" }),
      "Looking for a ukulele player",
    );
    assert.equal(result.pass, true);
    assert.ok(!result.flags.includes("unknown_capability"));
    assert.ok(!result.flags.includes("ambiguous_capability"));
  });

  it("passes with no flags for 'uke'", () => {
    const result = checkHardGate(
      makeClassification({ format_requested: "uke" }),
      "Need a uke for cocktail hour",
    );
    assert.equal(result.pass, true);
    assert.ok(!result.flags.includes("unknown_capability"));
    assert.ok(!result.flags.includes("ambiguous_capability"));
  });

  it("passes with no flags for 'spanish guitar'", () => {
    const result = checkHardGate(
      makeClassification({ format_requested: "spanish guitar" }),
      "Looking for Spanish guitar",
    );
    assert.equal(result.pass, true);
    assert.ok(!result.flags.includes("unknown_capability"));
  });

  it("passes with no flags for 'mariachi band'", () => {
    const result = checkHardGate(
      makeClassification({ format_requested: "mariachi band" }),
      "Need mariachi for quinceañera",
    );
    assert.equal(result.pass, true);
    assert.ok(!result.flags.includes("unknown_capability"));
  });

  it("flags 'ambiguous_capability' for 'latin band'", () => {
    const result = checkHardGate(
      makeClassification({ format_requested: "latin band" }),
      "Looking for a Latin band",
    );
    assert.equal(result.pass, true);
    assert.ok(result.flags.includes("ambiguous_capability"));
  });

  it("flags 'ambiguous_capability' for 'spanish music'", () => {
    const result = checkHardGate(
      makeClassification({ format_requested: "spanish music" }),
      "Need Spanish music for event",
    );
    assert.equal(result.pass, true);
    assert.ok(result.flags.includes("ambiguous_capability"));
  });

  it("flags 'unknown_capability' for 'charango'", () => {
    const result = checkHardGate(
      makeClassification({ format_requested: "charango" }),
      "Looking for a charango player",
    );
    assert.equal(result.pass, true);
    assert.ok(result.flags.includes("unknown_capability"));
  });

  it("flags 'unknown_capability' for 'mandolin'", () => {
    const result = checkHardGate(
      makeClassification({ format_requested: "mandolin" }),
      "Mandolin player needed",
    );
    assert.equal(result.pass, true);
    assert.ok(result.flags.includes("unknown_capability"));
  });

  it("flags 'unknown_capability' for 'vihuela'", () => {
    const result = checkHardGate(
      makeClassification({ format_requested: "vihuela" }),
      "Need a vihuela for event",
    );
    assert.equal(result.pass, true);
    assert.ok(result.flags.includes("unknown_capability"));
  });

  it("passes with no flags for 'mariachi ensemble' (longer alias wins over 'ensemble' ESCALATE)", () => {
    const result = checkHardGate(
      makeClassification({ format_requested: "mariachi ensemble" }),
      "Need mariachi ensemble for wedding",
    );
    assert.equal(result.pass, true);
    assert.ok(!result.flags.includes("ambiguous_capability"));
    assert.ok(!result.flags.includes("unknown_capability"));
  });

  it("passes with no flags for uppercase 'SPANISH GUITAR' (case insensitive)", () => {
    const result = checkHardGate(
      makeClassification({ format_requested: "SPANISH GUITAR" }),
      "Looking for Spanish guitar",
    );
    assert.equal(result.pass, true);
    assert.ok(!result.flags.includes("unknown_capability"));
  });

  it("passes with no capability flags when format_requested is empty", () => {
    const result = checkHardGate(
      makeClassification({ format_requested: "" }),
      "Some lead text",
    );
    assert.equal(result.pass, true);
    assert.ok(!result.flags.includes("unknown_capability"));
    assert.ok(!result.flags.includes("ambiguous_capability"));
  });

  // Regression: existing behavior unchanged
  it("still fails hard gate for 'DJ' (existing behavior)", () => {
    const result = checkHardGate(
      makeClassification({ format_requested: "DJ" }),
      "Need a DJ for party",
    );
    assert.equal(result.pass, false);
    assert.ok(result.fail_reasons.length > 0);
  });

  it("still passes with no flags for 'guitar' (existing behavior)", () => {
    const result = checkHardGate(
      makeClassification({ format_requested: "guitar" }),
      "Looking for a guitarist",
    );
    assert.equal(result.pass, true);
    assert.ok(!result.flags.includes("unknown_capability"));
    assert.ok(!result.flags.includes("ambiguous_capability"));
  });
});

// ── A2: Normalization + plural aliases ──

describe("checkHardGate — normalization + plurals", () => {
  it("matches double-spaced input via hard gate", () => {
    const result = checkHardGate(
      makeClassification({ format_requested: "acoustic  guitar" }),
      "",
    );
    assert.ok(!result.flags.includes("unknown_capability"));
  });

  it("matches plural alias 'guitarists'", () => {
    const result = checkHardGate(
      makeClassification({ format_requested: "guitarists" }),
      "",
    );
    assert.ok(!result.flags.includes("unknown_capability"));
  });

  it("matches plural alias 'musicians'", () => {
    const result = checkHardGate(
      makeClassification({ format_requested: "musicians" }),
      "",
    );
    assert.ok(!result.flags.includes("unknown_capability"));
  });

  it("matches plural alias 'ukuleles'", () => {
    const result = checkHardGate(
      makeClassification({ format_requested: "ukuleles" }),
      "",
    );
    assert.ok(!result.flags.includes("unknown_capability"));
  });

  it("double-spaced 'rock  band' still declines", () => {
    const result = checkHardGate(
      makeClassification({ format_requested: "rock  band" }),
      "",
    );
    assert.equal(result.pass, false);
  });
});

// ── A3: Drum word-boundary regex ──

describe("checkHardGate — drum regex (word-boundary)", () => {
  // Positive matches — should trigger decline
  for (const input of ["drum", "drums", "drummer", "drumline", "drum circle"]) {
    it(`declines "${input}"`, () => {
      const result = checkHardGate(
        makeClassification({ format_requested: input }),
        "",
      );
      assert.equal(result.pass, false);
    });
  }

  // Negative matches — should NOT trigger decline
  for (const input of ["eardrum", "conundrum"]) {
    it(`does not decline "${input}"`, () => {
      const result = checkHardGate(
        makeClassification({ format_requested: input }),
        "",
      );
      // These should pass the hard gate (no drum match)
      // They'll get unknown_capability flag, but pass is true
      assert.equal(result.pass, true);
    });
  }

  // Existing format should still pass
  it("acoustic guitar is unaffected by drum regex", () => {
    const result = checkHardGate(
      makeClassification({ format_requested: "acoustic guitar" }),
      "",
    );
    assert.equal(result.pass, true);
    assert.ok(!result.flags.includes("unknown_capability"));
  });
});

// ── A4: sanitizeClassification before hard gate ──

describe("checkHardGate — sanitize before gate", () => {
  it("under-200-char format_requested is behaviorally unchanged", () => {
    const sanitized = sanitizeClassification(
      makeClassification({ format_requested: "flamenco guitar" }),
    );
    const result = checkHardGate(sanitized, "");
    assert.ok(!result.flags.includes("unknown_capability"));
  });

  it("truncation does not turn a valid alias into unknown_capability", () => {
    const sanitized = sanitizeClassification(
      makeClassification({ format_requested: "acoustic guitar" }),
    );
    assert.equal(sanitized.format_requested, "acoustic guitar");
    const result = checkHardGate(sanitized, "");
    assert.ok(!result.flags.includes("unknown_capability"));
  });

  it("200+ char format_requested of non-alias text flags unknown_capability", () => {
    const stuffed = "x".repeat(201);
    const sanitized = sanitizeClassification(
      makeClassification({ format_requested: stuffed }),
    );
    const result = checkHardGate(sanitized, "");
    assert.ok(result.flags.includes("unknown_capability"));
  });

  it("alias at start of 200+ char input is preserved after truncation", () => {
    const longFormat = "acoustic guitar " + "x".repeat(200);
    const sanitized = sanitizeClassification(
      makeClassification({ format_requested: longFormat }),
    );
    // "acoustic guitar" is at the start (15 chars) — within the 200 char limit
    const result = checkHardGate(sanitized, "");
    assert.ok(!result.flags.includes("unknown_capability"));
  });
});
