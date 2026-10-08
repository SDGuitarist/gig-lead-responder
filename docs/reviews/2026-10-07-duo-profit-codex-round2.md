# Codex round 2 — duo minimum profit fix `1d64197`

**Verdict: NO-GO** (1 P2; Codex CLI `codex exec -s workspace-write`, run by Claude Code on 2026-10-07 at `1d64197`; tree clean after). Round 1 P2/P3 not re-flagged. **Second NO-GO: automatic iteration STOPPED; round 3 only with `Round 3 authorized by Alejandro: YES`.**

**Claude Code check of the finding (2026-10-07): unreachable by construction.** `findScopedAlternative` (`src/pipeline/price.ts`) returns only `allDurations[currentIdx - 1]`, the next SHORTER duration; a 2-3h primary can have only a 1-2h alternative, never 4h. A 4h+ T1 primary is still held by the `h >= 4` branch, reached whenever the 2-3h checks return null. The finding constructs a PricingResult the pricing code cannot produce.

Verbatim:

---

## Verdict: NO-GO

P2 — `src/pipeline/price.ts:390-393`

A duo with a passing 2–3h primary check and a client-visible 4h scoped alternative returns no hold. The alternative check ignores 4h, and the existing T1 4h+ hold only examines the primary duration.

Concrete case: primary `3h / $1275 / T1`, alternative `4h / $700` returns `null`.

Root cause: the new alternative path applies only the 2–3h check and does not preserve the T1 4h+ hold for a 4h alternative.

Required fix: ensure a T1 duo/flamenco-duo scoped alternative at 4h+ reaches the same hold, while preserving the 1h exemption and existing 2–3h behavior. Add a regression test.

Checked clean

- Focused tests: 123 passed, 0 failed
- `npx tsc --noEmit`: passed
- No files edited
- No server, poller, database, network, or browser used

