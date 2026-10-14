import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compareRegression, ERROR_VALUE } from "./regression-compare.js";

// Plan docs/plans/2026-10-14-feat-lead-words-field-plan.md (Revision 1c), LW13: the regression stop rule.
const row = (over: Record<string, unknown> = {}) => ({ action: "quote", vagueness: "clear", competition_level: "medium", format_recommended: "solo",
  duration_hours: 2, rate_card_tier: "T2", stealth_premium: false, quote_price: 700, ...over });
const file = (rows: Array<Record<string, unknown>>, lead = "L1") => ({ results: { [lead]: rows } });
const five = (over: Array<Record<string, unknown>>) => over.map((o) => row(o));

describe("Lead Words LW13: the classifier regression gate", () => {
  const base = file(five([{}, {}, {}, {}, {}]));

  it("Lead Words LW13 identical files do not stop", () => {
    assert.equal(compareRegression(base, base).stop, false);
  });

  it("Lead Words LW13 a changed mode stops", () => {
    const r = compareRegression(base, file(five([{ action: "one_question" }, { action: "one_question" }, { action: "one_question" }, {}, {}])));
    assert.equal(r.stop, true);
    assert.ok(r.reasons.some((x) => x.startsWith("L1.action: mode quote -> one_question")), r.reasons.join(";"));
  });

  it("Lead Words LW13 a rise of 2 runs off the mode stops; a rise of 1 does not", () => {
    assert.equal(compareRegression(base, file(five([{ vagueness: "vague" }, {}, {}, {}, {}]))).stop, false);
    const r = compareRegression(base, file(five([{ vagueness: "vague" }, { vagueness: "vague" }, {}, {}, {}])));
    assert.equal(r.stop, true);
    assert.ok(r.reasons.some((x) => x.includes("runs off the mode 0 -> 2")));
  });

  it("Lead Words LW13 a 2/2/1 tie is deterministic: the smallest value is the mode, the same tie does not stop, a flip does", () => {
    const tie = file(five([{ format_recommended: "duo" }, { format_recommended: "duo" }, { format_recommended: "solo" }, { format_recommended: "solo" }, { format_recommended: "trio" }]));
    assert.equal(compareRegression(tie, tie).stop, false, "the same tie on both sides");
    // before 2/2/1 (mode "duo", the smallest of the tied), after 1/3/1 solo-heavy: the mode flips to solo
    const flip = file(five([{ format_recommended: "duo" }, { format_recommended: "solo" }, { format_recommended: "solo" }, { format_recommended: "solo" }, { format_recommended: "trio" }]));
    const r = compareRegression(tie, flip);
    assert.equal(r.stop, true);
    assert.ok(r.reasons.some((x) => x.includes("format_recommended: mode duo -> solo")), r.reasons.join(";"));
  });

  it("Lead Words LW13 the tie-break is the smallest value, not the first seen (the mutant without it must die)", () => {
    // before: solo, solo, duo, duo, trio: a 2/2/1 tie whose FIRST value is "solo" but whose smallest is "duo"
    const before = file(five([{ format_recommended: "solo" }, { format_recommended: "solo" }, { format_recommended: "duo" }, { format_recommended: "duo" }, { format_recommended: "trio" }]));
    const after = file(five([{ format_recommended: "duo" }, { format_recommended: "duo" }, { format_recommended: "duo" }, { format_recommended: "solo" }, { format_recommended: "trio" }]));
    const r = compareRegression(before, after);
    assert.equal(r.reasons.filter((x) => x.includes("format_recommended: mode")).length, 0, `the mode is duo on both sides: ${r.reasons.join(";")}`);
  });

  it("Lead Words LW13 the script exits 0 for no stop, 1 for a stop and 2 for a malformed file (real process)", () => {
    const dir = mkdtempSync(join(tmpdir(), "regcmp-"));
    const w = (name: string, body: unknown) => { const p = join(dir, name); writeFileSync(p, typeof body === "string" ? body : JSON.stringify(body)); return p; };
    const run = (b: string, a: string) => spawnSync("npx", ["tsx", "scripts/classifier-regression.ts", "--compare", b, a], { encoding: "utf-8" }).status;
    const same = w("same.json", base);
    const changed = w("changed.json", file(five([{ action: "one_question" }, { action: "one_question" }, { action: "one_question" }, {}, {}])));
    assert.equal(run(same, same), 0);
    assert.equal(run(same, changed), 1);
    assert.equal(run(same, w("bad.json", "{not json")), 2);
  });

  it("Lead Words LW13 an error row or a missing row counts as __error__ and stops when new", () => {
    const withError = file([row(), row(), row(), row(), { action: "ERROR", error: "x" }]);
    const r = compareRegression(base, withError);
    assert.equal(r.stop, true);
    assert.ok(r.reasons.some((x) => x.includes("error rows 0 -> 1")));
    const missing = file(five([{}, {}, {}, {}]));
    assert.equal(compareRegression(base, missing).stop, true, "a missing row is an error row");
    assert.equal(compareRegression(withError, withError).stop, false, "the same error on both sides is not new");
    assert.ok(ERROR_VALUE === "__error__");
  });

  it("Lead Words LW13 a lead missing from the after file stops; a malformed file throws (the script exits 2, not 0)", () => {
    assert.equal(compareRegression(base, { results: {} }).stop, true);
    for (const bad of [null, {}, { results: "x" }, { results: { L1: "no" } }, "text", []]) {
      assert.throws(() => compareRegression(base, bad), /not a classifier-regression file/, JSON.stringify(bad));
      assert.throws(() => compareRegression(bad, base), /not a classifier-regression file/, JSON.stringify(bad));
    }
  });
});
