import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { compareArms, type ArmManifest } from "./arm-manifest.js";

// Plan docs/plans/2026-10-13-fix-clarification-draft-shape-plan.md, M1-M3. Names start "Arm Manifest M<n>".
const PRE = "pre".padEnd(64, "0");
const POST = "post".padEnd(64, "0");
const manifest = (arm: "A" | "B", over: Partial<ArmManifest> = {}): ArmManifest => ({
  arm, gitSha: arm === "A" ? "aaaa" : "bbbb", dirtyPromptFiles: [], promptSha256: arm === "A" ? PRE : POST,
  models: ["claude-sonnet-4-6"], today: "2026-10-12", leadSetSha256: "leads", node: "v22", ...over,
});
const five = (arm: "A" | "B", over: Partial<ArmManifest> = {}) => Array.from({ length: 5 }, () => manifest(arm, over));
const expect = { preChangePromptSha256: PRE, currentPromptSha256: POST, isAncestor: (o: string, n: string) => o === "aaaa" && n === "bbbb" };

describe("Arm Manifest: compareArms", () => {
  it("Arm Manifest M1 five identical manifests per arm, the right prompts and an ancestor commit are ok", () => {
    assert.deepEqual(compareArms(five("A"), five("B"), expect), { ok: true });
  });

  it("Arm Manifest M2 any one differing field, a wrong prompt or a dirty tree is refused and names the field", () => {
    const one = (arm: "A" | "B", i: number, over: Partial<ArmManifest>) => five(arm).map((m, k) => (k === i ? { ...m, ...over } : m));
    const cases: Array<[string, ReturnType<typeof compareArms>]> = [
      ["gitSha", compareArms(one("A", 2, { gitSha: "cccc" }), five("B"), expect)],
      ["promptSha256", compareArms(five("A"), one("B", 4, { promptSha256: "x" }), expect)],
      ["models", compareArms(five("A"), five("B", { models: ["other"] }), expect)],
      ["today", compareArms(five("A"), five("B", { today: "2026-10-13" }), expect)],
      ["leadSetSha256", compareArms(five("A"), five("B", { leadSetSha256: "other" }), expect)],
      ["dirtyPromptFiles", compareArms(five("A", { dirtyPromptFiles: [" M src/prompts/generate.ts"] }), five("B"), expect)],
    ];
    for (const [field, r] of cases) {
      assert.equal(r.ok, false, field);
      assert.equal((r as { field: string }).field, field);
    }
    // A used the changed prompt; B used the old one; A's commit is not older than B's.
    assert.equal(compareArms(five("A", { promptSha256: POST }), five("B"), expect).ok, false);
    assert.equal(compareArms(five("A"), five("B", { promptSha256: PRE }), expect).ok, false);
    assert.equal(compareArms(five("A"), five("B"), { ...expect, isAncestor: () => false }).ok, false);
    // The change did nothing: the current tree's prompt IS the pre-change prompt, so B equals the current one.
    const noop = compareArms(five("A"), five("B", { promptSha256: PRE }), { ...expect, currentPromptSha256: PRE });
    assert.equal(noop.ok, false);
    assert.match((noop as { detail: string }).detail, /pre-change prompt/);
    assert.equal(compareArms(five("A"), [], expect).ok, false);
  });

  it("Arm Manifest M3 the process tag is not a manifest field: only the result file name differs, still ok", () => {
    const withTags = five("A").map((m, k) => ({ ...m, ...({ tag: `A${k}` } as object) }));
    assert.deepEqual(compareArms(withTags as ArmManifest[], five("B"), expect), { ok: true });
  });
});
