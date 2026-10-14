import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assessArms, compareArms, type ArmData, type ArmManifest } from "./arm-manifest.js";

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

// Codex code review round 1 (docs/reviews/2026-10-13-clarification-shape-code-codex-round1.md): the comparison is void
// unless each arm is exactly five result files and 50 runs, every file has a manifest, and a model call was recorded.
const data = (arm: "A" | "B", over: Partial<ArmData> = {}): ArmData => ({
  files: Array.from({ length: 5 }, (_, i) => `clarification-${arm}${i + 1}.json`),
  manifests: five(arm), runs: 50, ...over,
});

describe("Arm Manifest: assessArms (the planned shape of the measurement)", () => {
  it("Arm Manifest S1 five files and 50 runs per arm compare ok; differing file names (tags) are ignored", () => {
    assert.deepEqual(assessArms(data("A"), data("B"), expect), { ok: true });
    assert.deepEqual(assessArms(data("A", { files: ["a.json", "b.json", "c.json", "d.json", "e.json"] }), data("B"), expect), { ok: true });
  });

  it("Arm Manifest S2 an incomplete or surplus arm is void and names files or runs", () => {
    const four = data("B", { files: data("B").files.slice(0, 4), manifests: five("B").slice(0, 4), runs: 40 });
    const r4 = assessArms(data("A"), four, expect);
    assert.equal(r4.ok, false);
    assert.equal((r4 as { field: string }).field, "files");
    const six = data("A", { files: [...data("A").files, "x.json"], manifests: [...five("A"), manifest("A")], runs: 60 });
    assert.equal((assessArms(six, data("B"), expect) as { field: string }).field, "files");
    assert.equal((assessArms(data("A"), data("B", { runs: 49 }), expect) as { field: string }).field, "runs");
    assert.equal((assessArms(data("A", { runs: 51 }), data("B"), expect) as { field: string }).field, "runs");
  });

  it("Arm Manifest S3 a result file without a manifest is void and does not throw", () => {
    const withHole = data("A", { manifests: [...five("A").slice(0, 4), undefined] });
    const r = assessArms(withHole, data("B"), expect);
    assert.equal(r.ok, false);
    assert.equal((r as { field: string }).field, "manifest");
  });

  it("Arm Manifest S4 an arm that recorded no model call is void", () => {
    const r = assessArms(data("A"), data("B", { manifests: five("B", { models: [] }) }), expect);
    assert.equal(r.ok, false);
    assert.equal((r as { field: string }).field, "models");
    // Both arms empty: the cross-arm model comparison sees equal values, so only the guard itself can refuse it.
    const both = assessArms(data("A", { manifests: five("A", { models: [] }) }), data("B", { manifests: five("B", { models: [] }) }), expect);
    assert.equal(both.ok, false);
    assert.match((both as { detail: string }).detail, /no model call/);
  });
});

describe("Arm Manifest: the report script gates its statistics on the check", () => {
  const script = "scripts/clarification-arm-report.ts";
  const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" }).trim();
  const parent = execFileSync("git", ["rev-parse", "HEAD~1"], { encoding: "utf-8" }).trim();
  // Explicit hashes, passed as --pre-hash / --current-hash: the test must not depend on the prompt's current state.
  const pre = "a".repeat(64);
  const post = "b".repeat(64);
  const result = (lead: string) => ({ lead, ok: true, verified: false, words: 100, sentences: 5,
    gate_detail: { scene_type: "cinematic", competitor_test: false, empty_traceability: 0 } });
  const leads = ["v1", "v2", "v3", "v4", "v5", "v6", "h1", "h2", "h3", "h4"];
  const makeArm = (arm: "A" | "B", files: number, over: Partial<ArmManifest> = {}) => {
    const dir = mkdtempSync(join(tmpdir(), `arm-report-${arm}-`));
    mkdirSync(dir, { recursive: true });
    for (let i = 1; i <= files; i++) {
      const m: ArmManifest = { arm, gitSha: arm === "A" ? parent : head, dirtyPromptFiles: [], promptSha256: arm === "A" ? pre : post,
        models: ["claude-sonnet-4-6"], today: "2026-10-12", leadSetSha256: "leads", node: process.version, ...over };
      writeFileSync(join(dir, `clarification-${arm}${i}.json`), JSON.stringify({ today: m.today, runs: 1, manifest: m, results: leads.map(result) }));
    }
    return dir;
  };
  const run = (a: string, b: string) => spawnSync("npx", ["tsx", script, a, b, "--pre-hash", pre, "--current-hash", post], { encoding: "utf-8" });

  it("Arm Manifest R1 a valid pair prints the comparison and every manifest (positive control)", () => {
    const r = run(makeArm("A", 5), makeArm("B", 5));
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /MANIFEST CHECK: \{"ok":true\}/);
    assert.match(r.stdout, /Fisher/);
    assert.equal((r.stdout.match(/"gitSha"/g) ?? []).length, 10, "all ten manifests are printed");
  });

  it("Arm Manifest R2 a failed manifest check or an incomplete arm prints no comparative statistic and exits non-zero", () => {
    for (const [label, a, b] of [
      ["different model", makeArm("A", 5), makeArm("B", 5, { models: ["other"] })],
      ["four files", makeArm("A", 5), makeArm("B", 4)],
    ] as const) {
      const r = run(a, b);
      assert.notEqual(r.status, 0, label);
      assert.match(r.stdout, /COMPARISON VOID/, label);
      assert.doesNotMatch(r.stdout, /Fisher/, label);
    }
  });
});
