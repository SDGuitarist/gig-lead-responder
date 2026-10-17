// Todo 097 plan: R1-R4 (router reason text, fixtures F-A to F-G) and H1-H4 (holdReasonText).
// Sentinels stand in for a client's words, address and token. The reasons are stored on the lead and logged,
// so none of them may carry client text; the hold DECISION must not change.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { routeLead } from "./automation/router.js";
import { holdReasonText } from "./utils/hold-reason.js";
import type { PipelineOutput } from "./types.js";
import type { ParsedLead } from "./automation/types.js";

const SENTINELS = ["ZZSENTINEL", "412 Palm", "abc123", "ZZRECOMMENDED", "9 Elm", "xyz"];
const FIXED = "Cross-family format correction (the client asked for a different kind of act than the one recommended)";
const REQ = "mariachi ZZSENTINEL 412 Palm St token=abc123";

const leaks = (reasons: string[] | undefined): boolean => SENTINELS.some((s) => (reasons ?? []).join("; ").includes(s));

function out(o: Record<string, unknown> = {}, top: Record<string, unknown> = {}): PipelineOutput {
  return {
    classification: {
      format_requested: "solo", format_recommended: "solo", flagged_concerns: [], vagueness: "clear", action: "quote", stealth_premium: false,
      venue_name: "ZZSENTINEL venue", client_first_name: "ZZSENTINEL", organization_name: "ZZSENTINEL org", ...o,
    },
    pricing: { quote_price: 900 }, verified: true, ...top,
  } as unknown as PipelineOutput;
}
function lead(o: Record<string, unknown> = {}): ParsedLead {
  return { platform: "gigsalad", parseConfidence: "high", enriched: true, portalUrl: "https://portal.test/ZZSENTINEL", clientName: "ZZSENTINEL", rawText: "ZZSENTINEL 412 Palm St token=abc123", ...o } as unknown as ParsedLead;
}

const fixtures: Array<{ name: string; lead: ParsedLead; out: PipelineOutput; expected: string[] | null }> = [
  { name: "F-A cross-family only (family word present)", lead: lead(), out: out({ format_requested: REQ, format_recommended: "solo" }), expected: [FIXED] },
  { name: "F-B many branches at once",
    lead: lead({ platform: "yelp", parseConfidence: "low", enriched: false }),
    out: out({ format_requested: REQ, format_recommended: "solo", flagged_concerns: ["ZZSENTINEL concern"], vagueness: "vague", action: "one_question" }, { pricing: { quote_price: 5000 }, verified: false }),
    expected: ["Low parse confidence — manual review required", "Yelp lead not enriched from portal — truncated message", "Yelp portal reply not verified live (todo 094): Alex sends from Yelp", "Verification gate failed after retries", "Quote $5000 exceeds threshold $3000", "1 flagged concern(s)", FIXED, "Vague lead — needs clarifying question"] },
  { name: "F-C missing portal URL", lead: lead({ portalUrl: undefined }), out: out(), expected: ["Missing portal URL — cannot submit reply"] },
  { name: "F-D high-value assumption", lead: lead(), out: out({ action: "assume_and_quote", stealth_premium: true }), expected: ["High-value assumption (stealth premium + assumed quote)"] },
  { name: "F-E unconstrained format_recommended string", lead: lead(), out: out({ format_requested: REQ, format_recommended: "ZZRECOMMENDED 9 Elm token=xyz" }), expected: [FIXED] },
  { name: "F-F same family (solo to duo): overshoot control, must not hold", lead: lead(), out: out({ format_requested: "solo", format_recommended: "duo" }), expected: null },
  { name: "F-G clean lead: must not hold", lead: lead(), out: out(), expected: null },
];

describe("hold reason text from the router (todo 097)", () => {
  for (const f of fixtures) {
    it(`R2/R3 ${f.name}: exact ordered reasons, no client text`, () => {
      const r = routeLead(f.lead, f.out, 3000);
      if (f.expected === null) {
        assert.equal(r.action, "auto-send");
        return;
      }
      assert.equal(r.action, "hold");
      assert.deepEqual((r as { reasons: string[] }).reasons, f.expected);
      assert.equal(leaks((r as { reasons: string[] }).reasons), false);
    });
  }

  it("R1 the hold DECISION is unchanged: the cross-family fixtures still hold and the same-family one does not", () => {
    for (const f of fixtures) {
      const expectHold = f.expected !== null;
      assert.equal(routeLead(f.lead, f.out, 3000).action === "hold", expectHold, f.name);
    }
  });

  it("R3 control: the sentinel check CAN fail, because it flags the old wording that put the client's words in the reason", () => {
    const oldWording = [`Cross-family format correction: ${REQ} → solo`];
    assert.equal(leaks(oldWording), true);
    assert.equal(leaks(["Cross-family format correction: x → ZZRECOMMENDED 9 Elm token=xyz"]), true);
  });

  it("R4 positive control: a multi-reason hold still carries its fixed texts (a 'returns nothing' bug cannot pass R3)", () => {
    const r = routeLead(fixtures[1].lead, fixtures[1].out, 3000) as { reasons: string[] };
    assert.ok(r.reasons.includes("Yelp portal reply not verified live (todo 094): Alex sends from Yelp"));
    assert.ok(r.reasons.includes("Quote $5000 exceeds threshold $3000"));
  });
});

describe("holdReasonText (todo 097)", () => {
  it("H1 a short list equals the join with '; '", () => {
    assert.equal(holdReasonText(["a", "b"]), "a; b");
    assert.equal(holdReasonText(["only"]), "only");
  });
  it("H2 exactly 500 characters is unchanged", () => {
    const s = "x".repeat(500);
    assert.equal(holdReasonText([s]), s);
  });
  it("H3 501 or more returns exactly 500: the first 499 characters then '…'", () => {
    const s = "abcdefghij".repeat(60); // 600
    const r = holdReasonText([s]) as string;
    assert.equal(r.length, 500);
    assert.equal(r.slice(0, 499), s.slice(0, 499));
    assert.equal(r[499], "…");
    assert.equal((holdReasonText(["y".repeat(501)]) as string).length, 500);
  });
  it("H4 an empty list returns null", () => {
    assert.equal(holdReasonText([]), null);
  });
});
