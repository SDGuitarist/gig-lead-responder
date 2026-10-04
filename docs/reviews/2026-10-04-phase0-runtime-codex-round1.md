# Codex round 1 — Phase 0 runtime: poller cursor, lease, wake, /health (`2f2ec7d..e1fb163`)

**Verdict: NO-GO** (Codex CLI, `codex exec -s read-only`, run by Claude Code at Alex's request on 2026-10-04, at `8fef58f`; gate clean: no reviewed file moved after `e1fb163`). Prompt: session 33bddb35's `codex-round1-phase0-runtime.md` plus a re-verification note. Verbatim output below.

---

## Verdict: NO-GO

The frozen runtime files did not move after `e1fb163`. Step 1 was empty; Step 2 matched the expected 14-file control. Worktree is clean at `8fef58f`.

### P1 — Pipeline failures are permanently skipped

`processLead()` catches pipeline errors, writes `status: "failed"` plus `pipeline_completed_at`, calls `markProcessed()`, and returns (`src/automation/orchestrator.ts:139-159`).

On retry, the early return at lines 82–85 sees the non-`received` status and marks the message processed again. The lead is never retried.

This contradicts the hold-on-failure behavior and the stated “failed lead retried” goal. The existing retry test only tests `pollOnce()` with a failing handler; it does not test a failure inside `processLead()`.

Fix: distinguish retryable pipeline/enrichment failures from terminal holds and send ambiguity. Add a regression test that fails without the fix: first `processLead()` fails, the second invocation reruns the pipeline, and no duplicate lead row is created.

### P1 — Auth failure leaves the lease-renewal timer running

When Gmail returns `invalid_grant`, `pollOnce()` records auth failure and `poll()` sets `authFailed`, clears the polling interval, and stops polling.

However, `leaseTimer` remains active (`src/automation/poller.ts:187-200`). It continues renewing the lease every 20 seconds. The process therefore reports a live lease and can block another worker from acquiring it indefinitely while the server remains alive.

Fix: stop the lease-renewal timer whenever polling stops because of authentication failure, and test that the lease is no longer renewed after `invalid_grant`.

### P1 — Lease renewal has an uncaught background exception path

`setInterval(acquireOwnLease, LEASE_RENEW_MS)` passes the function directly (`src/automation/poller.ts:200`). `tryAcquireLease()` uses a SQLite `IMMEDIATE` transaction, which can raise `SQLITE_BUSY` or another database error.

The main `poll()` catch does not protect this timer callback. An exception from the timer can become an uncaught process failure.

Fix: wrap lease renewal in an explicit async/synchronous error boundary, log the failure, and fail closed. Add a deterministic test or explain why SQLite contention cannot be reproduced reliably.

This is an instance of a broader class: background callbacks whose exceptions escape their owner’s error boundary. Sweep the bounded runtime surface: lease renewal timer, poll interval, wake timer callback, scheduler timeout callback, and shutdown promises.

### P1 — Retry attempts are only in memory

`failedAttempts` is a process-local `Map` (`src/automation/poller.ts:61-62`). A restart resets the counter. A poison message can therefore hold the cursor for three more attempts after every restart and repeatedly prevent later mail from advancing.

The handoff already acknowledges this risk, but it remains a real polling-freeze edge case. Either persist retry state, or explicitly defer this as separately planned work with an owner and trigger.

### P2 — Gmail response data is trusted through type assertions

`listMessageIdsSince()` treats Gmail list responses as `ListPage` without runtime validation. Raw `nextPageToken` and message IDs are passed to later API calls. `fetchMessage()` also converts a missing Gmail ID into `""`.

Malformed or unexpected provider data could cause repeated pagination, invalid fetches, or multiple malformed messages colliding on the empty deduplication key.

This is an instance of the boundary-parsing class. The bounded surface to sweep is Gmail list pages, page tokens, message IDs, and message headers. Parse once into validated values; reject malformed pages or IDs.

### P2 — Wake threshold does not match the plan exactly

The plan says a jump of more than two minutes triggers catch-up. The implementation requires:

```ts
gap > TICK_MS + JUMP_MS
```

That is more than 150 seconds, not more than 120 seconds. This is a static threshold mismatch, not an S6 execution finding. Actual overnight behavior remains UNEXECUTED because S6 has not been run.

### P2 — `invalid_grant` alerting is missing

The plan acceptance test requires an alert to Alex when Gmail returns `invalid_grant`. The current code only logs the failure and records `/health` state. The focused test is intentionally absent, as documented.

This is a known deferred scope gap, not a hidden runtime defect. It must remain labelled as requiring Module 1 alert infrastructure; do not claim Phase 0 fully satisfies that acceptance criterion.

### Exception-contract summary

- Gmail list/get failures are caught by `pollOnce()` at fetch time.
- Per-message processing failures are caught by `pollOnce()`, except pipeline failures swallowed inside `processLead()`.
- SQLite errors during the normal poll are caught by `poll()`; SQLite errors from `leaseTimer` are not.
- `wake-watch.ts` does not wrap `onWake`. The current server callback mostly launches promises that have catches, but the callback boundary itself is not protected.
- `follow-up-scheduler.ts` catches its main work errors, but `startFollowUpScheduler()` and `kickFollowUpScheduler()` intentionally fire `schedulerLoop()` without awaiting it.
- `stopGmailPoller()` is called without handling its returned promise during SIGTERM.

The unauthenticated `/health` endpoint exposes only poller state and lease hostname. Because the server now binds to `127.0.0.1`, I found no new external exposure in this diff; the health contract itself is implemented.

No frozen runtime file appears unrelated to the plan. `src/pipeline/context.ts`, port docs, and port tests are later 0.5 work and were not assessed as part of this runtime verdict.

## Claude Code fix prompt

```text
Work in /Users/alejandroguillen/Projects/gig-lead-responder. Branch: feat/hub-phase0. Ask: apply the named Phase 0 runtime review fixes from Codex round 1.

FIRST -- confirm no other session or auto-continue is live here. Run:
  pwd
  git branch --show-current
  git rev-parse feat/hub-phase0
  git status --short

Expected branch: feat/hub-phase0.
Expected HEAD: the current branch tip returned by `git rev-parse feat/hub-phase0`.
Stop if the branch or worktree differs unexpectedly.

Read first:
  - HANDOFF.md
  - CLAUDE.md
  - AGENTS.md if present
  - docs/plans/2026-10-02-feat-hub-phase0-lead-replies-plan.md
  - ~/.claude/docs/mandatory-review-workflow.md
  - ~/.claude/docs/review-loop-convergence.md

This is round 2 only: verify and fix only the named findings below. Do not perform another broad review. After a second NO-GO, automatic iteration stops; round 3 requires the literal approval:
  Round 3 authorized by Alejandro: YES

Named findings:

1. Pipeline failures are permanently skipped.
   Reproduce the failure through `processLead()`: make the injected pipeline fail, invoke the same Gmail message again, and show that the current code marks it processed and does not retry.
   Root cause: `processLead()` records `status='failed'` plus `pipeline_completed_at`, calls `markProcessed()`, and the early-return condition treats every non-received row as terminal.
   Fix the state contract so retryable pipeline/enrichment failures remain retryable, while terminal review holds and send ambiguity remain protected from duplicate sends.
   Add a regression test that fails without the fix and proves:
   - one lead row only;
   - the first attempt fails;
   - the second attempt reruns the pipeline;
   - a completed/ambiguous send path still does not send twice.
   Add a positive/overshoot control proving valid terminal holds remain terminal and are not retried indefinitely.

2. Auth failure leaves the lease-renewal timer running.
   Reproduce or explain why deterministic reproduction is impractical.
   Root cause: `poll()` clears the polling interval after `invalid_grant` but does not clear `leaseTimer`.
   Fix the lifecycle so auth failure stops lease renewal and leaves health/lease state truthful.
   Add a regression test that fails without the fix.

3. Lease renewal can escape its exception boundary.
   Reproduce with a controlled SQLite contention/error where practical; otherwise state why real contention is impractical and use an injected failure seam.
   Root cause: `setInterval(acquireOwnLease, LEASE_RENEW_MS)` invokes a potentially throwing SQLite transaction without a wrapper.
   Fix the background callback to catch/log failures and fail closed without an uncaught process exception.
   Add a regression test that fails without the fix.
   This is an instance of the background-callback exception class. Inventory the bounded runtime surface:
   lease renewal timer, poll interval, wake timer callback, scheduler timeout callback, and shutdown promises.
   Report which are protected, which are not, and make the smallest structural fix justified by the inventory. Do not introduce a new subsystem.

4. Retry attempts are process-local.
   Reproduce the restart/reset behavior or explain why a real restart is impractical.
   Root cause: `failedAttempts` is an in-memory Map.
   If fixing this requires a new persistent store or broader protocol, do not expand this review loop. Instead, label it explicitly as deferred planned work with owner, trigger, and consequence. If a small existing-state fix is sufficient, implement it with a regression test.
   Do not silently claim the crash-loop risk is resolved.

5. Gmail boundary parsing.
   Reproduce malformed list-page/id behavior with fixtures.
   Root cause: external Gmail list responses are type-asserted and raw page tokens/message IDs are passed onward; missing IDs become `""`.
   Validate once at the Gmail boundary into trusted typed values, reject malformed values, and add positive and overshoot controls. Sweep the bounded surface of list pages, page tokens, message IDs, and headers. Do not broaden into a general validation framework.

6. Wake threshold.
   Align the implementation with the plan’s exact “more than two minutes” rule, or document a concrete reason to retain the extra tick. Add a boundary test around 120 seconds and a normal 30-second control. Do not claim S6 is executed; it remains UNEXECUTED until Alex runs the overnight Mac test.

7. invalid_grant alerting.
   Do not invent Module 1 alert infrastructure in this fix batch. Keep the known gap explicitly labelled as deferred, with owner Claude and trigger “after the Module 1 provider/alert channel exists.” Add or update no false passing test.

Follow the fix contract in ~/.claude/docs/mandatory-review-workflow.md for every valid finding:
- reproduce it, or explain why reproduction is impractical;
- name the root cause before fixing it;
- add a regression test that fails without the fix, or explain why deterministic testing is impractical;
- add a positive/overshoot control whenever the fix could overreach;
- on the second confirmed instance of one failure class, provide a bounded inventory and provisional shape assessment;
- execute high-risk “safe because X” claims when practical; otherwise label each UNEXECUTED with reason, owner, and trigger;
- report focused test results, full-suite results, and remaining risks.

Run:
  npx tsc --noEmit
  npm run test:match -- "<each named regression test>"
  npm test

Before handing back, verify:
  git status --short
  git branch --show-current
  git rev-parse feat/hub-phase0

Do not modify unrelated port work. Do not run real Gmail, real sends, or production data. Do not create a PR.
```

Round 0 was satisfied: the server has been booted with Gmail disabled and the deterministic focused tests ran. Real polling, two-process contention, and overnight wake remain execution-only evidence gaps, not review defects.
---

## Fixes (session 0153v273, 2026-10-04)

| # | Finding | Root cause | Fix | Test (red first) |
|---|---|---|---|---|
| 1 | P1 pipeline failure skipped for good | the catch marked the lead `failed` + processed; the early return treats any non-`received` row as done | `ab30889` (Alex: retry once, then hold): first failure writes `pipeline attempt 1 failed: ...` on the row and rethrows (poller holds the cursor); a second failure is final (failed, SMS, processed); a successful retry clears the note | `pipeline failure retried once` ×2 (red: `Missing expected rejection`; note-clearing shown red by removing the line). Two existing tests updated on purpose: a first failure now rethrows |
| 2 | P1 lease renewed after invalid_grant | auth branch cleared the poll interval only | `49f1352`: auth failure stops renewal; a first poll that fails auth no longer starts the interval; `/health` names a holder only while the lease is live | `poller lease lifecycle: invalid_grant stops lease renewal` (red: renewed after auth failure); control: non-auth error keeps renewing; `health reports lease host: an expired lease reports no host` |
| 3 | P1 lease renewal can throw out of its timer | `setInterval(acquireOwnLease)` unwrapped; SQLITE_BUSY possible under IMMEDIATE | `49f1352`: renewal wrapped, logged, next tick retries | `poller lease lifecycle: a throwing renewal is caught...` (red: `database is locked` escaped) |
| 3 (class) | background callbacks escaping their boundary | -- | `f6bcdae`: wake callback wrapped; SIGTERM `stopGmailPoller()` rejection caught | `wake catch-up: a throwing wake callback is caught...` (red). Shutdown: not unit-tested (`server.ts` exits at import without a key and listens at import); verified by reading |
| 4 | P1 retry attempts in memory | `failedAttempts` is a process Map | **DEFERRED** (Alex 2026-10-04): needs a new persistent store (migration v3), which leaves the review loop. Consequence: each restart gives a poison message 3 more attempts, each holding the cursor. Owner Claude; trigger: before the poller runs unattended overnight (S6). Pipeline failures specifically are now capped across restarts by finding 1's row note | -- |
| 5 | P2 Gmail data trusted | list pages type-asserted; id-less entries skipped; repeated token looped; missing fetched id became `""` | `44a396c`: `parseListPage` parses each page once (object, array, URL-safe string ids, string token) or throws; a repeated page token throws; a fetched message must carry the requested id | `gmail boundary` ×5 (red: 3 of 4 first tests; the loop test only stopped at the test's own 5-page bail-out); control: empty page, null fields, real ids |
| 6 | P2 wake threshold 150 s vs "2 minutes" | -- | **Kept, documented** (`f6bcdae`): the plan's EARS line is "wakes after more than 2 minutes **asleep**"; asleep = gap − the 30 s tick, so the boundary is a 150 s gap. Firing at a 120 s gap would fire after 90 s asleep | `wake catch-up: fires at just over 2 minutes asleep, not at exactly 2` (pins current behaviour; no code change) |
| 7 | P2 no invalid_grant alert | no alert channel until Module 1 | **DEFERRED, unchanged**: owner Claude; trigger after the Module 1 alert channel exists. `invalid_grant alerts` still exits 3 (no test written, none faked) | -- |

**Background-callback inventory (5 sites):** lease renewal timer (fixed), poll interval (already protected: `poll()`
catches everything), wake callback (fixed), follow-up scheduler (protected: `alertAlex` is async and every call is
awaited inside a try or has `.catch`), SIGTERM shutdown promise (fixed). Shape: local wrappers at each site; no new
mechanism.

**Found while fixing (the class's own question asked of the fix):** the poller treats ANY error text containing `401`
as an auth failure and stops for good (`isAuthError`, pre-existing). The new boundary errors therefore never echo a
provider value (a hex id can contain `401`); test `gmail boundary: errors never echo provider values`. The substring
rule itself is unchanged and is a remaining risk: any other error that happens to contain `401` stops polling.

Suite 519 pass / 0 fail / 4 skip; `tsc` and `git diff --check` clean.
UNEXECUTED (unchanged): a real poll, two real processes racing for the lease, an overnight sleep (S6).
