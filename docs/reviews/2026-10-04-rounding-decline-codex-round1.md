# Codex round 1 — round-up pricing, R320 graceful decline, hold-note filter (`97eec2b..58352b1`)

**Verdict: NO-GO** (Codex CLI, `codex exec -s read-only`, run by Claude Code at Alex's request on 2026-10-04; reviewed
at `d88b237`, a HANDOFF-only commit after `58352b1`). A first run stopped to ask whether `d88b237` was the right tip;
the rerun was told it is the docs-only case the prompt allows. Verbatim output below.

---

NO-GO — one P1 finding.

Finding:

- P1: The “always fail” verification backstop is case- and whitespace-sensitive at [src/pipeline/verify.ts:42](/Users/alejandroguillen/Projects/gig-lead-responder/src/pipeline/verify.ts:42). A model reason such as `graceful decline failed: ...` returned `gate_status: "pass"` in my reproduction, so the gate incorrectly passes. The graceful-decline hold note mitigates auto-send for R320, but the same class affects the existing sourced-integrity backstop and can permit a bad sourced draft through.

  Root cause: model-controlled `fail_reasons` are interpreted with exact `startsWith()` sentinels instead of normalized or structured failure codes.

  Bounded class inventory: two sentinel checks in `src/pipeline/verify.ts` — `Sourced integrity failed` and `Graceful decline failed`. Fix both together. Add positive tests for exact, lowercase, and leading-whitespace variants, plus an overshoot control proving unrelated reasons do not force failure.

Review conclusions:

- R320 matches plan §0.5: runtime functions, trigger condition, marker, and presence/absence tests are present.
- Round-up behavior is correct, including budget alternatives, flamenco dancer pricing, outside-SD 3-hour minimums, and client-requested-hours wording.
- `withoutHoldNotes` removes only the current internal `classification_verify:` and `graceful_decline:` diagnostics. The warning inventory contains only routing/classification diagnostics, so no draft-required concern was found.
- `graceful_decline` is normalized once to a real boolean; downstream code uses the trusted boolean.
- No frozen poller/lease/wake files changed.
- Feed-Forward runtime risks remain unexecuted and are outside this range.
- Focused isolated tests: 19 passed. `tsc` and `git diff --check` passed. The full harness is blocked in this sandbox by temp-directory `EPERM`; the supplied Mac evidence remains 504 passed / 0 failed.
- Exception note: stage validators raise typed errors, but `callClaude()` converts validation failures to a generic `Error` after retry. This is pre-existing contract drift, not introduced by this range.

Claude Code fix prompt:

```text
Work in /Users/alejandroguillen/Projects/gig-lead-responder. Branch: feat/hub-phase0. Ask: fix the single Codex P1 finding from the round-up/R320 review.

FIRST -- confirm no other session or auto-continue is live here. Run:
  pwd
  git branch --show-current
  git rev-parse feat/hub-phase0
  git status --short

Expected starting HEAD: d88b237 or a later DOCS-ONLY commit.
If HEAD differs or the worktree is dirty unexpectedly, STOP and ask Alejandro.

Round 0: YES -- Codex reproduced the failure with a deterministic verifier stub; focused isolated tests passed 19/19. The Mac full-suite evidence is 504 pass / 0 fail / 4 skip.

Read first:
  HANDOFF.md
  CLAUDE.md
  AGENTS.md
  docs/plans/2026-10-02-feat-hub-phase0-lead-replies-plan.md
  ~/.claude/docs/mandatory-review-workflow.md

Finding to fix:
- src/pipeline/verify.ts compares model-controlled fail_reasons using exact, case-sensitive startsWith() strings.
- Reproduction: a graceful-decline reason such as "graceful decline failed: price before format honesty" returned gate_status "pass".
- The same failure class exists for "Sourced integrity failed".

Required fix contract:
1. Reproduce the observed failure and report it.
2. Name the root cause: unnormalized model-controlled sentinel text is used as a gate backstop.
3. Apply the smallest safe fix to the bounded surface: both sentinel checks in src/pipeline/verify.ts.
4. Add regression tests that fail before the fix and pass after it:
   - exact graceful-decline reason still forces fail;
   - lowercase and leading-whitespace graceful-decline reasons force fail;
   - equivalent sourced-integrity variants force fail;
   - positive overshoot control: unrelated fail reasons do not force fail when gate_status is pass.
5. Because this is the second confirmed instance of the same sentinel/backstop class, inventory the bounded surface explicitly: two checks in src/pipeline/verify.ts. Give a provisional shape assessment and choose the smallest structural or reversible fix; do not redesign the verifier.
6. Run and report:
   - focused verifier tests;
   - npm test on the Mac;
   - npx tsc --noEmit;
   - git diff --check.
7. Execute any high-risk “safe because” claim that is practical. Otherwise label it UNEXECUTED with reason, owner, and trigger.
8. Report remaining risks, including the still-unexecuted real-model behavior for graceful_decline classification and decline ordering.
9. Do not run another broad review. This is the named-fix verification for round 2 only. After a second NO-GO, automatic iteration stops; round 3 requires the literal authorization:
   Round 3 authorized by Alejandro: YES
10. Do not add a second review of your own changes.

Keep the change limited to this finding. Do not edit the frozen poller/lease/wake files or unrelated pricing/R320 behavior.
```

No files were modified during this review.