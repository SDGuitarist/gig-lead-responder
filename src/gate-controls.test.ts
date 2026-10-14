import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { evaluateControls, type ControlResult } from "./gate-controls.js";

// Codex code review R1 P1-2: the controls decision and its exit status.
const g = (id: string, ...verifies: Array<boolean | null>): ControlResult => ({ id, kind: "generic", verifies });
const s = (id: string, ...verifies: Array<boolean | null>): ControlResult => ({ id, kind: "specific", verifies });
const clean = [g("g1", false, false), g("g2", false, false), s("s1", true, true), s("s2", true, true)];

describe("Gate Controls GC1: the exit status", () => {
  it("Gate Controls GC1 clean controls exit 0", () => {
    const r = evaluateControls(clean);
    assert.equal(r.exitCode, 0);
    assert.equal(r.STOP_loose, false); assert.equal(r.STOP_too_tight, false); assert.deepEqual(r.verify_errors, []);
  });

  it("Gate Controls GC1 a generic text passing in EITHER verify stops (exit 1)", () => {
    for (const verifies of [[true, false], [false, true], [true, true]] as const) {
      const r = evaluateControls([g("g1", ...verifies), ...clean.slice(1)]);
      assert.equal(r.STOP_loose, true); assert.equal(r.exitCode, 1); assert.deepEqual(r.generic_passed_in_either_verify, ["g1"]);
    }
  });

  it("Gate Controls GC1 two specific texts failing in at least one verify stops; one does not (the asymmetry)", () => {
    const one = evaluateControls([...clean.slice(0, 2), s("s1", true, false), s("s2", true, true)]);
    assert.equal(one.STOP_too_tight, false); assert.equal(one.exitCode, 0);
    const two = evaluateControls([...clean.slice(0, 2), s("s1", true, false), s("s2", false, true)]);
    assert.equal(two.STOP_too_tight, true); assert.equal(two.exitCode, 1);
  });

  it("Gate Controls GC1 a verifier error is not a clean control (all-null does NOT exit 0)", () => {
    const allNull = evaluateControls([g("g1", null, null), g("g2", null, null), s("s1", null, null), s("s2", null, null)]);
    assert.equal(allNull.STOP_loose, false); assert.equal(allNull.STOP_too_tight, false);
    assert.deepEqual(allNull.verify_errors, ["g1", "g2", "s1", "s2"]);
    assert.equal(allNull.exitCode, 1);
    assert.equal(evaluateControls([...clean.slice(0, 3), s("s2", true, null)]).exitCode, 1);
    assert.equal(evaluateControls([g("g1")]).exitCode, 1, "no verdict at all");
  });
});
