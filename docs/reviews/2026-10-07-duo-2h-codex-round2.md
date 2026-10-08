# Codex round 2 — no 1-hour duo fixes (`57d0285..51a2e13`)

**Verdict: NO-GO** (1 P1, 1 P2; Codex CLI `codex exec -s workspace-write`, run by Claude Code on 2026-10-07 at `51a2e13`; tree clean after). All four round 1 findings documented as addressed. **Second NO-GO: automatic iteration STOPPED; round 3 only with `Round 3 authorized by Alejandro: YES`.**

**Claude Code impact check (2026-10-07):** the P1 is a FALSE-HOLD defect only (never lets a wrong price out). Two of its four cases cost nothing today: every residency lead and every graceful decline is already held by its own note. The two that add wrongful holds: no-viable-scope redirects (they state `min_duration`, not the priced hours) and an asked duration of 0/blank. The P2 (no edit-path behaviour test) is valid.

Verbatim:

---

## Verdict: NO-GO

P1 — `src/pipeline/post-check.ts:194-196,264`

The new check applies to every positive quote when `pricing.duration_hours > askedHours`, including correct drafts that intentionally do not state that duration:

- residency drafts with no price/number
- graceful declines
- no-viable-scope redirects, which state `min_duration`, not `pricing.duration_hours`
- invalid/missing `askedHours` values of `0` or `null`

Root cause: the guard treats every priced duration as client-facing and only excludes `undefined`.

Required fix: limit the invariant to ordinary quoted drafts whose client-facing duration is `pricing.duration_hours`; explicitly bypass residency, graceful-decline, and no-viable-scope modes, and require a finite positive asked duration. Add regression tests for each listed case.

P2 — `src/run-pipeline.ts:325-326`

The edit pipeline passes the correct source, `classification.duration_hours`, but no regression test proves that an edited 1-hour duo draft missing “2 hours” is held. The existing wiring test covers only `runPipeline` (`src/run-pipeline.test.ts:185-195`).

Root cause: the edit-path wiring was changed without corresponding behavioral coverage.

Required fix: add an edit-pipeline test that fails when this argument is reverted or sourced from `pricing.duration_hours`.

Checked clean:

- All four round-1 findings are documented as addressed.
- `npm run test:match -- "priced hours stated"` — 3 passing tests.
- `npm run test:match -- "quoted hours"` — 3 passing tests.
- `npx tsc --noEmit` — passed.
- Worktree remained clean.
- No files edited; no server, poller, database, network, or browser used.

