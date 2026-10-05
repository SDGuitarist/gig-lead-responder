# Codex round 1 — GigSalad startup login check (`a0b5abc..0545495`, code `5c7a9e3`)

**Verdict: NO-GO** (1 P1; Codex CLI `codex exec -s workspace-write`, run by Claude Code on 2026-10-05 at `0545495`; tree clean after). Verbatim:

---

## Verdict: NO-GO

- **P1 — Startup can block the poller indefinitely or for ~80 seconds.**  
  **File:** `src/automation/poller.ts:223`; `src/automation/portals/gigsalad-match.ts:88-105`  
  **Input:** GigSalad browser launch or `context.close()` hangs; or both accounts hit the 30-second navigation timeout sequentially.  
  **Root cause:** `startGmailPoller()` awaits the login check before registering `activePoll`, starting the first poll, or scheduling the interval. The reader has no overall timeout.  
  **Required fix:** Bound each account check, including cleanup, and ensure timeout/failure becomes `error`; then prevent the bounded check from delaying poll startup beyond the agreed limit. Add a regression test proving a hung reader cannot block the first poll indefinitely.

Questions checked clean:

1. Normal reader results cannot report `ok` unless the reader returns `ok`; caught failures become `error`, and initial state is `unchecked`.  
2. The check runs after the Gmail-auth gate and its ordinary errors are caught, but the unbounded awaited browser operation is a startup-delay risk.  
3. `/health` exposes only per-account status strings and `checked_at`; no credentials, account identifiers, or inbox data.  
4. The login-status assertions are substantive, not vacuous. However, the tests do not exercise actual `startGmailPoller()` startup wiring.

Verification:

- Focused command passed: `npm run test:match -- "gigsalad login check"` — 3 matching tests passed.
- Full `npm test` could not complete cleanly in this sandbox: 17 failures were environment restrictions (`listen EPERM` and blocked `sysctl`), while the feature-specific tests passed.
- Worktree remained clean.
