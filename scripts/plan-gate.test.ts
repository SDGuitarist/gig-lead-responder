import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { checkPlanGate } from "./plan-gate.js";

const TMP_DIR = join(process.cwd(), ".tmp-plan-gate-test");

function setup() {
  mkdirSync(TMP_DIR, { recursive: true });
}

function teardown() {
  rmSync(TMP_DIR, { recursive: true, force: true });
}

function writePlan(name: string, content: string): string {
  const path = join(TMP_DIR, name);
  writeFileSync(path, content, "utf-8");
  return path;
}

// Helper: build a valid contract block
function contractBlock(overrides: Record<string, unknown> = {}): string {
  const contract = {
    auto_work_candidate: true,
    human_signoff_required: true,
    risk_level: "medium",
    allowed_paths: ["src/plan-gate.ts"],
    forbidden_paths: ["src/pipeline"],
    source_of_truth: ["package.json"],
    required_checks: ["npm test"],
    stop_conditions: ["Stop if scope changes."],
    linked_expectations: [],
    ...overrides,
  };
  return (
    "## Automation Contract\n\n```json\n" +
    JSON.stringify(contract, null, 2) +
    "\n```\n"
  );
}

describe("checkPlanGate", () => {
  before(() => setup());
  after(() => teardown());

  it("valid contract with auto_work_candidate: true → eligible", () => {
    const path = writePlan(
      "eligible.md",
      "# Plan\n\n" + contractBlock({ auto_work_candidate: true })
    );
    const result = checkPlanGate(path);
    assert.equal(result.status, "eligible");
    assert.ok(result.contract !== null);
    assert.equal(result.contract!.auto_work_candidate, true);
  });

  it("valid contract with auto_work_candidate: false → manual_only", () => {
    const path = writePlan(
      "manual.md",
      "# Plan\n\n" + contractBlock({ auto_work_candidate: false })
    );
    const result = checkPlanGate(path);
    assert.equal(result.status, "manual_only");
    assert.ok(result.reasons[0].includes("auto_work_candidate is false"));
  });

  it("missing ## Automation Contract section → manual_only", () => {
    const path = writePlan(
      "legacy.md",
      "# Plan\n\nJust a regular plan with no contract.\n"
    );
    const result = checkPlanGate(path);
    assert.equal(result.status, "manual_only");
    assert.ok(result.reasons[0].includes("No ## Automation Contract"));
    assert.equal(result.contract, null);
  });

  it("malformed JSON → invalid", () => {
    const path = writePlan(
      "bad-json.md",
      "# Plan\n\n## Automation Contract\n\n```json\n{ broken json }\n```\n"
    );
    const result = checkPlanGate(path);
    assert.equal(result.status, "invalid");
    assert.ok(result.reasons[0].includes("Malformed JSON"));
  });

  it("missing required key → invalid", () => {
    const path = writePlan(
      "missing-key.md",
      "# Plan\n\n## Automation Contract\n\n```json\n" +
        JSON.stringify({ auto_work_candidate: true }) +
        "\n```\n"
    );
    const result = checkPlanGate(path);
    assert.equal(result.status, "invalid");
    assert.ok(result.reasons.some((r) => r.includes("Missing required field")));
  });

  it("overlap between allowed and forbidden paths → invalid", () => {
    const path = writePlan(
      "overlap.md",
      "# Plan\n\n" +
        contractBlock({
          allowed_paths: ["src/pipeline/foo.ts"],
          forbidden_paths: ["src/pipeline"],
        })
    );
    const result = checkPlanGate(path);
    assert.equal(result.status, "invalid");
    assert.ok(result.reasons.some((r) => r.includes("Path overlap")));
  });

  it("missing source-of-truth file → invalid", () => {
    const path = writePlan(
      "missing-sot.md",
      "# Plan\n\n" +
        contractBlock({
          source_of_truth: ["nonexistent-file-abc123.md"],
        })
    );
    const result = checkPlanGate(path);
    assert.equal(result.status, "invalid");
    assert.ok(result.reasons.some((r) => r.includes("not found")));
  });

  it("invalid risk_level → invalid", () => {
    const path = writePlan(
      "bad-risk.md",
      "# Plan\n\n" + contractBlock({ risk_level: "extreme" })
    );
    const result = checkPlanGate(path);
    assert.equal(result.status, "invalid");
    assert.ok(result.reasons.some((r) => r.includes("risk_level")));
  });

  it("non-file path → invalid", () => {
    const result = checkPlanGate("nonexistent-plan-file.md");
    assert.equal(result.status, "invalid");
    assert.ok(result.reasons[0].includes("Cannot read plan file"));
  });

  // --- linked_expectations enforcement ---

  it("linked pair — all files in allowed_paths → eligible", () => {
    const path = writePlan(
      "linked-ok.md",
      "# Plan\n\n" +
        contractBlock({
          allowed_paths: ["src/plan-gate.ts", "src/plan-gate.test.ts"],
          linked_expectations: [
            {
              files: ["src/plan-gate.ts", "src/plan-gate.test.ts"],
              reason: "source and test must stay in sync",
            },
          ],
        })
    );
    const result = checkPlanGate(path);
    assert.equal(result.status, "eligible");
  });

  it("linked pair violated — one file missing → invalid", () => {
    const path = writePlan(
      "linked-violated.md",
      "# Plan\n\n" +
        contractBlock({
          linked_expectations: [
            {
              files: ["src/plan-gate.ts", "src/prompts/verify.ts"],
              reason: "gut check sync",
            },
          ],
        })
    );
    const result = checkPlanGate(path);
    assert.equal(result.status, "invalid");
    assert.ok(result.reasons.some((r) => r.includes("Linked pair violated")));
    assert.ok(result.reasons.some((r) => r.includes("src/prompts/verify.ts")));
  });

  it("linked pair — neither file in allowed_paths → eligible", () => {
    const path = writePlan(
      "linked-passthrough.md",
      "# Plan\n\n" +
        contractBlock({
          linked_expectations: [
            { files: ["foo.ts", "bar.ts"], reason: "unrelated pair" },
          ],
        })
    );
    const result = checkPlanGate(path);
    assert.equal(result.status, "eligible");
  });

  it("malformed linked entry — missing reason → invalid", () => {
    const path = writePlan(
      "linked-no-reason.md",
      "# Plan\n\n" +
        contractBlock({
          linked_expectations: [{ files: ["a.ts", "b.ts"] }],
        })
    );
    const result = checkPlanGate(path);
    assert.equal(result.status, "invalid");
    assert.ok(result.reasons.some((r) => r.includes("reason")));
  });

  it("malformed linked entry — files has 1 item → invalid", () => {
    const path = writePlan(
      "linked-one-file.md",
      "# Plan\n\n" +
        contractBlock({
          linked_expectations: [{ files: ["a.ts"], reason: "solo" }],
        })
    );
    const result = checkPlanGate(path);
    assert.equal(result.status, "invalid");
    assert.ok(result.reasons.some((r) => r.includes("at least 2")));
  });

  it("old-format string entry → invalid", () => {
    const path = writePlan(
      "linked-old-format.md",
      "# Plan\n\n" +
        contractBlock({
          linked_expectations: ["src/foo.ts", "src/bar.ts"],
        })
    );
    const result = checkPlanGate(path);
    assert.equal(result.status, "invalid");
    assert.ok(result.reasons.some((r) => r.includes("must be an object")));
  });

  it("real plan: phase-1 plan → manual_only", () => {
    const result = checkPlanGate(
      "docs/plans/2026-03-08-feat-workflow-automation-phase-1-plan.md"
    );
    assert.equal(result.status, "manual_only");
  });

  it("real plan: legacy test-failure plan → manual_only", () => {
    const result = checkPlanGate(
      "docs/plans/2026-03-07-test-failure-fixes.md"
    );
    assert.equal(result.status, "manual_only");
  });

});
