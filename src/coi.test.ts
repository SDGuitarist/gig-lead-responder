import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { COI_SENTENCES, coiLine, coiTermsFor, coiViolations, type CoiTerms } from "./pipeline/coi.js";
import { buildGeneratePrompt } from "./prompts/generate.js";
import { NO_DATE_TERMS } from "./pipeline/payment-terms.js";
import { selectContext } from "./pipeline/context.js";
import { budgetGapFor, lookupPrice } from "./pipeline/price.js";
import type { Classification } from "./types.js";

// COI plan Revision 3c, step 2: C1, C2, C8 (mode matrix), C9 (post-check contract), C11 (coiTermsFor half).
// Names start "COI C<n>" so `npm run test:match -- "COI C9"` runs one group.
const inputs = JSON.parse(readFileSync("src/fixtures/prompt-baseline-inputs.json", "utf-8")) as
  Array<{ classification: Classification }>;
const base = inputs[0].classification; // a quoted, direct, T3 lead
const lead = (over: Partial<Classification> = {}): Classification => ({ ...base, ...over }) as Classification;
const priced = (c: Classification) => lookupPrice(c);

const DEFAULT = COI_SENTENCES.default;
const REQUIRED = COI_SENTENCES.required;
const sentence = (s: string): CoiTerms => ({ kind: "sentence", sentence: s });

describe("COI C1 / C2: which sentence", () => {
  it("COI C1 coi_required false or absent chooses exactly the default sentence", () => {
    const c = lead({ coi_required: false });
    assert.deepEqual(coiTermsFor(c, priced(c)), sentence("COI available upon request."));
    const d = lead(); delete (d as { coi_required?: boolean }).coi_required;
    assert.deepEqual(coiTermsFor(d, priced(d)), sentence("COI available upon request."));
  });

  it("COI C2 coi_required true chooses exactly the required sentence", () => {
    const c = lead({ coi_required: true });
    assert.deepEqual(coiTermsFor(c, priced(c)), sentence("I carry liability insurance ($1M/$2M) and can provide COI within a few days of booking."));
  });

  it("COI C11 only a real true counts: a truthy non-boolean on a stored classification is the default", () => {
    for (const v of ["true", "yes", 1, {}]) {
      const c = lead({ coi_required: v as unknown as boolean });
      assert.deepEqual(coiTermsFor(c, priced(c)), sentence(DEFAULT), String(v));
    }
  });
});

describe("COI C8: the mode matrix", () => {
  const none: CoiTerms = { kind: "none" };

  it("COI C8 clarification mode: none", () => {
    const c = lead({ action: "one_question", format_recommended: "unresolved" } as Partial<Classification>);
    assert.deepEqual(coiTermsFor(c, priced(lead())), none);
  });

  it("COI C8 no_viable_scope redirect: none", () => {
    const c = lead();
    const p = priced(c);
    const redirect = { ...p, budget: { ...p.budget, tier: "no_viable_scope" } } as typeof p;
    assert.deepEqual(coiTermsFor(c, redirect), none);
  });

  it("COI C8 residency: none", () => {
    const c = lead();
    const p = { ...priced(c), residency: { tier: "R2" } } as unknown as ReturnType<typeof lookupPrice>;
    assert.deepEqual(coiTermsFor(c, p), none);
  });

  it("COI C8 graceful decline: none (no pitch after the exit line)", () => {
    const c = lead({ graceful_decline: true } as Partial<Classification>);
    assert.deepEqual(coiTermsFor(c, priced(c)), none);
  });

  it("COI C8 a normal quote: a sentence", () => {
    const c = lead();
    assert.equal(coiTermsFor(c, priced(c)).kind, "sentence");
  });

  it("COI C8 a past date: a sentence (still a quoted reply)", () => {
    const c = lead({ past_date_detected: true } as Partial<Classification>);
    assert.equal(coiTermsFor(c, priced(c)).kind, "sentence");
  });

  it("COI C8 a platform lead: a sentence (the COI sentence is not a payment term)", () => {
    const c = lead({ platform: "gigsalad" } as Partial<Classification>);
    assert.equal(coiTermsFor(c, priced(c)).kind, "sentence");
  });

  it("COI C8 a small and a large budget gap: a sentence each", () => {
    for (const stated of [1150, 1000]) {
      const c = lead({ rate_card_tier: "T4", platform: undefined, timeline_band: "urgent", stated_budget: stated } as Partial<Classification>);
      const p = priced(c);
      const withGap = { ...p, budget: budgetGapFor(c, p) } as typeof p;
      assert.ok(["small", "large"].includes(withGap.budget.tier), `setup: ${stated} must reach a gap tier`);
      assert.equal(coiTermsFor(c, withGap).kind, "sentence", String(stated));
    }
  });
});

describe("COI C3 / C4: the Quote Terms line", () => {
  it("COI C3 kind none has no line", () => {
    assert.equal(coiLine({ kind: "none" }), "");
  });

  it("COI C4 a sentence line carries the exact sentence once and the do-not-restate rule", () => {
    for (const s of [DEFAULT, REQUIRED]) {
      const line = coiLine(sentence(s));
      assert.equal(line.split(s).length - 1, 1, "the exact sentence occurs once");
      assert.ok(line.includes("Write no other COI or insurance sentence, and do not restate a venue's COI policy."));
    }
  });
});

describe("COI C9: the post-check contract", () => {
  const D = sentence(DEFAULT);
  const R = sentence(REQUIRED);
  const prefix = (v: string[]) => v.map((x) => x.split(":")[0]);

  it("COI C9 positive control: the default sentence once and no other wording raises no flag", () => {
    assert.deepEqual(coiViolations(`Hi Dana,\n\nSolo guitar is $895. ${DEFAULT}\n\nAlex Guillen`, "full", D), []);
  });

  it("COI C9 positive control: the required sentence (it holds COI and liability insurance) raises no flag", () => {
    assert.deepEqual(coiViolations(`Solo guitar is $895. ${REQUIRED} Want me to lock it in?`, "compressed", R), []);
  });

  it("COI C9 whitespace is collapsed: the sentence across a line break still counts once", () => {
    assert.deepEqual(coiViolations("Price is $895. COI available\n  upon request.", "full", D), []);
  });

  it("COI C9 missing in the full draft", () => {
    assert.deepEqual(prefix(coiViolations("Solo guitar is $895.", "full", D)), ["coi_sentence_missing_full"]);
  });

  it("COI C9 missing in the compressed draft", () => {
    assert.deepEqual(prefix(coiViolations("Solo guitar is $895.", "compressed", D)), ["coi_sentence_missing_compressed"]);
  });

  it("COI C9 repeated in the full draft", () => {
    assert.deepEqual(prefix(coiViolations(`${DEFAULT} Price. ${DEFAULT}`, "full", D)), ["coi_sentence_repeated_full"]);
  });

  it("COI C9 repeated in the compressed draft", () => {
    assert.deepEqual(prefix(coiViolations(`${REQUIRED} ${REQUIRED}`, "compressed", R)), ["coi_sentence_repeated_compressed"]);
  });

  it("COI C9 other COI wording in the full draft (the sentence once)", () => {
    const v = coiViolations(`${DEFAULT} The venue requires a COI.`, "full", D);
    assert.deepEqual(prefix(v), ["coi_other_wording_full"]);
  });

  it("COI C9 other COI wording in the compressed draft (the sentence once)", () => {
    const v = coiViolations(`${DEFAULT} I can send a certificate of insurance.`, "compressed", D);
    assert.deepEqual(prefix(v), ["coi_other_wording_compressed"]);
  });

  it("COI C9 each insurance word in the bounded list fires, and unrelated prose does not", () => {
    for (const w of ["a COI", "a certificate of insurance", "proof of insurance", "liability insurance", "fully insured"]) {
      assert.deepEqual(prefix(coiViolations(`${DEFAULT} I have ${w}.`, "full", D)), ["coi_other_wording_full"], w);
    }
    assert.deepEqual(coiViolations(`${DEFAULT} I will insure the sound is balanced.`, "full", D), []);
  });

  it("COI C9 precedence: a wrong count AND other wording gives exactly the count flag, never both", () => {
    const missing = coiViolations("The venue requires a COI.", "full", D);
    assert.deepEqual(prefix(missing), ["coi_sentence_missing_full"]);
    const twice = coiViolations(`${DEFAULT} ${DEFAULT} The venue requires a COI.`, "full", D);
    assert.deepEqual(prefix(twice), ["coi_sentence_repeated_full"]);
  });

  it("COI C9 one draft can pass while the other fails: one flag, for the failing draft only", () => {
    const full = coiViolations(`Price. ${DEFAULT}`, "full", D);
    const compressed = coiViolations("Price.", "compressed", D);
    assert.deepEqual([...full, ...prefix(compressed)], ["coi_sentence_missing_compressed"]);
  });

  it("COI C9 kind none raises no flag whatever the draft says", () => {
    assert.deepEqual(coiViolations("The venue requires a COI. COI. COI.", "full", { kind: "none" }), []);
  });
});

describe("COI C2 / C3 / C4 in the generate prompt (C5 is the two baseline-equality tests)", () => {
  const gen = (c: Classification, p = priced(c)) => buildGeneratePrompt(c, p, "ctx", NO_DATE_TERMS);
  const COI_MARK = "- COI: use this sentence exactly, once, in both drafts:";

  it("COI C4 a quoted prompt carries the default sentence once, in the Quote Terms block, after the payment line", () => {
    const prompt = gen(lead());
    assert.equal(prompt.split(COI_MARK).length - 1, 1);
    assert.ok(prompt.includes(`${COI_MARK} "${DEFAULT}".`));
    assert.ok(prompt.indexOf(COI_MARK) > prompt.indexOf("- Payment:"), "after the payment line");
    assert.ok(prompt.indexOf(COI_MARK) < prompt.indexOf("- Setup needs:"), "before the setup line");
  });

  it("COI C2 a prompt for a client who requires a COI carries the required sentence and not the default", () => {
    const prompt = gen(lead({ coi_required: true }));
    assert.ok(prompt.includes(`${COI_MARK} "${REQUIRED}".`));
    assert.ok(!prompt.includes(`"${DEFAULT}"`));
  });

  it("COI C3 clarification, no_viable_scope, residency and graceful decline prompts carry no COI line", () => {
    const c = lead();
    const p = priced(c);
    const clar = { ...c, action: "one_question", format_recommended: "unresolved" } as Classification;
    assert.ok(!gen(clar, p).includes(COI_MARK), "clarification");
    assert.ok(!gen(c, { ...p, budget: { ...p.budget, tier: "no_viable_scope" } } as typeof p).includes(COI_MARK), "no_viable_scope");
    assert.ok(!gen(c, { ...p, residency: { tier: "R2" } } as unknown as typeof p).includes(COI_MARK), "residency");
    assert.ok(!gen(lead({ graceful_decline: true } as Partial<Classification>)).includes(COI_MARK), "graceful decline");
  });
});

// D5: the docs the model reads must not teach a COI timeline or "front-load COI" of their own. A corporate lead loads
// the most doc rows (the corporate voice and quick-reference tables).
describe("COI D5: the injected docs defer to the Quote Terms sentence", () => {
  const corporate = { ...base, event_arc: "corporate", rate_card_tier: "T4", format_recommended: "solo" } as unknown as Classification;

  it("COI D5 no doc row says to front-load or list COI, and the one timeline phrase is the app-owned row", async () => {
    const ctx = await selectContext(corporate);
    assert.ok(ctx.length > 1000, "control: the docs loaded");
    for (const bad of ["Front-load self-contained, COI", "Self-contained, COI available", "COI availability, professional setup",
      "Equipment, outdoor capability, COI, setup time"]) {
      assert.ok(!ctx.includes(bad), `stale doc line still injected: ${bad}`);
    }
    assert.equal(ctx.split("within a few days of booking").length - 1, 1, "the timeline phrase appears once");
    assert.ok(ctx.includes("The app writes this sentence"), "and that one is the app-owned row");
  });
});
