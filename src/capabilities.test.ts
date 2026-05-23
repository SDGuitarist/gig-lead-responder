import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ALIAS_MAP,
  ALIAS_MATCHER,
  guessFormatFamily,
  buildAliasMap,
  type CapabilityEntry,
} from "./capabilities.js";

// ── Alias map regression: every keyword from the old ALEX_ALIAS_MAP ──

describe("capabilities — alias map regression", () => {
  const ALIAS_MAP_KEYWORDS = [
    ["guitar", "KNOWN"], ["acoustic guitar", "KNOWN"], ["guitarist", "KNOWN"],
    ["spanish guitar", "KNOWN"], ["classical guitar", "KNOWN"],
    ["nylon string", "KNOWN"], ["flamenco", "KNOWN"],
    ["flamenco guitar", "KNOWN"], ["ukulele", "KNOWN"], ["uke", "KNOWN"],
    ["ukulele player", "KNOWN"], ["mariachi", "KNOWN"],
    ["mariachi band", "KNOWN"], ["mariachi ensemble", "KNOWN"],
    ["bolero", "KNOWN"], ["bolero trio", "KNOWN"], ["trio", "KNOWN"],
    ["solo", "KNOWN"], ["duo", "KNOWN"], ["musician", "KNOWN"],
    ["live music", "KNOWN"], ["background music", "KNOWN"],
    ["latin band", "ESCALATE"], ["spanish music", "ESCALATE"],
    ["hawaiian music", "ESCALATE"], ["latin music", "ESCALATE"],
    ["ensemble", "ESCALATE"],
  ] as const;

  for (const [keyword, expectedStatus] of ALIAS_MAP_KEYWORDS) {
    it(`"${keyword}" -> ${expectedStatus}`, () => {
      assert.equal(ALIAS_MAP[keyword], expectedStatus);
    });
  }

  // Standalone aliases added for regex behavior parity
  it('"acoustic" -> KNOWN (standalone alias)', () => {
    assert.equal(ALIAS_MAP["acoustic"], "KNOWN");
  });
  it('"classical" -> KNOWN (standalone alias)', () => {
    assert.equal(ALIAS_MAP["classical"], "KNOWN");
  });
});

// ── Family guesser regression: every match from the old guessFormatFamily() ──

describe("capabilities — family guesser regression", () => {
  const FAMILY_KEYWORDS = [
    ["mariachi band", "mariachi"],
    ["flamenco guitar for dinner", "flamenco"],
    ["bolero trio", "bolero"],
    ["solo guitar", "solo"],
    ["acoustic guitarist", "solo"],
    ["classical guitar", "solo"],
    ["duo for our party", "solo"],
    ["a pair of musicians", "solo"],
    ["need two players", "solo"],
    // Standalone words — must match (preserves old regex behavior)
    ["acoustic entertainment", "solo"],
    ["classical music for dinner", "solo"],
    // Currently returns null
    ["live music", null],
    ["jazz band", null],
    ["something fun", null],
  ] as const;

  for (const [input, expectedFamily] of FAMILY_KEYWORDS) {
    it(`"${input}" -> ${expectedFamily}`, () => {
      assert.equal(guessFormatFamily(input), expectedFamily);
    });
  }
});

// ── Intentional null-family cases ──

describe("capabilities — intentional null-family", () => {
  const INTENTIONAL_NULL_FAMILY = [
    "trio",           // could be bolero or mariachi
    "musician",       // too generic
    "live music",     // too generic
    "background music", // too generic
    "latin band",     // ESCALATE, no family
    "spanish music",  // ESCALATE, no family
    "hawaiian music", // ESCALATE, no family
    "ensemble",       // ESCALATE, no family
  ];

  for (const keyword of INTENTIONAL_NULL_FAMILY) {
    it(`"${keyword}" -> null (intentional)`, () => {
      assert.equal(guessFormatFamily(keyword), null);
    });
  }
});

// ── FAMILY_ONLY_ALIASES: in family guesser, NOT in alias map ──

describe("capabilities — family-only aliases", () => {
  it('"pair" -> "solo" in family guesser (family-only alias)', () => {
    assert.equal(guessFormatFamily("a pair of musicians"), "solo");
  });
  it('"two" -> "solo" in family guesser (family-only alias)', () => {
    assert.equal(guessFormatFamily("need two players"), "solo");
  });
  it('"pair" is NOT a capability alias (preserves unknown_capability)', () => {
    assert.equal(ALIAS_MAP["pair"], undefined);
  });
  it('"two" is NOT a capability alias (preserves unknown_capability)', () => {
    assert.equal(ALIAS_MAP["two"], undefined);
  });
});

// ── Duplicate alias guard ──

describe("capabilities — duplicate alias guard", () => {
  it("throws on duplicate alias", () => {
    const duped: CapabilityEntry[] = [
      { aliases: ["guitar"], status: "KNOWN", formatFamily: "solo" },
      { aliases: ["guitar"], status: "ESCALATE", formatFamily: null },
    ];
    assert.throws(() => buildAliasMap(duped), /Duplicate alias "guitar"/);
  });
});

// ── Longest-first precedence ──

describe("capabilities — longest-first precedence", () => {
  it('"mariachi ensemble" matches KNOWN before "ensemble" matches ESCALATE', () => {
    const matched = ALIAS_MATCHER.find(({ alias }) =>
      "mariachi ensemble".includes(alias)
    );
    assert.equal(matched?.alias, "mariachi ensemble");
    assert.equal(matched?.status, "KNOWN");
  });
});
