// Paired gate comparison for the vague-quote verify-gate plan (docs/plans/2026-10-14-fix-vague-quote-gate-opening-plan.md,
// "The paired measurement"): the same final draft verified under the new opening rule and under today's strict one.
// Pure functions over recorded verdicts; the runner (scripts/clarification-measure.ts --paired) records them.
import type { GateResult } from "./types.js";

export interface Verdict {
  pass: boolean; // gate.gate_status === "pass": the gate's own rule, the value the rewrite loop tests
  gate_status: string;
  lead_specific_opening: boolean | null;
  scene_type: string;
  competitor_test: boolean;
  false_checks: string[]; // competitor_test excluded (it passes when false)
  fail_reasons: string[];
}

export function verdictOf(g: GateResult): Verdict {
  const checks = g.gut_checks as unknown as Record<string, boolean>;
  return {
    pass: g.gate_status === "pass",
    gate_status: g.gate_status,
    lead_specific_opening: typeof checks.lead_specific_opening === "boolean" ? checks.lead_specific_opening : null,
    scene_type: g.scene_type,
    competitor_test: g.competitor_test,
    false_checks: Object.entries(checks).filter(([k, v]) => v === false && k !== "competitor_test").map(([k]) => k),
    fail_reasons: g.fail_reasons,
  };
}

export interface PairedRecord { pipeline: Verdict; replay_mode?: Verdict; replay_default?: Verdict; replay_error?: string }
export interface PairedRun { lead: string; paired?: PairedRecord; gate_detail?: { opening?: string } }

/** P(X >= k) for X ~ Binomial(n, 0.5): the exact one-sided sign test on the discordant pairs. */
export function signTestUpper(k: number, n: number): number {
  if (n === 0) return 1;
  let c = 1; // C(n, 0)
  const probs: number[] = [];
  for (let i = 0; i <= n; i++) { probs.push(c / 2 ** n); c = (c * (n - i)) / (i + 1); }
  return probs.slice(k).reduce((a, b) => a + b, 0);
}

export function summarizePairs(runs: PairedRun[]) {
  const withPairs = runs.filter((r) => r.paired);
  const usable = withPairs.filter((r) => r.paired!.replay_mode && r.paired!.replay_default && !r.paired!.replay_error);
  let b = 0, c = 0, bothPass = 0, bothFail = 0;
  const newlyVerified: Array<{ lead: string; opening: string }> = [];
  for (const r of usable) {
    const m = r.paired!.replay_mode!.pass, d = r.paired!.replay_default!.pass;
    if (m && !d) { b++; newlyVerified.push({ lead: r.lead, opening: r.gate_detail?.opening ?? "" }); }
    else if (!m && d) c++;
    else if (m && d) bothPass++;
    else bothFail++;
  }
  // The verifier's noise floor: the pipeline's own call and the replay under the SAME rule on the SAME draft.
  const noise = usable.filter((r) => r.paired!.pipeline.pass !== r.paired!.replay_mode!.pass).length;
  return {
    runs: runs.length,
    pairs: usable.length,
    excluded: withPairs.length - usable.length,
    mode_pass: usable.filter((r) => r.paired!.replay_mode!.pass).length,
    default_pass: usable.filter((r) => r.paired!.replay_default!.pass).length,
    newly_verified: b, newly_failed: c, both_pass: bothPass, both_fail: bothFail,
    sign_test_p_one_sided: signTestUpper(b, b + c),
    noise_floor: { compared: usable.length, pipeline_vs_replay_mode_disagree: noise },
    newly_verified_openings: newlyVerified,
  };
}
