---
title: "feat: Booking hub Phase 0 + Module 1 (lead replies)"
type: feat
status: active
date: 2026-10-02
origin: docs/brainstorms/2026-10-02-booking-hub-brainstorm.md
roadmap: docs/plans/2026-10-02-booking-hub-roadmap.md
feed_forward:
  risk: "MacBook-hosted runtime (sleep, lid, OS restarts) and whether GigSalad's email reply really lands on-platform"
  verify_first: true
---

# Booking Hub: Phase 0 + Module 1 (Lead Replies)

### Prior Phase Risk

> **Brainstorm "Least confident about going into the next phase?":** "whether GigSalad, Yelp and
> The Bash allow automated portal replies, and whether Playwright logins survive their bot checks.
> If not, auto-send shrinks to email/form leads and the portals get "draft + one-tap approve."
> Second: reading iMessages needs Full Disk Access on the server Mac, and macOS privacy rules have
> blocked reads before."

The research resolved this:
- **GigSalad.** Its help center says a reply to the notification email is delivered on the
  platform, so email is the default and no portal bot is needed. Spike S2 proves it on a real lead.
- **Yelp** is approve-only.
- **The Bash** is deferred.
- **Reading iMessages** is delayed (Alex's choice). Module 1 only *sends* iMessage alerts to Alex
  and reads them back to confirm delivery, which still needs Full Disk Access. That is spike S3.

## Enhancement Summary

**Deepened on:** 2026-10-02. Six reviewers, with reports in
`docs/research/2026-10-02-booking-hub/deepen/`: security, data integrity, architecture,
simplicity, TypeScript, and Claude Code headless.

**Sections enhanced:** Phase 0 (all), the send gate, outbound sends, approvals, the `claude -p`
provider, the runtime, and the acceptance tests.

### Key improvements
1. **Test instrument repaired.** `npm test -- --test-name-pattern=X` runs all 351 tests and exits
   0 even for a name no test has. This was verified on 2026-10-02, so every Verify line in the
   previous draft was decoration. Phase 0 adds `test:match`, which fails when zero tests match.
2. **Two live security defects found in today's code.**
   - The sender check accepts any domain's DKIM (`src/automation/source-validator.ts:79-84`).
   - The dashboard listens on every network and turns login off outside production (`src/server.ts:43`,
     `src/auth.ts`).
   Both are fixed in Phase 0, before anything new.
3. **The send gate becomes an allowlist.** Code fills the price and date into slots. Any number,
   date or contact-like token outside a slot causes a HOLD, which closes bypasses like "twelve
   hundred" and "six one nine".
4. **Exactly-once sends.**
   - An `outbound_messages` row records the intent before sending.
   - Each email carries a stable Message-ID, so after a crash the app can check Gmail Sent.
   - A Chrome send whose outcome is unknown is never retried; Alex is asked.
   - A runtime lease means only one host (Mac or Railway) can send at a time.
5. **Mac runtime made safe.**
   - The poller's cursor is stored, because today it looks back only 5 minutes after any restart
     (`src/automation/poller.ts:75`).
   - A catch-up run happens after the Mac wakes.
   - The app runs under `caffeinate` inside a restart loop.
   - An outside heartbeat reports when the Mac goes silent.
6. **`claude -p` locked down.** No tools for drafting runs, no user MCP servers or settings, an
   empty working directory, an `apiKeySource` check, and limit errors hold the lead instead of
   billing.

### New considerations discovered
- The lead status `sent` today means "texted to Alex", which collides with "sent to client". New
  statuses come in through a real migration runner.
- Rates are stored in dollars and the new code works in cents. There is exactly one conversion
  point.
- `src/run-pipeline.ts` already accepts `platform`. The orchestrator bug is a single missing
  argument.

---

## Overview

Phase 0 makes the existing app safe, honest and portable, and settles the unknowns with spikes.
Module 1 makes lead replies fast:
- a code-gated auto-send, earned through a 20-lead review-only ramp
- approvals that actually reach the client
- the claude.ai Project's rules ported into the repo
- drafting on Claude Max

Modules 2–3 are out of scope (see the roadmap).

## Phase 0 — Foundations (no new features)

Each item is a commit of about 50–100 lines with one concern, and each starts with a failing
test. **Order matters.**

### 0.1 Test instrument (first, because every other item relies on it)
- **What:** add `npm run test:match -- "<name>"`.
  - It runs `node --import tsx --test --test-name-pattern=<name>` over **all** test files,
    widening the glob to `src/**/*.test.ts` and `tests/**/*.test.ts`.
  - It parses the TAP or spec output and **exits non-zero when zero leaf tests match**.
- **Known-answer check:**
  - `test:match "allows Basic Auth POSTs"` must report ≥1 and exit 0.
  - `test:match "zz-no-such-test"` must exit non-zero.
- *Why:* tested on 2026-10-02, both `npm test -- --test-name-pattern=zz-no-such-test-xyz`
  (351 pass, exit 0) and the direct `node --test` form ("tests 26", the file count) look the same
  as a match. A check that cannot tell "matched" from "absent" is not a gate.

### 0.2 Production truth + single writer (read-only first)
- **Read:** Railway logs show whether the poller is alive, which Gmail account the token belongs
  to, and the `AUTO_SEND_ENABLED` / `DRY_RUN` values. Nothing changes.
- **Runtime lease:** a `runtime_lease(host, heartbeat_at)` row, checked inside the send
  transaction. A host that doesn't hold the lease refuses to send.
- **Cutover order** (each step needs Alex's explicit yes; destructive steps are marked):
  1. Set Railway `DRY_RUN=true`, turn auto-send off, disable its poller, and confirm in the logs.
  2. Copy the database with `sqlite3 .backup`, never `cp` on a WAL database, and compare row
     counts on both sides.
  3. Start the Mac poller.
  4. *(destructive, separate yes)* Shut Railway down after 1 week of the Mac being healthy.

### 0.3 Live defects (tests first)
| Defect | Fix | Source |
|---|---|---|
| The auto-send path drops `platform` | Pass `lead.platform` at `src/automation/orchestrator.ts:~130` (`src/run-pipeline.ts:87` already accepts it) | repo.md #2 |
| DKIM accepts any domain | Require `dmarc=pass`, with `header.from`/`header.d` equal to the allow-listed domain. Parse only the top `Authentication-Results` header added by Google | security C2 |
| Dashboard open on every network; login off outside production | Bind to `127.0.0.1`. Refuse to start without `DASHBOARD_USER`/`DASHBOARD_PASS`/`COOKIE_SECRET`, whatever `NODE_ENV` says. Set `trust proxy` to loopback only. Put `csrfGuard` on all POSTs | security H3 |
| Poller looks back only 5 minutes after a restart | Store a cursor (Gmail `historyId` or the last poll time) in SQLite | architecture P1 |
| Timers run late after sleep | A 30-second wall-clock check: a jump of more than 2 minutes triggers an immediate poll and a scheduler run | architecture Q5 |
| `/health` can't tell "never started" from "healthy" | Report `poller.last_success_at`, `poller.auth` (`ok`/`failed`) and `lease.host` | todo 020 |
| Travel fee always misses | Load `zip_distances.json` from a tracked path | todo 020 |
| SMS deep links go to `/leads` and get 404s | **Delete** them, since Twilio is being dropped | todo 020; simplicity |

### 0.4 Migration runner
- Numbered migrations tracked with `PRAGMA user_version`. Each migration runs in its own
  transaction.
- An automatic `.backup` to `data/backups/pre-vN.db` before each one.
- The app refuses to start against a DB newer than its code.
- The existing `mailgun_message_id` dedupe **fails loudly instead of deleting rows**
  (data-integrity P0 #3).
- Module 1 needs this for its new statuses and the `outbound_messages` table.

### 0.5 Lead Responder port (Project → repo)
- **Source:** `~/Desktop/Gig_Lead_Response_System_4.0_Extraction.md` and
  `~/Desktop/Rate_Card_Solo_Duo.md`. **Move both into `~/Data/`** before starting; they don't go
  in the repo.
- **Landing places:** each rule lands in a *loaded* doc (`src/pipeline/context.ts`), a prompt
  builder (`src/prompts/*.ts`) or `src/data/rates.ts`. A doc that never loads does nothing.
- **Rules:**
  - Graceful Decline (step 7 plus its 5 gate checks)
  - the competition-count rule
  - R1–R3 residency tiers
  - T4 and nonprofit pricing
  - the guitar/ukulele delivery rule
  - the LEAD_RESPONSE_VOICE kill list, as code checks wherever they can be mechanical
  - VENUE_INTEL
  - EVENT_STRUCTURE_THEORY
  - the T4 reference lead
- **Output:** `docs/research/2026-10-02-booking-hub/port-manifest.md`. Each row gives the rule id,
  its source, where it lands, and the marker string that the "port manifest loaded" test looks
  for. It contains no rates and no client text.
- **Questions for Alex, one at a time:**
  - (a) The Trio/Ensemble card: review `trio-ensemble-diff.md` block by block. The recommendation
    is to adopt the Project's version.
  - (b) The battery-powered sound rule conflict.
  - (c) `AUTHENTICITY_SCREEN.md` and `FOLLOW_UP.md`: do they exist anywhere, or should the
    references be dropped?

### 0.6 Win-rate baseline (read-only)
- **Sources:** the GigSalad dashboard, the Yelp business dashboard, and a count of GIG Calendar
  bookings. Gmail is searched only for email/form inquiries that those don't cover.
- **Period and output:** the last 12 months, written to
  `docs/research/2026-10-02-booking-hub/baseline.md` with its sources and date range.
- **Why it's needed:** the local DB has 0 recorded outcomes, so it can't serve as the baseline.

### 0.7 Spikes (yes/no, each tested against a known answer)
Results go in `docs/research/2026-10-02-booking-hub/spikes.md`.

| # | Question | Known-answer test | If NO |
|---|---|---|---|
| S1 | Can `claude -p` run on Max from the app, locked down? | `env -u ANTHROPIC_API_KEY claude -p --output-format stream-json --verbose` with the lockdown flags (below) on a fixture lead. The `system/init` event shows `apiKeySource: none` and no tools or MCP servers. Field names are confirmed from real output; the docs don't name them (`claude-headless.md`) | Stop and ask Alex. Never fall back to an API key |
| S2 | Does GigSalad's email reply land on the platform? | On a real lead Alex is answering anyway, with his approved text, the app sends by email reply. Alex sees it in the GigSalad thread. **Alex performs the send** (outward-facing) | GigSalad goes to the Chrome fallback (S2b) |
| S2b | Chrome fallback: fill without sending, injection-safe | A separate Chrome profile with GigSalad only. The agent gets the gated text plus a URL matching `^https://www.gigsalad.com/`. It pastes, reads back and hash-matches, and **does not send**. A second run uses a lead fixture containing injection text, and what gets filled must not change | GigSalad becomes draft + alert, and Alex pastes |
| S3 | Does iMessage to self arrive, and can it be read back? | Send a nonce, then find it in `chat.db` as delivered (Full Disk Access) and on Alex's phone | Telegram (S4) becomes the primary channel |
| S4 | *(only if S3 fails)* Telegram bot | A long-polling bot. A tap is accepted only when `from.id` and `chat.id` are Alex's | Email to self, notify-only |
| S5 | Gmail token in "In production" mode lasts more than 7 days | Still valid on day 8. Test that `invalid_grant` raises an alert | A weekly re-auth reminder |
| S6 | MacBook, lid open on the charger, stays awake and catches up | Run overnight under `caffeinate -is`. The poller cursor picks up mail sent during a forced 10-minute sleep. Check timer behavior after wake | Change the overnight rule with Alex |

## Module 1 — Lead replies

### 1.1 Send gate (`src/automation/send-gate.ts`, a pure function)
- **Signature:** `evaluateSendGate(input: SendGateInput): SendGateResult`. Hold reasons are a
  typed union, and a hold can't be built without at least one reason.
- **`routeLead()`:** `src/automation/router.ts:32` becomes a thin caller of the gate, so there is
  **one** gate (TypeScript review #2).
- **Allowlist by slots (security H1):**
  - The draft carries `{{PRICE}}` and `{{DATE}}` slots that code fills from `rates.ts` and the
    parsed lead.
  - After normalizing the text (NFKC, zero-width characters removed, words lowercased),
    **anything outside the slots** causes a HOLD if it contains:
    - a digit, number word, currency word, month or weekday
    - `@`, "dot", a domain ending, or a social-platform name
  - This closes "twelve hundred", "the 14th", "six one nine" and "gmail dot com".
- **Further HOLDs:** a channel that doesn't allow auto-send (Yelp, and Chrome until S2b passes),
  a quote above $3,000, flagged concerns, a failed verify, a Graceful Decline response, a new
  format family, **lead text containing instructions or links** (feasibility §8.3),
  `ramp_review_only`, or no runtime lease.
- **"First contact" is deliberately NOT a hold.** Every lead is a first contact, so holding on it
  would turn auto-send off completely.
- **The LLM judge** can only add hold reasons, never remove them.
- **Money:** `rates.ts` stays in dollars. A single `toCents()` at the gate boundary throws on
  bad input.

### 1.2 Exactly-once outbound (`outbound_messages`)
- **Columns:** `idempotency_key UNIQUE`, `channel`, `lead_id`, `draft_hash`, and `status` with
  the values `intent | sent | unknown | failed`.
- **Send order:** write the intent in a transaction → send with Message-ID
  `<gl-{key}@alexguillenmusic>` → mark it sent.
- **On restart:** look up each leftover `intent` in Gmail Sent by that Message-ID.
- **Chrome sends** go to `unknown`, which holds the lead and alerts Alex. **They are never retried
  automatically.**

### 1.3 Statuses and the single completion path
- **New lead statuses** (via the 0.4 migration runner): `awaiting_approval` and `client_sent`,
  replacing the overloaded `sent`.
- **One completion function** handles auto-sends and approved sends the same way, with an atomic
  status change, so follow-ups are never skipped (`learnings.md` P0 #1–2).
- **Approving sends to the client.** Today it only texts Alex.

### 1.4 Approvals
- **Single-use and tied to the exact draft:**
  `UPDATE … SET status='sending' WHERE id=? AND status='awaiting_approval' AND draft_hash=?`.
  A stale or repeated tap can't send an edited or regenerated draft.
- **iMessage replies** count as approvals only when `is_from_me=1` in Alex's self-chat. Text
  from anyone else is never an approval.
- **A timeout means don't send.**

### 1.5 Channels
| Source | Path |
|---|---|
| Email / website form | Gmail API reply, with gate-controlled auto-send |
| GigSalad | Email reply to the notification (after S2), with gate-controlled auto-send. Chrome only as the S2b fallback (plan-then-execute; the agent never sees lead text) |
| Yelp | Draft, then Alex approves and sends. The reply discloses the AI use. Never auto-sent |
| Texts and calls | Alex forwards them to the hub's address; they're drafted and Alex sends. No iMessage reading (delayed) |

### 1.6 `claude -p` provider (`src/claude-cli.ts`)
- **Interface:** keeps the `callClaude` / `callClaudeText` signatures. A `ClaudeTextRunner`
  replaces the SDK test seam.
- **Lockdown flags:**
  - no tools for drafting (exact flag name confirmed in S1)
  - `--strict-mcp-config` with an empty config
  - `--setting-sources project`
  - an empty temp directory as the working directory
  - JSON output only, parsed by code
  - **never `--dangerously-skip-permissions` or `--bare`**
- **Process control:**
  - a timeout of about 180 seconds, then the whole process group is killed
  - one lane at a time
  - a run that hits the usage limit (exit 1) holds the lead and alerts Alex, and is not retried
  - **usage credits stay OFF.** With credits on, billing continues past the limit
    (`claude-headless.md`)
- **Preflight:** a run where `apiKeySource` isn't `none` throws `ApiKeyInUseError`. There is no
  fallback.
- **SDK:** the `@anthropic-ai/sdk` default is removed only after S1 passes.

### 1.7 Ramp, clock, alerts
- **20-lead review-only ramp.** `ramp_review_only` is a gate input. Every would-AUTO decision is
  logged. Auto-send turns on per channel only after Alex has reviewed the log and every would-AUTO
  draft was sent by him unedited. One disagreement means the gate gets fixed first.
- **Reply clock:** one clock, for GigSalad, since only GigSalad has a rule. When Alex replies in
  the thread, the bot stops for that lead.
- **Alerts:** iMessage to self with read-back. An alert that cannot be delivered becomes
  `ALERT FAILED` in the daily digest email to Alex, worded differently from a sent alert.
- **Heartbeat:** the app pings an outside heartbeat monitor every 5 minutes. When pings stop, the
  monitor alerts Alex.

## Acceptance Tests

Every Verify line uses `npm run test:match -- "<name>"`, which **fails if no test matches**
(0.1).

### Happy path
- WHEN a fixture email lead's slot-filled draft passes every gate check, the ramp is complete and the host holds the lease THE SYSTEM SHALL send it once through the completion function and set exactly one follow-up schedule
  - Verify: `npm run test:match -- "gate auto sends once"`
- WHEN Alex approves an `awaiting_approval` draft whose hash matches THE SYSTEM SHALL deliver it to the client channel and mark it `client_sent`
  - Verify: `npm run test:match -- "approve sends to client"`
- WHEN the context is assembled for a fixture lead THE SYSTEM SHALL contain every marker listed in `port-manifest.md`
  - Verify: `npm run test:match -- "port manifest loaded"`
- WHEN the app starts a `claude -p` drafting run THE SYSTEM SHALL record `apiKeySource: none` and an empty tool list in that run's log entry
  - Verify: `npm run test:match -- "provider preflight none"`
- WHEN the Mac wakes after more than 2 minutes asleep THE SYSTEM SHALL poll Gmail from the stored cursor and run the scheduler immediately
  - Verify: `npm run test:match -- "wake catch-up"`
- WHEN the test instrument is given an existing test name THE SYSTEM SHALL report at least one match and exit 0
  - Verify: `npm run test:match -- "allows Basic Auth POSTs"` exits 0

### Error cases
- WHEN the test instrument is given a name no test has THE SYSTEM SHALL exit non-zero
  - Verify: `npm run test:match -- "zz-no-such-test"; echo $?` → non-zero
- WHEN a draft contains a number, number word, date word or contact-like token outside the slots (fixture corpus: "twelve hundred", "the 14th", "six one nine", "gmail dot com", zero-width characters, full-width digits) THE SYSTEM SHALL HOLD it with the matching reason
  - Verify: `npm run test:match -- "gate bypass corpus"`
- WHEN lead text contains instructions or links THE SYSTEM SHALL HOLD it with `untrusted_instructions`
  - Verify: `npm run test:match -- "injection holds"`
- WHEN a lead comes from Yelp THE SYSTEM SHALL HOLD it for Alex's approval regardless of the gate result
  - Verify: `npm run test:match -- "yelp holds"`
- WHEN the auto-send path runs a lead THE SYSTEM SHALL pass that lead's platform into `runPipeline`
  - Verify: `npm run test:match -- "orchestrator passes platform"` (fails on `main`, passes after the fix)
- WHEN an email shows `dkim=pass` from a domain other than the allow-listed sender, or has a spoofed display name THE SYSTEM SHALL reject it as a lead source
  - Verify: `npm run test:match -- "forged sender rejected"`
- WHEN the app starts without `DASHBOARD_USER`, `DASHBOARD_PASS` or `COOKIE_SECRET` THE SYSTEM SHALL refuse to start, and it SHALL listen on 127.0.0.1 only
  - Verify: `npm run test:match -- "refuses start without creds"`; `lsof -iTCP:${PORT:-3000} -sTCP:LISTEN` shows `127.0.0.1`
- WHEN a host without the runtime lease tries to send THE SYSTEM SHALL refuse and alert
  - Verify: `npm run test:match -- "lease blocks second host"`
- WHEN the process crashes after the send intent is written THE SYSTEM SHALL, on restart, find the message in Gmail Sent by Message-ID or mark it `unknown`, and never send twice
  - Verify: `npm run test:match -- "crash after intent"`
- WHEN an approval arrives for a draft hash that no longer matches, or arrives a second time THE SYSTEM SHALL send nothing
  - Verify: `npm run test:match -- "stale approval ignored"`
- WHEN an iMessage reply that is not from Alex (`is_from_me=0`) says YES THE SYSTEM SHALL not treat it as an approval
  - Verify: `npm run test:match -- "only alex approves"`
- WHEN `claude -p` reports an `apiKeySource` other than `none`, or hits the usage limit THE SYSTEM SHALL hold the lead, alert Alex, and not retry
  - Verify: `npm run test:match -- "provider refuses api key"`; `npm run test:match -- "usage limit holds"`
- WHEN the Gmail token returns `invalid_grant` THE SYSTEM SHALL alert Alex and report `poller.auth: failed` on `/health`
  - Verify: `npm run test:match -- "invalid_grant alerts"`; `curl -s -u $DASHBOARD_USER:$DASHBOARD_PASS localhost:${PORT:-3000}/health | jq .poller.auth`
- WHEN the poller restarts after an 8-hour gap THE SYSTEM SHALL read every lead email from that gap
  - Verify: `npm run test:match -- "poller gap recovery"`
- WHEN a migration runs THE SYSTEM SHALL write `data/backups/pre-vN.db` first, and SHALL refuse to start against a DB newer than its code
  - Verify: `npm run test:match -- "migration backup and guard"`
- WHEN an alert cannot be confirmed as delivered THE SYSTEM SHALL list it as `ALERT FAILED` in the digest
  - Verify: `npm run test:match -- "alert failed in digest"`

### Spikes (manual, Phase 0.7)
- WHEN each spike S1–S6 is run THE SYSTEM SHALL produce the known answer in its table row
  - Verify: `spikes.md` has a PASS or FAIL row for each spike, with evidence (pasted output, a nonce, or a screenshot path) and the date

### Verification commands
- `npx tsc --noEmit` → exit 0
- `npm test` → all pass; report the count (351 today)
- `npm run test:match -- "zz-no-such-test"` → non-zero (the instrument works)
- `npm run plan:check docs/plans/2026-10-02-feat-hub-phase0-lead-replies-plan.md` → `manual_only` (checked on 2026-10-02 that this command can report `invalid`)

## Execution Path

- **Target:** Alex's MacBook, lid open on the charger at night. Alerts go to Alex's iPhone via
  iMessage. The dashboard is Mac-only in Module 1.
- **Mechanism:** a Terminal `.command` login item running
  `cd ~/Projects/gig-lead-responder && while true; do PORT=3000 caffeinate -is npm start; sleep 5; done`.
  It uses port 3000, not 5000, binds to 127.0.0.1, and is not a LaunchAgent, because a Node
  LaunchAgent was denied Full Disk Access on macOS 26.2. `claude -p` runs are started by the app
  with `env -u ANTHROPIC_API_KEY` and the lockdown flags.
- **Prerequisites:**

  | Item | Status |
  |---|---|
  | Claude Max subscription, usage credits OFF | ALREADY HAVE |
  | Gmail OAuth client | ALREADY HAVE; S5 moves it to "In production" |
  | GigSalad and Yelp accounts | ALREADY HAVE |
  | Railway project (for the read-only check + cutover) | ALREADY HAVE |
  | Full Disk Access for Terminal | MUST OBTAIN (verified need: S3 read-back). Alex grants it in System Settings |
  | Heartbeat monitor, e.g. healthchecks.io free tier | MUST OBTAIN (verified need: a dead Mac can't report itself, per the architecture review) |
  | Telegram bot | MUST OBTAIN only if S3 fails (S4) |
  | Chrome profile used only for GigSalad | MUST OBTAIN only if S2 fails (S2b) |
- **Who:**
  - **Claude Code** builds, runs tests, and runs S1 and S5.
  - **Alex:**
    - grants Full Disk Access
    - approves each cutover step
    - performs the S2 send
    - confirms S2b, S3 and S6
    - answers the 0.5 questions
    - reviews the 20-lead ramp log
- **Trigger:**
  - Phase 0 runs top to bottom, with 0.1 first.
  - Module 1 code starts after S1, S2 (or S2b) and S3 (or S4) pass.
  - Module 1 goes live in review-only mode the day its tests pass.
  - Auto-send turns on per channel after the 20-lead review.

## Plan Quality Gate

1. **What is changing?**
   - Phase 0: the test instrument, the single-writer cutover to the MacBook, 8 live defects, a
     migration runner, the Project port, the baseline, and the spikes.
   - Module 1: the send gate, exactly-once outbound, new statuses, approvals that send, channels,
     the `claude -p` provider, the ramp and alerts.
2. **What must not change?**
   - The voice and pricing method (ported, not rewritten).
   - No contact info on GigSalad.
   - Yelp is never auto-sent.
   - Nothing reaches a client before the ramp is signed off, except Alex's own approved sends.
   - No API-key billing; usage credits stay off.
   - No production DB write and no Railway shutdown without Alex's yes.
   - The production DB is copied to `/tmp` before inspection.
3. **How will we know it worked?**
   - The EARS tests above, through an instrument that fails on a non-match.
   - The S1–S6 rows in `spikes.md`.
   - Reply speed and win rate against the 0.6 baseline (roadmap).
4. **Most likely way this plan is wrong:** the MacBook doesn't stay reliably awake and reachable
   at night (lid, OS restarts waiting at the FileVault login screen), so night leads sit
   unanswered. S6 and the heartbeat catch this. The fallback is a small always-on host for the
   poller and drafting. **Second:** GigSalad's email reply doesn't land on the platform. S2 catches
   it, and the fallback is S2b.
5. **How will a human RUN this, and when?** See Execution Path.

## Alternative Approaches Considered

- **Keeping Railway as a second poller during cutover.** Rejected: two pollers on one inbox would
  send double replies (data-integrity P0 #1).
- **A separate helper process for macOS jobs.** Rejected unless S3 proves it is needed. The app
  started from Terminal inherits Full Disk Access (simplicity and architecture reviews).
- **Telegram or Tailscale up front.** Rejected: Telegram is built only if S3 fails, and the phone
  dashboard waits until Alex asks for it.
- **An LLM confidence score as the gate.** Rejected: judges are overconfident, and OWASP LLM01
  says to check outputs with code.
- **"First contact" as a hold.** Rejected: it would disable auto-send entirely.

## System-Wide Impact

- **What a send triggers, in order:**
  1. The gate runs.
  2. The lease is checked.
  3. The `outbound_messages` intent is written.
  4. The message goes out through Gmail (or the Chrome fallback).
  5. The row is marked sent.
  6. The single completion function runs, with an atomic status change.
  7. The follow-up schedule is set.
  8. The reply clock stops.
- **Failures:**
  - Every outside call has a timeout.
  - `invalid_grant` raises an alert.
  - A Chrome step whose outcome is unknown is held and Alex is alerted.
  - An undeliverable alert appears as ALERT FAILED in the digest.
  - **No silent fallbacks.**
- **State:**
  - A crash between the intent and the send is settled by a Message-ID lookup.
  - A second host is blocked by the lease.
  - A stale approval is blocked by the draft hash.

## Sources & References

- **Origin:** `docs/brainstorms/2026-10-02-booking-hub-brainstorm.md`
- **Roadmap:** `docs/plans/2026-10-02-booking-hub-roadmap.md`
- **Research:** `docs/research/2026-10-02-booking-hub/`, with the deepen reports in `deepen/`
- **Code:**
  - `src/automation/orchestrator.ts:~130`
  - `src/run-pipeline.ts:87`
  - `src/automation/router.ts:32`
  - `src/automation/source-validator.ts:79-84`
  - `src/server.ts:42-43`
  - `src/auth.ts`
  - `src/app.ts:26`
  - `src/automation/poller.ts:75`
  - `src/follow-up-scheduler.ts:7`
  - `src/db/migrate.ts`
  - `src/data/rates.ts`
  - `src/claude.ts`
- **Alex's artifacts:**
  - `~/.claude/docs/contract-and-payment-process.md`
  - the Project extraction (to be moved into `~/Data/`)

## Automation Contract

```json
{
  "auto_work_candidate": false,
  "human_signoff_required": true,
  "risk_level": "high",
  "allowed_paths": ["src/", "tests/", "scripts/", "docs/", "public/", "package.json", "package-lock.json", ".env.example", ".gitignore"],
  "forbidden_paths": [".env", "data/", "credentials.json", "logs/"],
  "source_of_truth": ["docs/plans/2026-10-02-booking-hub-roadmap.md", "docs/brainstorms/2026-10-02-booking-hub-brainstorm.md", "docs/research/2026-10-02-booking-hub/README.md"],
  "required_checks": ["npx tsc --noEmit", "npm test", "npm run test:match -- \"zz-no-such-test\" exits non-zero"],
  "stop_conditions": [
    "Any spike fails its known-answer test",
    "test:match reports a match for a name no test has",
    "A send path bypasses evaluateSendGate or outbound_messages",
    "A claude -p run reports apiKeySource other than none",
    "Any client-facing send before the 20-lead ramp is signed off, other than Alex's own approved sends",
    "Railway change, Railway shutdown, or production DB write without Alex's explicit yes"
  ],
  "linked_expectations": [
    {"files": ["src/automation/orchestrator.ts", "src/run-pipeline.ts"], "reason": "Platform must reach the pipeline on the auto-send path"},
    {"files": ["src/automation/router.ts", "src/automation/send-gate.ts"], "reason": "One gate: routeLead delegates to evaluateSendGate"},
    {"files": ["src/data/rates.ts", "src/automation/send-gate.ts"], "reason": "Slot prices come from the same rate table, converted once to cents"},
    {"files": ["src/automation/source-validator.ts"], "reason": "DMARC-aligned sender check gates both leads and (later) payments"}
  ]
}
```

## Codex Plan-Review Handoff

```
Work in /Users/alejandroguillen/Projects/gig-lead-responder, branch docs/booking-hub-brainstorm.
FIRST gate: pwd; git branch --show-current; git rev-parse docs/booking-hub-brainstorm; git status --short.
Expected: branch docs/booking-hub-brainstorm at its current tip; clean tree. Stop if either differs.
Read: HANDOFF.md, CLAUDE.md, AGENTS.md (if present), docs/brainstorms/2026-10-02-booking-hub-brainstorm.md,
docs/plans/2026-10-02-booking-hub-roadmap.md, docs/plans/2026-10-02-feat-hub-phase0-lead-replies-plan.md,
docs/research/2026-10-02-booking-hub/README.md (deepen reports in deepen/).

Plan review, ROUND 1 (no prior Codex verdicts exist). Review ONLY the Phase 0 + Module 1 plan; the roadmap is
context. Check gaps, wrong assumptions, scope creep vs the brainstorm and roadmap, the Feed-Forward
"least confident" item (MacBook-hosted runtime; GigSalad email reply landing on-platform), and the 5-question
Plan Quality Gate including the Execution Path. Specifically challenge:
(1) whether the slot-allowlist send gate is sufficient to auto-send a quote containing a price;
(2) the single-writer cutover (runtime lease, Railway DRY_RUN, sqlite .backup) — can two hosts still both send?;
(3) exactly-once outbound via outbound_messages + Message-ID lookup;
(4) the claude -p lockdown (flags, cwd, apiKeySource) — what can still leak tools or bill;
(5) whether test:match truly closes the "pattern matched nothing but exited 0" gap (verified 2026-10-02: npm test
with a bogus --test-name-pattern ran all 351 tests, exit 0);
(6) whether every Project rule in 0.5 has a landing place that actually loads at runtime.
If a finding is an instance of a class, say so and name the bounded surface to sweep.
Return findings by severity and a Claude Code fix prompt using the fix contract. Do not implement.
```

## Three Questions

1. **Hardest decision in this session?** Folding six reviews into one plan without losing Alex's
   choices. Where a reviewer contradicted Alex (GigSalad via Chrome, iMessage reading, one plan for
   everything), I asked him instead of applying the review. He chose email by default, delaying
   iMessage reading, and splitting the plan.
2. **What did you reject, and why?**
   - "First contact" as a hold: it would disable auto-send.
   - A separate helper process: Full Disk Access is inherited from Terminal.
   - Building Telegram and Tailscale up front.
   - Running every available reviewer.
   - Trusting `--test-name-pattern` as a verification command: it was verified to match nothing
     and still pass.
3. **Least confident about going into the next phase?** The MacBook as the host: whether it stays
   awake with the lid open on the charger, and what happens when an OS update restarts it to the
   FileVault login screen at 2 a.m. S6 and the heartbeat monitor detect this; neither prevents it.

## Feed-Forward

Same as `## Three Questions` above: hardest decision = Q1, rejected alternatives = Q2, least
confident = Q3.
