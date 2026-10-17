# Codex CODE review round 1: held leads display (todo 097), 2026-10-16

**Verdict: NO-GO** (0 P0, 0 P1, 1 P2), pasted by Alex. **Reviewed:** branch `feat/hub-phase0`, diff `71611e7..035b4454e10d5a167b2d014bd2849c7192c46f7a` restricted to src/, public/,
scripts/, tests/ (code commits `e79461e`, `1a02877`, `d75508d`, `b4e268b`, `c5eaf43`, `6cbade8`). The reviewer reported: full suite 1,235 pass / 0 fail / 1 skip, typecheck
and venue leak check pass, HEAD unchanged and tracked worktree clean; my mutation checks and the real-database-copy migration were NOT independently repeated by it; suite and
leak-check reruns needed sandbox escalation. No review record was written by the reviewer; this file is mine, from the pasted response. The earlier three PLAN reviews are a
separate, closed loop. **Code-loop counters: Codex code reviews 1 (R1 NO-GO); Claude code fix attempts 0 before this record.**

Everything else in the scoped diff was accepted by the reviewer: migration v4 runs after the legacy rebuild; routing decisions, approve routes, stats, statuses and follow-up
logic unchanged; router reasons are fixed wording or numbers; the dashboard escapes the reason as element text, never an attribute; only held rows lose the muted classes; the
reversed dashboard script matches the actual pre-change script byte-for-byte after removing unused helpers; new database tests use temporary databases and API tests use
loopback HTTP; migration failures propagate before the server listens.

| # | Codex finding | My check | Status |
|---|---|---|---|
| P2-1 | The storage tests append synthetic leads to the real operational log: `hold-reason-storage.test.ts:47` sets `config.logPath = "/dev/null"`, but `processLead` calls the logger whose own default is `logs/leads.jsonl` (`logger.ts:18`); `config.logPath` is never applied to the logger by `processLead` | CONFIRMED and REPRODUCED in a disposable working directory (no pollution of the real log): running only S1 from a temp cwd passed, and created `logs/leads.jsonl` there holding one event `{gmailMessageId: "hold-s1", platform: "yelp", status: "dry-run", edgeCase: true}`. Real log stayed at 1978 lines during the reproduction. Reading the code: `setLogPath` is called only by `poller.ts:187` (`config.logPath`) and `scripts/ingest-one.ts:28`, never by `processLead` | see the fix section below |

**Root cause.** The log destination is module state in `src/automation/logger.ts` (`let logPath = "logs/leads.jsonl"`) set only by the poller and the ingest script. A test that
passes a config with `logPath: "/dev/null"` to `processLead` changes nothing, so every run appends to the real operational log. My tests copied the config shape from
`src/yelp-quote-parser.test.ts`, which has the same hole.

**Second instance of the same class (confirmed, inventoried, NOT fixed here).** Five existing test files call `processLead` or `handleAutoSendDecision` with the real logger and
never call `setLogPath`: `src/orchestrator.test.ts`, `src/orchestrator-platform.test.ts`, `src/orchestrator-retry.test.ts`, `src/orchestrator-gigsalad.test.ts`,
`src/yelp-quote-parser.test.ts` (plus my `src/hold-reason-storage.test.ts`). Read-only counts of the real `logs/leads.jsonl` (1978 lines, 427,219 bytes, gitignored by `.gitignore:10`,
no code reads it; `config.ts:62` defaults `LOG_PATH` to it): 654 `gs-N`, 327 `pf-N`, 326 `pf-ok`, 255 `gs-slow`, 101 `orch-platform-N`, 80 `retry-N` (all test-id shapes), 50 `hold-s*` (mine, from
repeated full-suite runs, including the reviewer's), 185 sixteen-hex ids (real or fixture-shaped; not separable by id alone). So most of the file is synthetic. Provisional
structural assessment: make `logLead` skip or redirect its write when `NODE_TEST_CONTEXT` is set and no path was set explicitly (the same pattern as `logUsage` in `src/claude.ts`);
one conditional in a production module, reversible by one revert, no data migration, fixes all six files at once; or the narrower, per-file fix of a `setLogPath(tempFile)` call in
each of the five files. Either is a scope expansion beyond the reviewed finding (the surface is five untouched test files or a production module), so it is DEFERRED and escalated to
Alex. Existing entries are not deleted or scrubbed.

## Fix (Claude code fix attempt 1), commit `dba99f6`

Only `src/hold-reason-storage.test.ts` changed. (1) `setLogPath(<temp file>)` points the REAL logger at a temporary file before any `processLead` call, and `cfg.logPath` now names the
same file; (2) after every import has resolved the test `chdir`s into a private temp directory (restored in `after`), so the logger's relative default `logs/leads.jsonl` could only land
there. New tests: **L1 (positive control)** the held lead's event reaches the temp log with `edgeCase: true`, status `dry-run`, reasons equal to the Yelp reason (logging is not suppressed);
**L2 (overshoot control)** the private directory never gets a `logs/` folder and the temp log holds only `hold-*` ids. Why a private directory and not a before/after size check of the real
log: `node --test` runs files in parallel and the five older files write the same default log, so a size check would be flaky.

| Fix-contract item | Result |
|---|---|
| Reproduction | Done BEFORE the fix, in a disposable directory: S1 alone created `logs/leads.jsonl` there with one `hold-s1` event; the real log stayed at 1978 lines |
| Regression that fails without the fix | Mutation: delete the `setLogPath` line. Result: L1 and L2 FAIL, S1-S5 still pass; restored byte-for-byte; the stray writes of that mutation went to the private temp directory, not the real log |
| Positive / overshoot controls | L1 (events DO reach the temp log) and L2 (nothing reaches the default path); production logging is untouched (no change under `src/automation/`) |
| Focused protected-runner result | `npm run test:match -- "hold_reason storage"`: 8 of 8 (S1, S2, S2b, S3, S4, S5, L1, L2) |
| Full suite | Run in a DISPOSABLE COPY of the repo (so the five older files could not append to the real log): 1238 tests, 1236 pass, 1 skip, 1 fail. The one fail, `travel fee table is tracked in git and loads`, is an artifact of the copy (no `.git`); run in the real repo it passes. Net: 1237 pass, 0 fail, 1 skip of 1238 (baseline before the build 1198 + 40 new). In that run my tests wrote 0 `hold-*` events to the copy's default log |
| Typecheck, leak check | `npm run typecheck` exit 0; `npx tsx scripts/check-venue-history.ts` PASS exit 0 |
| Real log | 1978 lines before the reproduction and 1978 after every run in this fix (the log is not deleted or scrubbed; its 50 `hold-s*` lines and ~1,700 other synthetic lines remain) |

**Second instance, decision needed from Alex (not applied; escalated).** Five older test files (`orchestrator.test.ts`, `orchestrator-platform.test.ts`, `orchestrator-retry.test.ts`,
`orchestrator-gigsalad.test.ts`, `yelp-quote-parser.test.ts`) still append to the real log on every `npm test`, which is why this file is mostly synthetic. Options, both reversible:
(A) one conditional in `src/automation/logger.ts` that skips the write when `NODE_TEST_CONTEXT` is set and no path was set explicitly (the `logUsage` pattern in `src/claude.ts`): one production module, fixes all
six files, but it is a production-code change nobody reviewed; (B) a `setLogPath(tempFile)` call (and, if the file asserts nothing on the log, nothing else) in each of the five files: five test-only edits, no
production change. My lean: B, because it changes no production code. Either way, the existing log lines are Alex's to keep or clear.

Remaining risks: the older files keep polluting the real log until A or B is chosen; the dashboard and server restart items from Update 28 are unchanged and still UNEXECUTED (owner Alex).
