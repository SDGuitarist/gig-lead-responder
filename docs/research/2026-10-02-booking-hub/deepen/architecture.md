# Architecture review: Booking Hub plan (2026-10-02)

## 1. Mac vs Railway core (Shape, Execution Path, Quality Gate Q4)
Recommendation: **keep one runtime on the Mac, and add an outside dead-man switch. Do not run a second Railway core.**
- Drafting has to happen on the Mac anyway (`claude -p` on Max). So "reply fast at night" already needs the Mac awake. A Railway core would add a second database and a sync problem without making night replies faster.
- Telegram works from the Mac with outbound long-polling (`getUpdates`). It needs no public URL.
- **The gap is silence.** If the hub is dead, it cannot send an alert saying so. Add a heartbeat every 5 minutes to an outside monitor (healthchecks.io free tier, or Railway cut down to a ~20-line watchdog). When the heartbeat stops, the monitor sends Alex a Telegram message. Add this to Phase 0 and to the Execution Path.
- **P1, double sends.** Plan Quality Gate Q4 says "Railway is kept until the Mac proves itself." If both Gmail pollers are live, one lead gets two replies. Pick one place that reads Gmail intake. Railway must be `DRY_RUN=true` with auto-send off, or its poller disabled, before the Mac poller goes live. Add this as a 0.1 gate.
- **P1, missed mail after sleep.** `poller.ts:75` starts the poller's cursor at now−300s on every start. Mail that arrived during a sleep or reboot longer than 5 minutes is never read. Before Phase 1, store the cursor in SQLite (a Gmail `historyId` or the last poll time). Add a regression test that simulates an 8-hour gap.
- **GigSalad.** `feasibility.md` §1 says a reply to GigSalad's notification email is delivered on-platform. That route is sanctioned and needs no browser. Use email reply as the default GigSalad channel. Keep Chrome only for what email cannot do. This also shrinks the plan's top risk (spike S2).

## 2. App/helper boundary (Shape)
- **Merge the helper into the main process** unless spike S3 shows it must stay separate. The plan launches both from a Terminal `.command`, so both get Terminal's Full Disk Access anyway. `claude -p` and `osascript` already run as child processes. Keep "helper" as a code module (`src/mac/`), not a second process.
- **Use a SQLite `jobs` table, not localhost HTTP.** Columns: `id, lane, kind, payload_json, status (queued|running|sending|done|failed|needs_alex), attempts, lease_until, idempotency_key UNIQUE, result_json, error`. A job is claimed with one atomic `UPDATE … WHERE status='queued' RETURNING`. Turn on WAL and `busy_timeout`.
- **One writer per table.** The orchestrator owns the domain tables (leads, gigs, payments, reminders). Job runners write only `jobs.result_json`, plus an append-only `inbound_messages` table for `chat.db` reads. The orchestrator then applies results inside one transaction.

## 3. Driving `claude -p` (Phase 1.7, System-Wide Impact)
- **Two lanes:** `draft` (concurrency 1) and `browser` (concurrency 1, always). Chrome is Alex's live browser. Run browser jobs only when he has been idle more than 5 minutes or during quiet hours.
- **Timeouts:** about 180s for a draft, about 300s for Chrome. Spawn with `detached:true` and kill the whole process group (`process.kill(-pid)`) so MCP children also stop.
- **Preflight from output:** use `--output-format stream-json --verbose` and abort if the `system/init` event's `apiKeySource` is not `none`.
- **Flags:** `--max-turns` and `--allowedTools`. No Bash on Chrome runs.
- **Prompt injection:** the Chrome agent never sees lead text. It receives the already-gated final message plus the lead URL. Its job is "paste exactly this, read it back, report a match".
- **Crash during a send:** set `status='sending'` before the click. A job found in `sending` after a restart goes to `needs_alex` and is never retried automatically.
- **Usage limits:** Max limits are shared with Alex's interactive sessions. When a run hits the limit: HOLD, send an alert, and do not retry. Only transient failures get retries (at most 2).

## 4. Split the plan (whole doc)
Yes, split it.
- `…-booking-hub-roadmap.md`: overview, decisions, module order, success metrics.
- `…-phase0-module1-plan.md`: review and converge this one now.
- Modules 2–4: one plan each, written after the module before it has run live for a week. Phase 0 spike results (S2–S5) and Module 1 use will change them.
- Reviewing all 678 lines now would spend the two-NO-GO budget on modules nobody can test yet.
- Move the gigs/payments/documents schema to the Module 2 plan.

## 5. Sleep and wake (Execution Path, Phase 2.3)
**Keeping the Mac awake**
- Start the app as `caffeinate -is node …` inside the `.command`. The wake lock then lives exactly as long as the process. Also set `pmset -c sleep 0`.
- On a MacBook with the lid shut and no external display, it still sleeps. Note this rule: leave the lid open on the charger at night.
- Wrap the start command in a restart loop (`while true; do …; sleep 5; done`). There is no launchd KeepAlive to restart a crashed process.
- If FileVault is on, a restart from an OS update stops at the login screen until Alex logs in. The dead-man switch covers this.

**What happens to timers**
- Node timers use a clock that stops while the Mac sleeps. The 15-minute `setTimeout` chain in `follow-up-scheduler.ts:7` therefore fires late after wake.
- Add a 30-second wall-clock check. If it sees a jump of more than 2 minutes, it should poll Gmail and run the scheduler right away.

**Missed reminders**
Reminders live in `due_at` rows, so none are lost. Add two rules:
- Each reminder kind gets a `stale_after` time. A reminder past it goes to Alex's digest as "missed", never to the client. Example: a balance reminder found after the event date.
- Client-facing catch-up waits until quiet hours end. Alex gets catch-up items as one digest, not a burst of messages.
