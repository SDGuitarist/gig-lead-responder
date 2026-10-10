# Codex CODE review, round 1: app-inserted NP2 price block

**Range:** `7a35753..f789b53` (code commits `9c78924` `45dea5a` `f4be3a1` `679062f` `57c58eb` `45f2ed6` `38d2555`
`a5ab8fc`). **Plan:** `docs/plans/2026-10-09-feat-app-inserted-price-and-in-kind-lines-plan.md`. **Execution
record:** `docs/reviews/2026-10-09-price-block-local-runs.md`. Prior Codex verdicts on this CODE: none (the plan
reviews, `...-plan-codex-round1.md` and `...-round2.md`, reviewed the plan, not code).
**Reader and trigger:** the compound phase (solution doc) and HANDOFF.

**Verdict: GO on BOTH runs, no findings. Code review CLOSED at round 1.** No fixes; no round 2.
Residual risk (both runs, accepted in the plan): the marker's false-hold rate on real nonprofit leads is measured
on 3 lead texts only (6 NP2 runs). Both Codex sandboxes could not run the full suite (`EPERM`, environment only);
the suite result is Claude Code's (728 pass / 0 fail / 1 skip at `f789b53`); both ran `tsc` clean. Run A's
`git diff --check` note (trailing spaces in the plan round-2 record) is cosmetic, fixed in the same commit as
this record.

## Run A (Claude Code, `codex exec -s read-only`, 2026-10-09; HEAD `f789b53`, clean after)

```
## Verdict: GO

No code-level findings. The branch matches the plan:

- Exact insertion order is correct: truncate → compute block → insert both drafts → sign-off.
- Rewrite and SMS-edit paths inherit insertion through `generateResponse`.
- Marker validation correctly rejects multiple, inline, malformed, numeric, `$`, `|`, and bracketed names; Unicode letters are supported.
- `hasPriceBlock` implements all six planned conditions and fails closed.
- Non-NP2 drafts bypass the block logic.
- Forbidden files are unchanged, including `price.ts`, `.env`, `public/`, and `data/leads.db`.
- Repricing cannot produce an NP2 block because only mariachi formats are changed there.
- The feed-forward risk was measured on 3/3 NP2-priced sample runs after the wording fix; real-lead false-hold rate remains explicitly unmeasured.

Verification:

- Expected HEAD and clean worktree: confirmed.
- `npx tsc --noEmit`: passed.
- Provenance and stale-symbol checks: passed.
- Supplied Round 0 evidence: 728 tests passed, offline harness passed.
- My sandbox test attempt was limited by `EPERM` on test-created temporary directories; this is an environment limitation, not a branch failure.
- `git diff --check` reports only trailing whitespace in the imported round-2 review record.
```
(Codex's optional next-step prompt omitted.)

## Run B (Alex, inside Codex, 2026-10-09)

```
Verdict: GO. No valid findings.

The diff matches the plan:

- Correct insertion order in `src/pipeline/generate.ts`: truncate → insert block → add sign-off.
- Rewrite and SMS edit paths inherit `generateResponse`.
- Marker validation uses the required Unicode regex and rejects invalid/multiple/inline markers.
- `hasPriceBlock` implements all six fail-closed checks.
- Non-NP2 drafts remain unchanged.
- Forbidden files and `.env` are untouched.
- Focused price-block tests: pass.
- TypeScript: pass.
- Supplied full-suite evidence: 728 pass, 0 fail, 1 skip.
- My local full-suite attempt hit sandbox-only `listen EPERM`/`sysctl` restrictions; no feature failure was indicated.

No Claude fix prompt is needed. Residual risk remains the documented one: marker false-hold rate on real nonprofit
leads is measured only on three lead texts.
```
(Codex's next-step verification prompt omitted.)
