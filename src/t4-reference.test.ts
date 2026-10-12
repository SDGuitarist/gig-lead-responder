import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { T4_REFERENCE_REPLY, buildT4ReferenceBlock } from "./data/t4-reference.js";
import { PAYMENT_SENTENCES } from "./pipeline/payment-terms.js";
import { VENUE_HISTORY_HEADER } from "./venue-history.js";
import type { Classification } from "./types.js";

// Plan docs/plans/2026-10-11-feat-t4-reference-lead-plan.md (Revision 1b), step 1: T1, T3, T4, T5 at block level.
// The prompt-level checks (T2, T6) come with step 2, when the block is inserted in buildGeneratePrompt.
// Names start "T4 reference T<n>" so `npm run test:match -- "T4 reference T3"` runs one.

type Ctx = Pick<Classification, "rate_card_tier" | "timeline_band">;
const T4_URGENT: Ctx = { rate_card_tier: "T4", timeline_band: "urgent" };
const T4_COMFORTABLE: Ctx = { rate_card_tier: "T4", timeline_band: "comfortable" };

const OPEN_AVAILABILITY = "OPENING: availability first, then the cinematic line.";
const OPEN_CINEMATIC = "OPENING: cinematic line first, then availability.";

const D6_WORDS = ["played", "performed", "last time", "again", "familiar with", "I know", "my usual"];

function sentencesNamingTheDel(text: string): string[] {
  return text.split(/(?<=[.?!])\s+|\n+/).filter((s) => /\bthe Del\b|\bDel's\b/.test(s));
}

/** D6 words found in any sentence that names the Del (plan Revision 1b: not the whole reply). */
function d6Violations(text: string): string[] {
  const found: string[] = [];
  for (const s of sentencesNamingTheDel(text)) {
    for (const w of D6_WORDS) if (new RegExp(`\\b${w}\\b`, "i").test(s)) found.push(w);
  }
  return found;
}

describe("T4 reference T1: the block is T4-only", () => {
  it("T4 reference T1 a T4 lead gets the section header and the example reply", () => {
    const block = buildT4ReferenceBlock(T4_URGENT);
    assert.ok(block.includes("## REFERENCE LEAD: T4 CORPORATE"), "section header missing");
    assert.ok(block.includes(T4_REFERENCE_REPLY), "example reply missing");
  });

  it("T4 reference T1 tiers T1, T2 and T3 get an empty string", () => {
    for (const tier of ["T1", "T2", "T3"] as const) {
      assert.equal(buildT4ReferenceBlock({ rate_card_tier: tier, timeline_band: "urgent" }), "", tier);
    }
  });
});

describe("T4 reference T3: the opening order follows the timeline band", () => {
  it("T4 reference T3 urgent: availability first, and never the other line", () => {
    const block = buildT4ReferenceBlock(T4_URGENT);
    assert.ok(block.includes(OPEN_AVAILABILITY), "availability-first line missing");
    assert.ok(!block.includes(OPEN_CINEMATIC), "cinematic-first line must not appear");
  });

  it("T4 reference T3 short and comfortable: cinematic first, and never the other line", () => {
    for (const band of ["short", "comfortable"] as const) {
      const block = buildT4ReferenceBlock({ ...T4_COMFORTABLE, timeline_band: band });
      assert.ok(block.includes(OPEN_CINEMATIC), `${band}: cinematic-first line missing`);
      assert.ok(!block.includes(OPEN_AVAILABILITY), `${band}: availability-first line must not appear`);
    }
  });
});

describe("T4 reference T4: the rule lines are literal", () => {
  const block = buildT4ReferenceBlock(T4_URGENT);

  it("T4 reference T4 states no invented facts", () => {
    assert.ok(block.includes("NO INVENTED FACTS"));
  });

  it("T4 reference T4 states only played spaces and names the venue-history header by its constant", () => {
    assert.ok(block.includes("ONLY PLAYED SPACES"));
    assert.ok(VENUE_HISTORY_HEADER.length > 0);
    assert.ok(block.includes(`## ${VENUE_HISTORY_HEADER}`), "header value missing");
  });

  it("T4 reference T4 says the payment sentence comes from Quote Terms only", () => {
    assert.ok(block.includes("PAYMENT: the sentence comes from the Quote Terms section only"));
  });

  it("T4 reference T4 says the example is not evidence about any other venue", () => {
    assert.ok(block.includes("The example describes one lead's venue; it is not evidence about any other venue."));
  });
});

describe("T4 reference T5: the example reply is clean", () => {
  const reply = T4_REFERENCE_REPLY;

  it("T4 reference T5 has no dollar figure, phone number, deposit amount or business name", () => {
    assert.ok(!/\$\d/.test(reply), "dollar figure");
    assert.ok(!/\(\d{3}\)\s*\d{3}-\d{4}/.test(reply), "phone number");
    assert.ok(!reply.includes("50%"), "50% (the deposit sentence is not this lead's)");
    assert.ok(!/pacific flow/i.test(reply), "business name");
  });

  it("T4 reference T5 greets Dana and signs with the name only (the source client's real name is not in the repo)", () => {
    const lines = reply.split("\n").map((l) => l.trim());
    assert.equal(lines[0], "Hi Dana,");
    assert.equal(lines[lines.length - 1], "Alex Guillen");
  });

  it("T4 reference T5 carries the payment sentence from the code constant exactly once", () => {
    assert.equal(reply.split(PAYMENT_SENTENCES.full).length - 1, 1);
  });

  it("T4 reference T5 keeps the price as a placeholder", () => {
    assert.ok(reply.includes("[QUOTED_PRICE]"));
  });

  it("T4 reference T5 makes no played-here claim in a sentence that names the Del (D6)", () => {
    assert.equal(sentencesNamingTheDel(reply).length, 2, "expected the two sentences that name the Del");
    assert.deepEqual(d6Violations(reply), []);
  });

  it("T4 reference T5 the D6 check can fail: known-bad text trips it (positive control)", () => {
    assert.deepEqual(d6Violations("I've played the Del's beach before. Surf is loud."), ["played"]);
    assert.deepEqual(d6Violations("Familiar songs, played softly."), []); // not a sentence naming the Del
  });
});
