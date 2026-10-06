# Codex round 2 — holiday hold-note fix `62fb503`

**Verdict: NO-GO** (1 P2, test coverage only; Codex CLI `codex exec -s workspace-write`, run by Claude Code on 2026-10-05 at `62fb503`; tree clean after). Round 1 P2 CONFIRMED CLOSED (holiday note filtered on generate/verify/edit/rewrite; follow-up does not inject flagged_concerns). **Second NO-GO: automatic iteration STOPPED; round 3 only with `Round 3 authorized by Alejandro: YES`.**

Verbatim:

---

## Verdict: NO-GO

P2 — `src/port-manifest-holiday.test.ts:48`, `src/pipeline/classify-verify.ts:128`

The structural regex only detects `addWarning` calls whose warning starts immediately with a string/template literal. It misses the residency ternary call, whose warning prefixes are inside the conditional branches. A future unlisted prefix in that shape could be added without the test detecting it.

Root cause: the structural test does not cover all `addWarning` argument forms.

Required fix: broaden the structural test to inspect ternary/template warning branches, or add explicit assertions for every prefix emitted by the ternary call.

The holiday prefix itself is correctly filtered. Generate/verify and edit/rewrite paths are clean; follow-up does not inject `flagged_concerns`.

Checked clean:

- `port manifest R292`: 3 passed
- `hold notes`: 2 passed
- `npx tsc --noEmit`: passed
- No files edited; no server, poller, database, network, or browser used


---

**Closed 2026-10-05 (Alex: "Question one, agreed" = fix the test, no round 3).** `24d4e30`: the structural test
now reads each whole `addWarning` call; every `word:` literal in any branch must be in `HOLD_NOTE_PREFIXES`, and
every call must carry one. Mutation-proven: an unlisted prefix in either residency ternary branch, and a variable
message, each fail it; clean code passes. Not Codex-reviewed (no round 3, by Alex's decision). Holiday review CLOSED.
