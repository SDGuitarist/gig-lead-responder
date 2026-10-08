# Codex round 1 — duo minimum profit at $600 (`f73ed37..75ee682`)

**Verdict: NO-GO** (1 P2, 1 P3; Codex CLI `codex exec -s workspace-write`, run by Claude Code on 2026-10-07 at `75ee682`; tree clean after). Pre-registered stops: 2nd NO-GO stops automatic iteration; round 3 only with `Round 3 authorized by Alejandro: YES`. Verbatim:

---

## Verdict: NO-GO

P2 — `src/pipeline/price.ts:377-386`

Duo/flamenco-duo budget-gap scoped alternatives are not checked. A client-visible shorter alternative can be below the $150 profit floor while `minimumProfitHold()` returns `null`; only sourced formats validate `scoped_alternative`.

Root cause: the new duo branch bypasses the shared alternative check.

Required fix: validate duo scoped alternatives using the same `$600 + stipend - travel` rule, while preserving the explicit 1h exemption. Add a regression test for an under-floor duo alternative.

P3 — `src/port-manifest-min-profit.test.ts`

No regression test proves a non-integer duo request such as 2.5h is snapped to 3h before the profit check.

Required fix: add a pipeline-level test showing 2.5h prices as 3h and receives the 3h duo check.

Checked clean:

- Focused tests: 121 passed, 0 failed
- `npx tsc --noEmit`: passed
- No files edited
- Worktree clean
- Travel fee/stipend semantics, T1 fallback, current rate cells, and revert-sensitive tests inspected

