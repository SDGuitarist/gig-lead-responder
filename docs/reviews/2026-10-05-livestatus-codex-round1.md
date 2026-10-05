# Codex round 1 — live GigSalad login status (`0905e81..5649f6d`)

**Verdict: NO-GO** (2 P1; Codex CLI `codex exec -s workspace-write`, run by Claude Code on 2026-10-05 at `5649f6d`; tree clean after). Verbatim:

---

## Verdict: NO-GO

### P1 — Startup snapshot can overwrite a newer lead-read result

`src/automation/portals/gigsalad-login-check.ts:19-33`

Concrete failure:

1. Startup check begins reading `music`.
2. A lead read reports `music: signed_out`; `/health` correctly shows `signed_out`.
3. Startup read returns `ok`.
4. `setGigSaladLoginState(next)` replaces the shared state with stale `music: ok`.

Root cause: startup accumulates a snapshot, then replaces the entire shared state after asynchronous reads complete.

Required fix: update each account through shared state with ordering protection, or otherwise prevent an older startup result from overwriting a newer lead-read result. Add a deterministic concurrency regression test.

### P1 — A rejected inbox read bypasses login-state reporting

`src/automation/portals/gigsalad-match.ts:125-127`

Concrete failure:

```ts
findGigSaladLead(validLeadEmail, async () => {
  throw new Error("profile timeout");
});
```

The function rejects before `onInbox` runs, so `/health` can remain `ok` even though the latest inbox attempt failed. The real `withGigSaladProfile` wrapper can reject on profile overlap or timeout.

Root cause: only returned `{ status: "error" }` values invoke `onInbox`; rejected readers are not converted into an error status.

Required fix: catch rejected inbox reads, report `error` through `onInbox`, and preserve the intended behavior of continuing to the other account where applicable. Add a regression test proving the state changes from `ok` to `error`.

### Question results

1. **Clean:** No. The two P1 findings allow stale or hidden login state.
2. **Clean:** No. Repeated identical lead-read problems are logged once, but the startup race can duplicate or overwrite transition reporting.
3. **Clean:** Yes for import cycles, ordinary shared-state module wiring, and normal matching results. The rejected-reader path changes failure handling but does not alter successful matching.
4. **Clean:** Yes. The new assertions exercise actual callback invocation and state/log behavior; they are not vacuous.

`npm run test:match -- "gigsalad"` passed: 160/160. `npm test` encountered 17 sandbox-only failures involving prohibited server binds and `sysctl`; the changed GigSalad tests passed. Worktree remained clean.
