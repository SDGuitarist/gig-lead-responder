# Codex round 2 — Phase 0 runtime fixes (`8fef58f..b2c68a1`)

**Verdict: GO** (Codex CLI, `codex exec -s read-only`, run by Claude Code at Alex's request on 2026-10-04, at `b2c68a1`). Review #1 is CLOSED. Note: Codex's sandbox could not run the tests this round (`mkdtemp` EPERM); the test results it relied on are the Mac's (519 / 0 / 4), recorded in the prompt. Verbatim output below.

---

## ROUND 2: GO

No P1/P2 findings. The fixes are correct, complete for their declared scope, and introduce no new defect.

- Pipeline failures now retry once, persist the retry note, then become terminal without duplicate rows or sends.
- `invalid_grant` stops both polling and lease renewal; `/health` hides expired holders.
- Lease renewal, wake callbacks, and shutdown rejection paths remain bounded.
- Gmail list pages, tokens, and fetched IDs are validated once and malformed data fails closed.
- Wake behavior matches the documented “more than two minutes asleep” rule.
- Deferred items remain honestly deferred: persistent retry attempts and `invalid_grant` alerting.

Bounded sweep:

- Background callback sites: 5; all protected.
- Provider boundary sites: Gmail watcher is the sole relevant external-data boundary; the changed list/id paths parse and fail closed.
- Retry/terminal policies: poller retry cap and scheduler retry cap; no incorrect terminal transition was introduced.

Controls fired:

- Positive/overshoot controls passed in the supplied Mac evidence.
- Bounded inventory completed.
- High-risk runtime claims remain UNEXECUTED where documented: real Gmail polling, two-process SQLite contention, overnight sleep/wake, and rejecting Yelp shutdown.

Verification:

- Supplied Mac evidence: focused tests passed, full suite `519 pass / 0 fail / 4 skip`, TypeScript and whitespace checks passed.
- In this read-only sandbox, the test runner could not create its temporary directories (`mkdtemp` returned `EPERM`), so local test execution was unavailable.
- Worktree remains clean at `b2c68a1`.

No Claude Code fix prompt is required because there are no valid findings.