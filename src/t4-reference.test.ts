import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { T4_REFERENCE_REPLY, buildT4ReferenceBlock } from "./data/t4-reference.js";
import { PAYMENT_SENTENCES } from "./pipeline/payment-terms.js";
import { VENUE_HISTORY_HEADER } from "./venue-history.js";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { buildGeneratePrompt } from "./prompts/generate.js";
import { buildVerifyPrompt } from "./prompts/verify.js";
import { lookupPrice } from "./pipeline/price.js";
import { paymentLine, type PaymentTerms } from "./pipeline/payment-terms.js";
import { VOICE_REFERENCES } from "./data/voice-references.js";
import type { Classification } from "./types.js";

// Plan docs/plans/2026-10-11-feat-t4-reference-lead-plan.md (Revision 1b), step 1: T1, T3, T4, T5 at block level.
// Step 2 (prompt level): T1 in the generate prompt, T2, T6, and the quoteTermsOff gate (a deviation, see below).
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

  it("T4 reference T1 the block lists the seven steps in order", () => {
    const block = buildT4ReferenceBlock(T4_URGENT);
    assert.ok(block.includes("The order, as steps:"));
    let at = block.indexOf("The order, as steps:");
    for (let n = 1; n <= 7; n++) {
      const next = block.indexOf(`\n${n}. `, at);
      assert.ok(next > at, `step ${n} missing or out of order`);
      at = next;
    }
    assert.ok(!block.includes("\n8. "), "there are seven steps");
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

  it("T4 reference T4 forbids mentioning battery-powered sound", () => {
    assert.ok(block.includes("Never mention battery-powered sound"));
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

// ---- step 2: the block inside buildGeneratePrompt, and the boundary around it ----

const MARKER = "REFERENCE LEAD: T4";
const OLD_LINE = "- A 50% deposit holds the date. Say it plainly, once, near the price.";
const inputs = JSON.parse(readFileSync("src/fixtures/prompt-baseline-inputs.json", "utf-8")) as
  Array<{ name: string; context: string; classification: Classification }>;
const termsFor = (c: Classification): PaymentTerms =>
  c.platform === "gigsalad" ? { kind: "platform" } : { kind: "sentence", sentence: "A 50% deposit holds the date." };

function gen(c: Classification, ctx = "ctx"): string {
  return buildGeneratePrompt(c, lookupPrice(c), ctx, termsFor(c));
}
function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}
// A direct, T4, solo-guitar lead built from the first fixture (a priced, quote-mode lead).
const t4Lead = (over: Partial<Classification> = {}): Classification =>
  ({ ...inputs[0].classification, rate_card_tier: "T4", platform: undefined, timeline_band: "urgent", ...over }) as Classification;

describe("T4 reference T1 (prompt level): the generate prompt carries the block for T4 only", () => {
  it("T4 reference T1 a T4 prompt has the block exactly once, after the voice examples and before the reasoning step", () => {
    const c = t4Lead();
    const prompt = gen(c);
    assert.equal(count(prompt, "## REFERENCE LEAD: T4 CORPORATE"), 1);
    assert.ok(prompt.includes(buildT4ReferenceBlock(c)), "the block text is not in the prompt verbatim");
    const at = prompt.indexOf("## REFERENCE LEAD: T4 CORPORATE");
    assert.ok(prompt.indexOf("## VOICE EXAMPLES") < at, "block must come after the voice examples");
    assert.ok(at < prompt.indexOf("## STEP 1: REASON"), "block must come before the reasoning step");
  });
});

describe("T4 reference T2: non-T4 prompts are untouched", () => {
  it("T4 reference T2 tiers T1, T2 and T3 prompts contain no T4 reference marker", () => {
    for (const { name, classification } of inputs) {
      for (const tier of ["T1", "T2", "T3"] as const) {
        const prompt = gen({ ...classification, rate_card_tier: tier });
        assert.ok(!prompt.includes(MARKER), `${name} as ${tier}`);
      }
    }
  });

  it("T4 reference T2 every baseline fixture prompt equals its recorded baseline (only the payment line differs)", () => {
    for (const { name, context, classification } of inputs) {
      const before = readFileSync(`src/fixtures/prompt-baseline/${name}.txt`, "utf-8");
      const t = termsFor(classification);
      const now = buildGeneratePrompt(classification, lookupPrice(classification), context, t);
      assert.equal(now, before.replace(OLD_LINE, paymentLine(t)), name);
    }
  });

  // A T4 lead that gets no quote has no price and no payment line, so a "price, then payment" reference would
  // contradict the rest of the prompt. The gate is the same quoteTermsOff the Quote Terms block uses.
  it("T4 reference T2 a T4 lead in clarification mode carries no block", () => {
    const base = t4Lead();
    const clar = { ...base, action: "one_question", format_recommended: "unresolved" } as Classification;
    const prompt = buildGeneratePrompt(clar, lookupPrice(base), "ctx", { kind: "none" });
    assert.ok(!prompt.includes(MARKER));
  });

  it("T4 reference T2 a T4 lead redirected as no viable scope carries no block", () => {
    const base = t4Lead();
    const pricing = lookupPrice(base);
    const redirect = { ...pricing, budget: { ...pricing.budget, tier: "no_viable_scope" } } as typeof pricing;
    assert.ok(!buildGeneratePrompt(base, redirect, "ctx", { kind: "none" }).includes(MARKER));
  });

  it("T4 reference T2 control: the same T4 lead with a quote does carry the block", () => {
    assert.ok(gen(t4Lead()).includes(MARKER));
  });
});

describe("T4 reference T6: the boundary around the block", () => {
  it("T4 reference T6 the verify prompt never carries the reference or its first 30 characters", () => {
    const c = t4Lead();
    const verify = buildVerifyPrompt(c, lookupPrice(c));
    assert.ok(!verify.includes(MARKER));
    assert.ok(!verify.includes(T4_REFERENCE_REPLY.slice(0, 30)));
  });

  it("T4 reference T6 VOICE_REFERENCES is unchanged (count, names, types, active flags)", () => {
    assert.deepEqual(VOICE_REFERENCES.map((r) => [r.name, r.type, r.active]), [
      ["Miranda", "platform_budget_mismatch", true],
      ["Starikov", "sparse_social", true],
      ["Carlsbad Flamenco", "cultural_heritage", true],
      ["Sparse Cocktail", "minimal_detail", true],
      ["Patterson", "premium_wedding", true],
      ["Dang", "corporate", false],
      ["Eilynn Memorial", "urgent_emotional", false],
      ["Cuban Birthday", "sourced_cultural_duo", false],
    ]);
  });

  it("T4 reference T6 no source file but generate.ts imports the T4 reference module", () => {
    assert.deepEqual(importersOf(sourceFiles("src"), "t4-reference"), ["src/prompts/generate.ts"]);
  });

  it("T4 reference T6 the import scan can fail: a synthetic importer is found (positive control)", () => {
    const fake = new Map([
      ["src/a.ts", `import { x } from "./data/t4-reference.js";`],
      ["src/b.ts", `import { y } from "./other.js";`],
      ["src/data/t4-reference.ts", `export const T4_REFERENCE_REPLY = "";`],
    ]);
    assert.deepEqual(importersOf(fake, "t4-reference"), ["src/a.ts"]);
  });
});

/** Non-test .ts files under `dir`, as path -> text. */
function sourceFiles(dir: string, out = new Map<string, string>()): Map<string, string> {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) sourceFiles(path, out);
    else if (path.endsWith(".ts") && !path.endsWith(".test.ts")) out.set(path, readFileSync(path, "utf-8"));
  }
  return out;
}

/** Files (not the module itself) with an import or export-from naming `moduleStem`. */
function importersOf(files: Map<string, string>, moduleStem: string): string[] {
  const re = new RegExp(`from\\s+["'][^"']*${moduleStem}(\\.js)?["']`);
  return [...files].filter(([path, text]) => !path.endsWith(`${moduleStem}.ts`) && re.test(text)).map(([p]) => p).sort();
}
