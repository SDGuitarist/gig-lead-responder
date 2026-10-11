import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { setClaudeRequesterForTests } from "./claude.js";
import { runPipeline, runEditPipeline } from "./run-pipeline.js";
import { postCheckDrafts } from "./pipeline/post-check.js";
import { lookupPrice } from "./pipeline/price.js";
import { PAYMENT_SENTENCES, type PaymentTerms } from "./pipeline/payment-terms.js";
import { GUT_CHECK_KEYS, type Classification } from "./types.js";

// Payment terms plan (2026-10-11): P9 the post-check; P10-P13 one PaymentTerms per run, through retries, edits and
// the post-check. The model is stubbed; every run injects `today`.
const { full, twoWeeks, noDate } = PAYMENT_SENTENCES;
const sentence = (s: string): PaymentTerms => ({ kind: "sentence", sentence: s });
const violations = (text: string, terms: PaymentTerms) =>
  postCheckDrafts(text, text, undefined, { paymentTerms: terms }).violations.filter((v) => v.startsWith("payment_terms_"));

const MUST_FLAG = ["Payment is due in full before the event.", "payment through the app", "The remaining amount is payable upon signing.",
  "Please pay 50% upfront.", "the entire amount upfront", "the rest is due", "pay in full", "a retainer", "a deposit", "Invoices are payable on receipt."];
const MUST_NOT_FLAG = ["I balance the sound for the room.", "Pay attention to the toasts.", "It pays off.", "a full program",
  "the rest of the night", "due to the wind"];

describe("payment terms post-check (P9)", () => {
  it("the exact sentence once, and no other payment word, passes", () => {
    assert.deepEqual(violations(`Solo guitar, $700, 2 hours. ${full}\nAlex Guillen`, sentence(full)), []);
    assert.deepEqual(violations(`Line one.\n${twoWeeks.replace(" the balance", "\n the balance")}`, sentence(twoWeeks)), [], "whitespace collapsed");
  });

  it("missing, one word changed, or doubled is flagged in each draft", () => {
    for (const text of ["No terms here.", full.replace("Full", "Complete"), `${full} ${full}`]) {
      assert.deepEqual(violations(text, sentence(full)).map((v) => v.split(":")[0]), ["payment_terms_full", "payment_terms_compressed"], text);
    }
  });

  it("every must-flag phrase next to the sentence is flagged; every musician phrase is not", () => {
    for (const x of MUST_FLAG) assert.equal(violations(`${full} ${x}`, sentence(full)).length, 2, x);
    for (const x of MUST_NOT_FLAG) assert.deepEqual(violations(`${full} ${x}`, sentence(full)), [], x);
  });

  it("platform: any payment word is flagged, musician prose is not, and no sentence is required", () => {
    assert.deepEqual(violations("Looking forward to it.", { kind: "platform" }), []);
    for (const x of MUST_FLAG) assert.equal(violations(x, { kind: "platform" }).length, 2, x);
    for (const x of MUST_NOT_FLAG) assert.deepEqual(violations(x, { kind: "platform" }), [], x);
  });

  it("unknown platform is always flagged once for Alex, plus any payment word; none checks nothing", () => {
    const v = violations("Looking forward to it.", { kind: "unknown_platform" });
    assert.equal(v.length, 1);
    assert.ok(v[0].startsWith("payment_terms_platform_unknown"));
    assert.equal(violations("a deposit", { kind: "unknown_platform" }).length, 3);
    assert.deepEqual(violations("A 50% deposit and the balance is due.", { kind: "none" }), []);
  });
});

// --- Pipeline wiring (P10-P13) ---
const LEAD: Partial<Classification> = {
  mode: "evaluation", action: "quote", vagueness: "clear", competition_level: "medium", competition_quote_count: 3,
  stealth_premium: false, stealth_premium_signals: [], tier: "standard", rate_card_tier: "T2", lead_source_column: "D",
  price_point: "slight_premium", format_requested: "guitarist", format_recommended: "solo", duration_hours: 2,
  stated_budget: null, event_date_iso: "2026-10-25", timeline_band: "short", close_type: "soft_hold",
  cultural_context_active: false, cultural_tradition: null, planner_effort_active: false, social_proof_active: false,
  context_modifiers: [], event_energy: null, flagged_concerns: [], venue_name: null, client_first_name: "Sarah",
};
const gen = (terms: string) => ({
  reasoning: { details_present: ["date"], absences: [], emotional_core: "a good night", cinematic_opening: "A good night.",
    validation_line: "Good call." },
  full_draft: `Hi Sarah, a good night. Solo guitar, $650, 2 hours. ${terms}\nAlex Guillen`,
  compressed_draft: `Hi Sarah. Solo guitar, $650, 2 hours. ${terms}\nAlex Guillen`,
});
const gate = (status: "pass" | "fail") => ({
  scene_quote: "a good night", scene_type: "cinematic", competitor_test: false,
  gut_checks: Object.fromEntries(GUT_CHECK_KEYS.map((k) => [k, true])), gate_status: status,
  fail_reasons: status === "fail" ? ["stub fail"] : [], concern_traceability: [], best_line: "a good night", validation_line: "Good call.",
});
let systems: string[] = [];
function stub(responses: unknown[]) {
  let n = 0;
  systems = [];
  setClaudeRequesterForTests(async (request) => {
    systems.push(String((request as { system?: unknown }).system ?? ""));
    const text = JSON.stringify(responses[n++ % responses.length]);
    return { id: "m", type: "message" as const, role: "assistant" as const, content: [{ type: "text" as const, text, citations: null }],
      model: "stub", stop_reason: "end_turn" as const, stop_sequence: null,
      usage: { input_tokens: 1, output_tokens: 1, cache_creation_input_tokens: null, cache_read_input_tokens: null } };
  });
}
const generatePrompts = () => systems.filter((s) => s.includes("**Quote Terms"));
const paymentFails = (r: string[]) => r.filter((x) => x.startsWith("payment_terms_"));

describe("payment terms through the pipeline (P10-P13)", () => {
  after(() => setClaudeRequesterForTests());

  it("P10: one run, three generate attempts, the same full-payment line; the post-check uses the run's terms", async () => {
    stub([LEAD, gen(full), gate("fail"), gen(full), gate("fail"), gen(full), gate("fail")]);
    const ok = await runPipeline("lead", undefined, undefined, undefined, "2026-10-11");
    assert.equal(generatePrompts().length, 3);
    for (const s of generatePrompts()) assert.ok(s.includes(`"${full}"`), "every attempt carries the run's sentence");
    assert.deepEqual(paymentFails(ok.gate.fail_reasons), [], "drafts with the run's sentence are not flagged");
    stub([LEAD, gen(noDate), gate("fail"), gen(noDate), gate("fail"), gen(noDate), gate("fail")]);
    const bad = await runPipeline("lead", undefined, undefined, undefined, "2026-10-11");
    assert.deepEqual(paymentFails(bad.gate.fail_reasons).map((r) => r.split(":")[0]), ["payment_terms_full", "payment_terms_compressed"]);
  });

  it("P11: an edit re-computes from the edit's date (two weeks on 10-01, full payment on 10-12)", async () => {
    const c = LEAD as Classification;
    stub([gen(twoWeeks), gate("pass")]);
    await runEditPipeline({ ...c }, lookupPrice(c), "shorter", "2026-10-01");
    assert.ok(generatePrompts()[0].includes(`"${twoWeeks}"`));
    stub([gen(full), gate("pass")]);
    const e = await runEditPipeline({ ...c }, lookupPrice(c), "shorter", "2026-10-12");
    assert.ok(generatePrompts()[0].includes(`"${full}"`));
    assert.deepEqual(paymentFails(e.gate.fail_reasons), []);
  });

  it("P12: an edit after the event gets the no-date sentence AND the past-date flag", async () => {
    const c = { ...LEAD, past_date_detected: false } as Classification;
    stub([gen(noDate), gate("pass")]);
    await runEditPipeline(c, lookupPrice(c), "shorter", "2026-10-26");
    assert.ok(generatePrompts()[0].includes(`"${noDate}"`));
    assert.ok(generatePrompts()[0].includes("FLAGGED: EVENT DATE APPEARS TO BE IN THE PAST"));
  });

  it("P13: a hand-run lead the model marks P (no intake platform) claims nothing and is flagged for Alex", async () => {
    stub([{ ...LEAD, lead_source_column: "P" }, gen(""), gate("pass")]);
    const out = await runPipeline("lead", undefined, undefined, undefined, "2026-10-11");
    assert.ok(generatePrompts()[0].includes("- Payment: say nothing about payment"));
    assert.ok(out.gate.fail_reasons.some((r) => r.startsWith("payment_terms_platform_unknown")));
  });
});
