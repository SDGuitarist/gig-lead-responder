---
date: 2026-10-13
phase: code review, round 1
subject: feat/hub-phase0, diff 2e8e4db..6bafe0c (the narrowed internal-term alternatives, their tests, the replay)
prior_verdicts: none for this code (plan: ...-internal-terms-plan-codex-round1.md, ...round2.md)
verdict: GO (no findings, P0-P3)
---

# Round 1 (code): GO, no findings

One run. Pasted by Alex 2026-10-13; verdict verbatim.

No findings (P0-P3).

Review completed against Revision 1b:

- Pattern matches the plan exactly: two compound alternatives plus unchanged `investment` in
  `src/pipeline/generate.ts:36`.
- Ordinary `anchor`/`floor` prose passes; pricing compounds and plurals reject.
- Tests are non-vacuous, including per-token V13 cases and V4a/V4b amendments.
- Replay contract, old regex, deduplication, classification, limits, and exit-2 paths are sound.
- `export` is used only by the replay script; V7 error shape remains intact.
- Scope is exactly the four expected files. Worktree remains clean.
- `npx tsc --noEmit` passed.

The targeted clarification tests produced 32 passes and 0 failures, but the wrapper exited nonzero because unrelated
tests attempted localhost binds blocked by this sandbox. Replay execution was similarly blocked by `tsx` IPC
permissions; this is an environment limitation, not a code finding.

GO.

## Claude Code's check (2026-10-13)

| Point | Check | Result |
|---|---|---|
| Replay and wrapper blocked in the review sandbox | They ran here: `Clarification V` 32 pass, `Clarification Replay` 2 pass, full suite 997 pass / 0 fail / 1 skip, replay output recorded in `2026-10-13-clarification-internal-terms-replay.md`. | Environment limit of the review sandbox, as in earlier rounds. |
