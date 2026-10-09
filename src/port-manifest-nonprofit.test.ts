import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildClassifyPrompt } from "./prompts/classify.js";
import { classifyLead } from "./pipeline/classify.js";
import { setClaudeRequesterForTests } from "./claude.js";
import { verifyClassificationHeuristics } from "./pipeline/classify-verify.js";
import { withoutHoldNotes, type Classification } from "./types.js";

// Port manifest R403 (NP track, step 1). Alex decided Sept 15, 2026: nonprofit and fundraiser leads are
// routed on WHO PAYS, never premium on the venue alone (the lost Sept 2026 donor-dinner precedent was
// quoted T4 at a luxury venue). The always-loaded docs and the classify prompt still treated
// "fundraiser" and "donor" as premium signals. Alex 2026-10-09: fix that first, and hold every
// nonprofit lead until the NP rates are set.
test("port manifest R403: the classify prompt asks who pays and never makes a nonprofit premium on venue alone", () => {
  const p = buildClassifyPrompt("2026-10-09");
  assert.ok(p.includes("## BUYER (WHO PAYS)"));
  assert.match(p, /"nonprofit_buyer": boolean/);
  assert.match(p, /never premium on the venue alone/i);
  assert.doesNotMatch(p, /private event or donor/i, "donor events are not an auto-premium pattern");
});

test("port manifest R403: the always-loaded docs no longer list a fundraiser as a premium signal", () => {
  for (const f of ["docs/QUICK_REFERENCE.md", "docs/PROTOCOL.md"]) {
    const premiumRows = readFileSync(f, "utf-8").split("\n").filter((l) => /^\| Event type \|.*Corporate 100\+/.test(l)); // premium-signal rows only
    assert.ok(premiumRows.length > 0, `control: ${f} has an Event type premium row`);
    for (const row of premiumRows) {
      assert.doesNotMatch(row, /fundraiser at cultural venue|\(Corporate 100\+, fundraiser,/i, `${f}: fundraiser listed as a signal: ${row}`);
      assert.match(row, /never premium on the venue alone/i, `${f}: the who-pays rule is stated: ${row}`);
    }
  }
});

// Alex's catch 2026-10-09: his one real NP booking came through an event PLANNER at a five-star venue,
// which also fits the coming T4 rule (planner + five-star). Route on who pays: the nonprofit pays, so a
// planner or events company booking for a nonprofit is nonprofit_buyer (NP beats T4).
test("port manifest R403: a planner booking for a nonprofit is a nonprofit buyer (NP beats T4)", () => {
  assert.match(buildClassifyPrompt("2026-10-09"), /planner or events company booking for a nonprofit[^.]*nonprofit_buyer is true/i);
});

// Step 2: the parsed field. Only a real boolean true counts (a string "true", 1 or a missing field is
// false), the same rule as price_asked and extended_dancer. Through the real classifyLead.
const valid = {
  mode: "evaluation", action: "quote", vagueness: "clear", competition_level: "low", competition_quote_count: 0,
  stealth_premium: false, stealth_premium_signals: [], tier: "standard", rate_card_tier: "T2", lead_source_column: "D",
  price_point: "full_premium", format_requested: "guitarist", format_recommended: "solo", duration_hours: 2,
  stated_budget: null, event_date_iso: null, timeline_band: "comfortable", close_type: "soft_hold", event_energy: null,
  cultural_context_active: false, cultural_tradition: null, planner_effort_active: false, social_proof_active: false,
  context_modifiers: [], flagged_concerns: [], venue_name: null, client_first_name: null,
};
async function classifyAs(out: Record<string, unknown>) {
  setClaudeRequesterForTests((async () => ({ id: "m", type: "message", role: "assistant", model: "t", stop_reason: "end_turn",
    stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 },
    content: [{ type: "text", text: JSON.stringify(out) }] })) as never);
  try { return await classifyLead("lead text", "2026-10-09"); } finally { setClaudeRequesterForTests(); }
}
test("port manifest R403: nonprofit_buyer parses only a real true", async () => {
  assert.equal((await classifyAs({ ...valid, nonprofit_buyer: true })).nonprofit_buyer, true);
  for (const v of ["true", 1, null, undefined, false]) {
    assert.equal((await classifyAs({ ...valid, nonprofit_buyer: v })).nonprofit_buyer, false, String(v));
  }
});

// Step 3 (Alex 2026-10-09, #1): every nonprofit lead is held for Alex until the NP rates are set. If the
// model misses it but the lead says nonprofit/foundation/fundraiser/charity/501(c)/donor, a backup
// check holds it anyway. The note never reaches the drafting prompts.
const cl = (nonprofit_buyer: boolean) =>
  ({ ...valid, nonprofit_buyer, flagged_concerns: [] }) as unknown as Classification;
const notes = (text: string, np: boolean) => verifyClassificationHeuristics(text, cl(np)).warnings;
test("port manifest R403: a nonprofit buyer is held for Alex, and the note stays out of the drafts", () => {
  const w = notes("Cocktail hour for our members", true);
  assert.deepEqual(w.filter((x) => x.startsWith("nonprofit:")),
    ["nonprofit: NP track (decided by who pays, not the venue); Alex reviews every nonprofit lead before it is sent"]);
  const held = verifyClassificationHeuristics("Cocktail hour", cl(true)).classification;
  assert.ok(!withoutHoldNotes(held).flagged_concerns.some((f) => f.startsWith("nonprofit:")));
});

test("port manifest R403: a lead that says nonprofit but was not classified as one is held by the backup check", () => {
  for (const text of ["Annual gala for the Example Foundation", "Our nonprofit's spring fundraiser", "A donor dinner, 80 guests",
    "Charity auction at the club", "We are a 501(c)(3) arts group", "non-profit board reception"]) {
    assert.ok(notes(text, false).some((x) => x === "classification_verify: raw lead mentions a nonprofit or fundraiser but nonprofit_buyer is false"), text);
  }
  assert.ok(!notes("Corporate holiday party, 120 guests", false).some((x) => /nonprofit/.test(x)), "control: corporate lead");
  assert.ok(!notes("Annual gala for the Example Foundation", true).some((x) => x.startsWith("classification_verify: raw lead mentions a nonprofit")),
    "classified correctly: only the nonprofit note");
});

// Codex round 1 (NP routing) P1: a nonprofit at a Tier A venue was still told T3 (classify T3 rule,
// premium tier, Tier A line, PROTOCOL Premium Tier) and the Tier A verifier DEMANDED T3. A nonprofit
// buyer now beats venue premium everywhere; corporate leads at Tier A venues are still checked.
test("port manifest R403: a nonprofit buyer overrides venue premium in the prompt, PROTOCOL and the Tier A check", () => {
  const p = buildClassifyPrompt("2026-10-09");
  assert.match(p, /ANY stealth premium signal = T3 \(except a nonprofit buyer/);
  assert.match(p, /Tier A venues \(auto-premium, whatever else the lead says, except a nonprofit buyer\)/);
  assert.match(p, /- \*\*premium\*\*:[^\n]*\(never a nonprofit buyer on the venue alone\)/);
  const protocol = readFileSync("docs/PROTOCOL.md", "utf-8");
  const premium = protocol.slice(protocol.indexOf("### Premium Tier (ANY ONE triggers)"), protocol.indexOf("### Premium Tier (ANY ONE triggers)") + 600);
  assert.match(premium, /nonprofit or fundraiser buyer is never premium on the venue alone/);
  const tierA = (np: boolean, text = "Annual gala at Hotel del Coronado") => verifyClassificationHeuristics(text,
    { ...cl(np), rate_card_tier: "T2", stealth_premium: false } as Classification).warnings.filter((w) => w.includes("Tier A venue"));
  assert.deepEqual(tierA(true), [], "nonprofit buyer at a Tier A venue: not forced to T3");
  assert.deepEqual(tierA(false, "Foundation dinner at Hotel del Coronado"), [], "text says nonprofit: not forced to T3");
  assert.equal(tierA(false, "Corporate dinner at Hotel del Coronado").length, 1, "control: corporate at Tier A is still checked");
});

// Codex round 1 (NP routing) P1 + P2: the backup check missed gala / benefit / auction / school PTA, and
// held harmless uses of "foundation" (a venue's Foundation Room, a band called The Foundation, a
// foundation stone). "Foundation" now counts only as an organization ("the Example Foundation", "our
// foundation", "foundation gala/dinner/board/donors/fundraiser").
const backup = (text: string) => notes(text, false).some((x) => x.startsWith("classification_verify: raw lead mentions a nonprofit"));
test("port manifest R403: the backup check holds gala, benefit, auction and school PTA leads", () => {
  for (const text of ["Spring gala, 200 guests", "Benefit dinner for the shelter", "Our event is benefiting the children's hospital",
    "Silent auction night at the club", "School PTA family night", "PTO movie night for the school", "Booster club dinner",
    "Annual dinner for the Example Foundation", "Our foundation's board reception", "A foundation gala in May"]) {
    assert.ok(backup(text), text);
  }
});
test("port manifest R403: the backup check does not hold harmless uses of foundation", () => {
  for (const text of ["Dinner at the Foundation Room", "We love The Foundation, the band", "Foundation stone ceremony for our new office",
    "Makeup and foundation are handled by our stylist", "Corporate dinner, 80 guests"]) {
    assert.ok(!backup(text), text);
  }
});

// Codex round 2 (NP routing, both runs) P2: bare "PTO" held paid-time-off leads ("our PTO policy").
// PTO now counts only with school context in the lead; PTA and "parent-teacher" are never ambiguous.
test("port manifest R403: PTO is a nonprofit signal only with school context", () => {
  for (const text of ["PTO movie night for the school", "School PTO family night", "Elementary PTO fundraiser dinner",
    "Parent Teacher Organization spring dinner", "parent-teacher association night", "School PTA family night"]) {
    assert.ok(backup(text), text);
  }
  for (const text of ["PTO accrued for the team", "Our PTO policy covers the holiday party", "Team offsite, half the staff on PTO"]) {
    assert.ok(!backup(text), text);
  }
});

// NP routing round 3 (hard cap; Alex chose option a): the keyword backup is a MINIMUM safety net behind
// the classifier's nonprofit_buyer, not a complete detector. Named nonprofits a lead may mention without
// any keyword are caught by name (proper nouns, matched case-sensitively).
test("port manifest R403: named nonprofits are caught by name; ordinary words are not", () => {
  for (const text of ["YMCA family night", "YWCA luncheon", "Rotary Club installation dinner", "Kiwanis breakfast",
    "Lions Club awards night", "Boys & Girls Club celebration", "Boys and Girls Club open house", "Junior League holiday party"]) {
    assert.ok(backup(text), text);
  }
  for (const text of ["A rotary phone prop for the set", "The lions at the zoo after-hours party", "A junior league soccer team party"]) {
    assert.ok(!backup(text), text);
  }
});
