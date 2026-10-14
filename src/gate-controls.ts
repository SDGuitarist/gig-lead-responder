// The planted-opening controls' decision (plan docs/plans/2026-10-14-fix-vague-quote-gate-opening-plan.md, "Decision
// table"), as a pure function so the script's exit status is tested (Codex code review R1 P1-2).
// Asymmetric by cost: ANY generic text passing lead_specific_opening in EITHER verify is a control defect (the harm is a
// false pass); 2 or more specific texts failing it in AT LEAST ONE verify means the rule is too tight. A null verdict
// (a verifier error) is not a clean control: it fails the run.
export interface ControlResult { id: string; kind: "generic" | "specific"; verifies: Array<boolean | null> }

export function evaluateControls(results: ControlResult[]) {
  const genericPassed = results.filter((r) => r.kind === "generic" && r.verifies.some((v) => v === true)).map((r) => r.id);
  const specificFailed = results.filter((r) => r.kind === "specific" && r.verifies.some((v) => v === false)).map((r) => r.id);
  const errors = results.filter((r) => r.verifies.length === 0 || r.verifies.some((v) => v === null)).map((r) => r.id);
  const stopLoose = genericPassed.length >= 1;
  const stopTooTight = specificFailed.length >= 2;
  return {
    generic_passed_in_either_verify: genericPassed,
    specific_failed_in_at_least_one_verify: specificFailed,
    verify_errors: errors,
    STOP_loose: stopLoose,
    STOP_too_tight: stopTooTight,
    exitCode: stopLoose || stopTooTight || errors.length > 0 ? 1 : 0,
  };
}
