# Codex round 2 — T4 fix (`e373a5e`)

**Run A (Claude Code, 2026-10-09, at `5729ec7`; tree clean after): NO-GO** (1 P1: wedding-adjacent T4 with event_arc corporate gets no hold). Codex confirms the sourced-format item is correctly out of scope and the nonprofit fail-open is Alex's accepted option (a). **Second NO-GO: automatic iteration STOPPED; round 3 only with `Round 3 authorized by Alejandro: YES`.** Run B (Alex) appended if he pastes it.

## Run A, verbatim

## Verdict: NO-GO

### P1 — Wedding-adjacent T4 can still auto-send

`src/pipeline/classify-verify.ts:174-175`

A classification with `rate_card_tier: "T4"`, `engagement_type: "wedding_adjacent"`, and `event_arc: "corporate"` receives no T4 hold. `routeLead` can therefore return `auto-send`.

Root cause: the fix checks only `event_arc`; `wedding_adjacent` is a separate classifier field.

Required fix: deterministically hold T4 when `engagement_type === "wedding_adjacent"` (residency is already held by the existing residency guard), with a regression test through `routeLead`.

The sourced-format finding is correctly out of scope: it is pre-existing and requires a new classifier capability. The nonprofit fail-open behavior is correctly dispositioned as Alex’s accepted option (a), not a defect in this fix.

Checked clean:

- T4 tests: 9 passed
- `runPipeline` tests: 20 passed
- `npx tsc --noEmit`: passed
- Worktree clean
- No files edited; no server, poller, database, network, or browser used

