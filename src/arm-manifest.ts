/**
 * The arm manifest of the two-arm clarification measurement (plan
 * docs/plans/2026-10-13-fix-clarification-draft-shape-plan.md, "The measurement"). Each runner process writes one into
 * its result file; `compareArms` is the mechanical check that arm A used the pre-change prompt, arm B the changed
 * one, and that nothing else varied. The process TAG is not a manifest field: it lives in the result file name.
 */
export interface ArmManifest {
  arm: "A" | "B";
  gitSha: string;
  /** `git status --porcelain` lines under src/prompts and src/pipeline at run time; must be empty. */
  dirtyPromptFiles: string[];
  /** SHA-256 of the clarification-mode generate prompt for the fixed probe (src/generate-prompt-cases.ts). */
  promptSha256: string;
  /** The distinct `request.model` values the run's calls carried. */
  models: string[];
  today: string;
  leadSetSha256: string;
  node: string;
}

export interface ArmExpectations {
  /** The pre-change clarification prompt hash (src/fixtures/generate-prompt-hashes.json, C0). */
  preChangePromptSha256: string;
  /** The hash the CURRENT tree's clarification prompt produces. */
  currentPromptSha256: string;
  /** Is the first commit an ancestor of the second (injected so the check stays pure). */
  isAncestor: (older: string, newer: string) => boolean;
}

export type ArmComparison = { ok: true } | { ok: false; field: string; detail: string };

const FIELDS: Array<keyof ArmManifest> = ["gitSha", "dirtyPromptFiles", "promptSha256", "models", "today", "leadSetSha256", "node"];
const same = (x: unknown, y: unknown) => JSON.stringify(x) === JSON.stringify(y);
const bad = (field: string, detail: string): ArmComparison => ({ ok: false, field, detail });

export function compareArms(a: ArmManifest[], b: ArmManifest[], expect: ArmExpectations): ArmComparison {
  if (a.length === 0 || b.length === 0) return bad("manifests", "an arm has no manifest");
  if ([...a, ...b].some((m) => typeof m !== "object" || m === null)) return bad("manifest", "a result file has no manifest object");
  for (const [label, arm] of [["A", a], ["B", b]] as const) {
    if (arm.some((m) => m.arm !== label)) return bad("arm", `a manifest in arm ${label} carries another arm name`);
    for (const f of FIELDS) {
      if (arm.some((m) => !same(m[f], arm[0][f]))) return bad(f, `arm ${label} manifests differ in ${f}`);
    }
    if (arm[0].dirtyPromptFiles.length > 0) return bad("dirtyPromptFiles", `arm ${label} ran with a dirty prompt tree`);
    if (arm[0].models.length === 0) return bad("models", `arm ${label} recorded no model call`);
  }
  if (a[0].promptSha256 !== expect.preChangePromptSha256) return bad("promptSha256", "arm A did not use the pre-change prompt");
  if (b[0].promptSha256 === expect.preChangePromptSha256) return bad("promptSha256", "arm B used the pre-change prompt");
  if (b[0].promptSha256 !== expect.currentPromptSha256) return bad("promptSha256", "arm B's prompt is not the current tree's prompt");
  if (!expect.isAncestor(a[0].gitSha, b[0].gitSha)) return bad("gitSha", "arm A's commit is not an ancestor of arm B's");
  for (const f of ["models", "today", "leadSetSha256", "node"] as const) {
    if (!same(a[0][f], b[0][f])) return bad(f, `${f} differs between the arms`);
  }
  return { ok: true };
}

/** One arm as the report reads it from a directory of result files. */
export interface ArmData {
  files: string[];
  /** One entry per file; `undefined` when the file has no manifest object (an earlier-format file). */
  manifests: Array<ArmManifest | undefined>;
  /** The total number of run results across the files. */
  runs: number;
}

/** The planned shape of one arm: five processes (files) and 50 runs (ten leads x five processes). */
export const ARM_SHAPE = { files: 5, runs: 50 } as const;

/**
 * The gate the report puts in front of every comparative statistic: each arm is exactly the planned shape and the
 * manifests agree (compareArms). Anything else is VOID, so a missing process cannot silently change the estimand.
 */
export function assessArms(a: ArmData, b: ArmData, expect: ArmExpectations, shape: { files: number; runs: number } = ARM_SHAPE): ArmComparison {
  for (const [label, arm] of [["A", a], ["B", b]] as const) {
    if (arm.files.length !== shape.files || arm.manifests.length !== shape.files) {
      return bad("files", `arm ${label} has ${arm.files.length} result files, expected ${shape.files}`);
    }
    if (arm.runs !== shape.runs) return bad("runs", `arm ${label} has ${arm.runs} runs, expected ${shape.runs}`);
  }
  return compareArms(a.manifests as ArmManifest[], b.manifests as ArmManifest[], expect);
}
