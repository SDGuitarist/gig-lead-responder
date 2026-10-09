# Codex round 1 — NP2 nonprofit price + in-kind line (`8008311`..`1cc4402`)

**Verdict: PENDING** (run A: Claude Code; run B: Alex). Stricter verdict wins when the runs disagree.
Pre-registered stops: a 2nd NO-GO stops automatic iteration; round 3 only with `Round 3 authorized by Alejandro: YES`.

## Run A (Claude Code, 2026-10-09): NO-GO (1 P1, 2 P2)

**Claude Code check:** all three REAL (reproduced against the code).
- P1 clarification crash: `nonprofitPriceNote` reads `rateTableFor(pricing)` for `format: "unresolved"`
  (clarification pricing skips the rate table; every other caller is guarded upstream). Fixed: clarification first.
- P2 no-viable-scope note says "two prices": wrong reason text. Fixed: names the budget draft instead.
- P2 an extra, contradicting in-kind/standard figure passes: `hasInKindLine` only proved the right line exists.
  Fixed: every in-kind or standard-rate statement must be the expected line.

Verbatim (final message):

```
NO-GO

P1

- `src/pipeline/price.ts:457` — A nonprofit clarification lead crashes instead of remaining held.
  - Input: `nonprofit_buyer: true`, `action: "one_question"`, `format_recommended: "unresolved"`.
  - `runPipeline` creates clarification pricing with `format: "unresolved"`, then `nonprofitPriceNote()` calls `rateTableFor(pricing)[...]`; `RATE_TABLES["unresolved"]` is undefined.
  - Reproduced: `TypeError: Cannot read properties of undefined (reading '2')`.
  - Impact: a forbidden clarification lead can terminate the pipeline.

P2

- `src/pipeline/price.ts:451-452` — The no-viable-scope NP2 hold note falsely says “two prices in the draft.”
  - Input: NP2 solo 2h, standard `$795`, NP2 `$695`, budget `$400`.
  - The generator emits only the minimum-set redirect, not two prices; the in-kind line is correctly omitted.
  - Impact: Alex receives an inaccurate review reason.

- `src/pipeline/post-check.ts:222` — An extra incorrect in-kind line is accepted if a correct line also appears.
  - Input: a correct `$795` in-kind sentence plus another sentence stating `$800`.
  - `hasInKindLine()` only checks that the expected line exists; the extra client-facing number is above the quote and escapes `belowFloorPrices()`.
  - Impact: a one-price draft can contain contradictory contribution amounts.

Checked clean: NP2 eligibility exclusions, standard-vs-NP2 threshold, travel totals, budget scoped alternatives, T4/residency/duo handling, hard-gate path, hold-note stripping, router hold behavior, both drafting paths, and NP2 rate-table consumers. Targeted tests: 147 pass, 0 fail; `npx tsc --noEmit` passes. The requested fetch was blocked by sandbox permission, but local branch, HEAD, origin ref, and status matched exactly. No server, poller, database, or sends were used.

Claude Code fix handoff:

```text
Work in /Users/alejandroguillen/Projects/gig-lead-responder
Branch: feat/hub-phase0
Ask: fix the three NP2 Round 1 findings above, under the fix contract in ~/.claude/docs/mandatory-review-workflow.md. Do not broaden scope.

FIRST gate:
  pwd
  git branch --show-current
  git rev-parse feat/hub-phase0
  git status --short
Expected HEAD: 67fc89a362b18352f53ffd5fba3f028e9265238a
Stop and ask Alex if the repo, branch, HEAD, or worktree differs.

Read:
  HANDOFF.md
  CLAUDE.md
  AGENTS.md
  docs/plans/2026-10-02-feat-hub-phase0-lead-replies-plan.md
  docs/reviews/2026-10-09-np2-codex-round1.md
  ~/.claude/docs/mandatory-review-workflow.md

For each finding:
1. Reproduce it.
2. Name the root cause.
3. Add a regression test that fails before the fix.
4. Apply the smallest fix.
5. Run focused tests, the full suite, and tsc.
6. Check the fix for the same failure class before committing.

Use one concern per commit. Do not start the server or Mac poller, open data/leads.db, send network messages, or change prices. Report remaining risks and update HANDOFF.md before stopping.
```
```

## Run B (Alex)

_not yet run_
