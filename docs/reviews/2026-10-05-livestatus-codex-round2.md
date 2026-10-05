# Codex round 2 — live GigSalad login status fixes (`9419f47..f95f13c`)

**Verdict: NO-GO** (1 P1: equal or backwards timestamps; R1 P1s confirmed closed for normal clocks). Codex CLI `codex exec -s workspace-write`, run by Claude Code on 2026-10-05 at `f95f13c`; tree clean after. Prior: R1 NO-GO (`2026-10-05-livestatus-codex-round1.md`). **Second NO-GO in this loop: automatic iteration STOPPED.** Verbatim:

---

## Verdict: NO-GO

### P1 — Equal or backwards timestamps can still leave `/health` stale

**File:** `src/automation/portals/gigsalad-login-state.ts:14,42`; callers at `gigsalad-login-check.ts:23` and `gigsalad-match.ts:126`

**Concrete failures:**

- Two reads start in the same millisecond. A newer lead read reports `signed_out`, then the older startup read reports `ok`. Because the check is only `<`, equal timestamps allow the stale `ok` to overwrite the failure.
- `/health` is `ok` at timestamp `200`; the next read starts after the wall clock moves backward and records `100`, then reports `signed_out`. The result is discarded, so `/health` incorrectly remains `ok`.

**Root cause:** Ordering relies solely on `Date.now()` and has no sequence/tie-breaker or monotonic clock.

**Required fix:** Assign a monotonic per-read sequence at read start and order results by that sequence, using timestamps only for diagnostics. Add regression tests for equal timestamps and backwards-clock ordering.

### Questions checked

1. **R1 P1s:** Closed for normal distinct, forward-moving timestamps. Not fully closed because equal and backwards timestamps remain unsafe.
2. **Matching/loud lines:** Clean. Successful lead matching is unchanged; thrown reads now correctly become `error` while the other account is read. Startup expiration/error lines remain substantive and pass.
3. **Assertions:** Clean. New assertions are not vacuous; they verify state, callback reports, returned status, race behavior, and a control. Coverage is missing only for the timestamp edge cases above.

Focused GigSalad tests passed. Full-suite failures were sandbox restrictions (`listen EPERM`/`sysctl`), not this change. Worktree remains clean.
