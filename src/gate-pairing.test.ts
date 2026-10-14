import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { signTestUpper, summarizePairs, verdictOf, type PairedRun, type Verdict } from "./gate-pairing.js";
import { GUT_CHECK_KEYS, type GateResult } from "./types.js";

// Plan docs/plans/2026-10-14-fix-vague-quote-gate-opening-plan.md (Revision 1b): the paired summary and the sign test.
const v = (pass: boolean): Verdict => ({ pass, gate_status: pass ? "pass" : "fail", lead_specific_opening: pass, scene_type: "cinematic",
  competitor_test: false, false_checks: [], fail_reasons: [] });
const run = (lead: string, pipeline: boolean, mode: boolean, def: boolean, extra: Partial<PairedRun["paired"] & object> = {}): PairedRun => ({
  lead, paired: { pipeline: v(pipeline), replay_mode: v(mode), replay_default: v(def), ...extra }, gate_detail: { opening: `opening of ${lead}` } });

describe("Gate Pairing GP1: the sign test", () => {
  it("Gate Pairing GP1 matches the exact binomial tail", () => {
    assert.equal(signTestUpper(0, 0), 1);
    assert.ok(Math.abs(signTestUpper(6, 7) - 8 / 128) < 1e-12);   // b=6, c=1: 0.0625
    assert.ok(Math.abs(signTestUpper(10, 10) - 1 / 1024) < 1e-12);
    assert.ok(signTestUpper(3, 6) > 0.5);                            // a tie-ish split is not significant
  });
});

describe("Gate Pairing GP2: the paired summary", () => {
  it("Gate Pairing GP2 counts newly verified, newly failed, both and neither, and lists the newly verified openings", () => {
    const s = summarizePairs([run("a", false, true, false), run("b", false, true, false), run("c", true, false, true), run("d", true, true, true), run("e", false, false, false)]);
    assert.equal(s.pairs, 5);
    assert.equal(s.newly_verified, 2); assert.equal(s.newly_failed, 1); assert.equal(s.both_pass, 1); assert.equal(s.both_fail, 1);
    assert.deepEqual(s.newly_verified_openings.map((o) => o.lead), ["a", "b"]);
    assert.equal(s.mode_pass, 3); assert.equal(s.default_pass, 2);
  });

  it("Gate Pairing GP2 a replay error excludes the run from the pairs and is counted", () => {
    const s = summarizePairs([run("a", false, true, false), run("b", false, true, false, { replay_error: "VerificationError" }), { lead: "c" }]);
    assert.equal(s.pairs, 1); assert.equal(s.excluded, 1); assert.equal(s.runs, 3);
  });

  it("Gate Pairing GP2 the noise floor counts runs where two same-rule replays of the same draft disagree (the pipeline verdict is NOT used)", () => {
    const rep = (pass: boolean) => ({ replay_mode_repeat: v(pass) });
    const s = summarizePairs([run("a", true, false, false, rep(true)), run("b", true, true, true, rep(true)), run("c", false, true, false, rep(false)), run("d", true, true, true)]);
    assert.deepEqual(s.noise_floor, { compared: 3, replay_mode_vs_repeat_disagree: 2 });
    // control: a pipeline-vs-replay disagreement alone adds nothing
    assert.equal(summarizePairs([run("x", false, true, true, rep(true))]).noise_floor.replay_mode_vs_repeat_disagree, 0);
  });
});

describe("Gate Pairing GP3: verdictOf", () => {
  it("Gate Pairing GP3 pass is gate_status, and competitor_test is not listed as a false check", () => {
    const checks = Object.fromEntries(GUT_CHECK_KEYS.map((k) => [k, true]));
    checks.competitor_test = false; checks.lead_specific_opening = false;
    const g = { gate_status: "fail", gut_checks: checks, scene_type: "cinematic", competitor_test: false, fail_reasons: ["x"] } as unknown as GateResult;
    const out = verdictOf(g);
    assert.equal(out.pass, false);
    assert.deepEqual(out.false_checks, ["lead_specific_opening"]);
    assert.equal(out.lead_specific_opening, false);
    assert.equal(verdictOf({ ...g, gate_status: "pass" } as GateResult).pass, true);
  });
});
