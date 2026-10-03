---
title: "feat: Booking hub (leads, gigs, money, contracts, COIs)"
type: feat
status: active
date: 2026-10-02
origin: docs/brainstorms/2026-10-02-booking-hub-brainstorm.md
feed_forward:
  risk: "Unattended Claude-in-Chrome replies inside GigSalad: reliability, and GigSalad's ban on bots/scripts"
  verify_first: true
---

# Booking Hub

### Prior Phase Risk

> **Brainstorm "Least confident about going into the next phase?":** "whether GigSalad, Yelp and
> The Bash allow automated portal replies, and whether Playwright logins survive their bot checks.
> If not, auto-send shrinks to email/form leads and the portals get "draft + one-tap approve."
> Second: reading iMessages needs Full Disk Access on the server Mac, and macOS privacy rules have
> blocked reads before."

Research settled most of this, and the answer changed the design (see *Changes since the
brainstorm*). **The Bash** bans robots and has no email reply, so it is deferred; Alex is not a
member right now. **Yelp** allows AI replies only if a human reviews them and the AI use is
disclosed, so Yelp is approve-only and never auto-sent. **GigSalad**'s terms ban bots and scripts
(per a search summary; the terms page itself was blocked). Alex chose on-platform replies through
Claude in Chrome anyway, and the plan carries that as a named, accepted risk with a fallback. Full
Disk Access is spike S3 in Phase 0, tested against a known answer before any module depends on it.

---

## Overview

Grow gig-lead-responder into one system Alex owns, covering five areas:
- lead replies
- gigs with all their people
- reminders, so nothing is forgotten
- contracts, invoices and payment tracking
- COIs and venue logistics

The system runs on Alex's always-on Mac and drafts with his Claude Max subscription. It reuses the
existing pipeline and his existing skills and templates. It replaces the manual chain: the
claude.ai Project, Jotform, Asana, PDFs and memory.

All four modules are in one plan (Alex's choice). They are built in order, and **each module ships
and runs on real work before the next starts** (see brainstorm: Key Decisions 2).

## Problem Statement

Taken from the brainstorm:

1. **Slow replies lose gigs.** GigSalad's own figure: replying within an hour gives a "25% better
   chance of booking" (`docs/research/2026-10-02-booking-hub/crm-general-ai.md`).
2. **Things get forgotten.** In the Dannecker case the gig was off the calendar for 4 weeks and the
   signed PDF was missed.
3. **Money admin is manual.** Payments come through 4 rails and are checked by hand.
4. **Many people per gig.** A couple, a planner and a venue, with different requirements at each
   venue.

What the research added:
- **No commercial tool** imports marketplace leads, reconciles Venmo or Zelle, or tracks venue
  COIs (`crm-service-business.md`, `crm-entertainment.md`). Those three gaps are why building
  makes sense.

What the repo research added (`repo.md`):
- **Approving never sends anything to a client today.**
- **The auto-send path drops the lead's platform** (`src/automation/orchestrator.ts:130`). The
  GigSalad no-contact-info rules therefore never run on the one path that can send to GigSalad.
- **"Confidence" measures how much analysis ran, not whether a reply is safe.**
- **Nothing in code checks the price written in a draft.**
- **The only tables are lead tables.** There are no gigs, contacts, payments or documents.

## Changes since the brainstorm

All of these come from the research and Alex's answers on 2026-10-02.

| Brainstorm said | Now | Why |
|---|---|---|
| Hosted on Railway or an old Mac | **Alex's daily Mac**, which is on about 95% of the time | Alex: "Everything could be done through my Mac." iMessage and the browser live there. The old-Mac plan was never carried out (`repo.md`). |
| Texts for approvals (Twilio) | **iMessage to self, plus a Telegram bot as fallback** | Alex: "We've tried Twilio before and that never really worked." Unregistered 10DLC sends are blocked even to your own number (`feasibility.md` §2). |
| Playwright portal replies | **GigSalad: Claude in Chrome, on-platform. Yelp: approve-only. The Bash: deferred.** | Alex's choice for GigSalad. Yelp requires human review and disclosure. The Bash bans robots, and Alex isn't a member. |
| Anthropic API key | **Claude Max subscription through `claude -p`** | Alex chose this. Every run checks first that no API key is in use (memory: never pay usage credits). |
| EventHelper COI per event | **Annual policy Alex already has.** The app prepares the COI and Alex approves sending it. | Alex: "I already have the annual policy." |
| Balance due on the day | **One week before for music performances, on the day for corporate**, with the full money terms | `~/.claude/docs/contract-and-payment-process.md`. The brainstorm was corrected in `f23c9c3`. |
| (not known) | **GigSalad payments follow a mixed path**: in-platform by default, direct when the client shares contact details. **Never ask for or share contact info on GigSalad.** | Alex, 2026-10-02. GigSalad bans off-platform payment on unmarked leads, with three strikes before removal (`crm-entertainment.md`). |

## Proposed Solution

### Shape

- **One process on the Mac**, the existing Node/Express app. It holds the pipeline, scheduler,
  SQLite and the dashboard.
- **Plus a small helper** for the jobs only macOS can do:
  - reading iMessages from `chat.db`
  - sending iMessage to self
  - Claude Code runs that drive Chrome
- The helper is started from a Terminal `.command` login item, not a LaunchAgent. A Node
  LaunchAgent did not get Full Disk Access on macOS 26.2 (`feasibility.md` §3); spike S3 confirms
  this.

### Request flow

```
lead email ─► Gmail poller ─► pipeline (claude -p, Max) ─► SEND GATE (code)
                                                     ├─ PASS + channel allows auto ─► send ─► same completion path as manual
                                                     └─ HOLD ─► iMessage/Telegram to Alex ─► approve/edit ─► send
deposit seen (email / iMessage / Square) ─► match to gig ─► Alex 1-tap confirm ─► gig.confirmed
     └─► calendar event (idempotent) ─► reminder schedule (balance, music call, logistics, post-gig)
```

### Data model (new tables, existing `initDb()` style)

```mermaid
erDiagram
  leads ||--o| gigs : "becomes"
  gigs ||--o{ gig_contacts : has
  contacts ||--o{ gig_contacts : "plays role in"
  venues ||--o{ gigs : hosts
  gigs ||--o{ payments : receives
  gigs ||--o{ documents : has
  gigs ||--o{ reminders : schedules
  gigs { int id; int lead_id; text status; text booking_channel; date event_date; int total_cents; text calendar_event_id }
  contacts { int id; text name; text email; text phone; text client_type }
  gig_contacts { int gig_id; int contact_id; text role }
  venues { int id; text name; text address; int coi_required; int license_required; text logistics_notes }
  payments { int id; int gig_id; text rail; int amount_cents; text source_ref; text status; text confirmed_at }
  documents { int id; int gig_id; text kind; text path; text status }
  reminders { int id; int gig_id; text kind; text due_at; text next_run_at; text status }
```

**Field values:**
- `gigs.status`: inquiry → quoted → contracted → deposit_paid → balance_paid → played → closed / lost
- `gigs.booking_channel`: `direct` | `gigsalad_platform`
- `contacts.client_type`: corporate | private | couple | planner | venue
- `payments.rail`: square | venmo | zelle | check | gigsalad
- `payments.status`: detected → confirmed | rejected
- `documents.kind`: contract | invoice | coi | license | w9

### What we borrow, and the traps we avoid

These come from the research reports.

**Borrow:**
- AI drafts the reply and Alex approves it with one tap.
- A two-lane send gate. A code-checked lane auto-sends; everything else is held for Alex.
- A reply-time clock for each platform, set to that platform's own rule. GigSalad Top Performer
  needs 80% of leads answered within 24 hours.
- Payment rules tied to the event date and stored on the template (Dubsado).
- A "Record payment" action that stores the method and who paid (VSCO).
- Fixed reminder points rather than a workflow builder.
- Must-play / play-if-possible / do-not-play lists, and locking the questionnaire before the event
  (Vibo, DJ Intelligence).
- A per-gig logistics sheet (Gigwell).
- A "who owes what, by event date" view, the report HoneyBook users say they can't get.
- The bot stops the moment Alex replies in a thread.

**Avoid:**
- A general workflow builder. Dubsado takes 15–25 hours to set up, which is HoneyBook's "too
  complicated" failure.
- Treating off-platform payments as second-class.
- Auto-sent replies that commit to an unchecked price or date.
- Client logins.
- Calendar sync that lags.

## Technical Approach: Implementation Phases

Each item is a commit-sized unit (about 50–100 lines, one concern). **Every module ends with Alex
running it on real work** (see Execution Path).

### Phase 0 — Foundations, truth checks, decisions (no new features)

**0.1 Production truth (read-only).**
- Is the Railway poller actually running? Check the Railway logs.
- Which Gmail account does the token belong to?
- What are the values of `AUTO_SEND_ENABLED` and `DRY_RUN`?
- Then shut Railway down only after the Mac runtime passes 0.5. *Shutting it down needs Alex's
  explicit yes (it is destructive).*

**0.2 Fix the known defects.** Each one gets a failing regression test first.
- Platform dropped on the auto-send path (`orchestrator.ts:130`). **This is a new P1 that blocks
  auto-send.**
- SMS deep links to `/leads` (todo 020). These are superseded once alerts move off SMS. Fix them
  or remove them.
- Travel fee always misses because `data/zip_distances.json` is never deployed (todo 020).
- `/health` cannot tell "poller never started" from "healthy" (todo 020). Report the poller's last
  successful poll and its auth state.
- Hygiene: a README, the pm2 config pointing at a missing file, and the unmerged eslint branch.

**0.3 Lead Responder port (Project → repo).** Map every rule to where it will actually load:
- a **loaded doc** (`src/pipeline/context.ts`)
- a **prompt builder** (`src/prompts/*.ts`)
- **`src/data/rates.ts`**

A rule added to a doc that never loads does nothing (`repo.md` finding 5). The rules to port:
- the Graceful Decline pattern and its 5 gate checks
- the competition-count rule
- R1–R3 residency tiers
- T4 and nonprofit pricing (currently only in Project memory)
- the guitar/ukulele delivery-mode rule
- the LEAD_RESPONSE_VOICE kill list and banned patterns, as code checks wherever they can be
  mechanical
- VENUE_INTEL
- EVENT_STRUCTURE_THEORY
- the T4 reference lead

The source is `~/Desktop/Gig_Lead_Response_System_4.0_Extraction.md`, plus
`~/Desktop/Rate_Card_Solo_Duo.md` for file 6. **Move both into `~/Data/`** before the port; they
hold rates and a real client lead and do not go in the repo.

**Questions for Alex, asked one at a time during 0.3:**
- **(a) Trio/Ensemble rate card.** The repo has old B2B residency tables (Apr 7). The Project
  deliberately removed them on Apr 26 ("residency framework applies to solo Alex only"). The
  recommendation is to adopt the Project's version. None of these tables reach a live quote today.
- **(b) Battery-powered sound.** The rule "never mention battery-powered sound" contradicts some
  file passages. Which wins?
- **(c) Missing files.** `AUTHENTICITY_SCREEN.md` and `FOLLOW_UP.md` are referenced but don't
  exist. Do they exist anywhere, or should the references be dropped?

**0.4 Win-rate baseline (read-only).** From both Gmail accounts, the GigSalad dashboard and
Google Calendar, count inquiries → booked for the last 12 months, per platform. Write it to
`docs/research/2026-10-02-booking-hub/baseline.md`. It is the "before" number for success
measure #1. The local DB has 0 recorded outcomes, so it cannot serve as the baseline.

**0.5 Spikes.** Each spike is a yes/no question checked against a known answer. One that fails
changes the plan before any module depends on it.

| # | Question | Known-answer test | If NO |
|---|---|---|---|
| S1 | Can a background process run `claude -p` on Max with `apiKeySource == none`? | Run it on a fixture lead with `env -u ANTHROPIC_API_KEY`; the preflight prints `none` | Stop and ask Alex. Never fall back to the API key silently. |
| S2 | Can an unattended Claude Code run drive Chrome (Claude in Chrome) to open a GigSalad lead and **fill, not send**, a reply? | One real lead; the screenshot shows the filled box; Alex confirms | GigSalad drops to draft + alert, and Alex pastes the reply |
| S3 | Can the helper read `chat.db` (Full Disk Access) and decode `attributedBody`? | Read back a message Alex sends himself with a known string | Payments come from email only; text leads are forwarded by Alex |
| S4 | Does iMessage-to-self actually arrive? | Send a nonce, then read it back from `chat.db` and from Alex's phone | Telegram becomes primary |
| S5 | Telegram bot with approve/edit/reject buttons | Round trip on a fixture draft | Pushover ($4.99 once), notify-only |
| S6 | Does the Gmail OAuth app in "In production" mode stop the 7-day token expiry? | Token still valid on day 8. `invalid_grant` must fire an alert, never read as "no mail". | Weekly re-auth reminder |
| S7 | Phone access to the dashboard (e.g. Tailscale, free) | Open the dashboard on the phone over cellular | Alerts only; the dashboard stays Mac-only |

### Phase 1 — Module 1: Lead replies

1. **Send gate in code** (`src/automation/send-gate.ts`). It replaces confidence as the deciding
   signal; the LLM judge can only add reasons to hold.
   - **AUTO only if all of these pass:**
     - the platform is known
     - the channel allows auto-send (email/form: yes; GigSalad: yes after S2; Yelp: never)
     - every price in the draft equals the `rates.ts` quote and is at or above the floor
     - every date in the draft equals the lead's date
     - no contact info appears on GigSalad, and none is asked for (code check, not prompt)
     - no new format family
     - the quote is at or under $3,000
     - no flagged concerns
     - verify passed
     - not a Graceful Decline response
     - no contract or deposit wording beyond the standard quote
   - **Anything else is HELD** for Alex.
2. **Review-only ramp.** For the first **20 real leads**, the gate records what it *would* do and
   Alex approves everything. Auto-send turns on only after Alex reviews that record: every
   would-AUTO draft must be one he sent unedited. A single disagreement means the gate is fixed
   first.
3. **Approval actually sends.** Every send goes through one completion function with an atomic
   status change. Auto-sent and manually approved leads take the identical path, so follow-ups
   are never skipped (`learnings.md` P0 #1–2).
4. **Channels:**
   - Gmail reply for email and form leads.
   - Claude in Chrome on GigSalad (after S2).
   - Yelp is drafted, then approved by Alex in Yelp. The reply discloses the AI use, which Yelp
     requires.
   - Text and call leads: the helper captures them from iMessage, or Alex forwards them. The app
     drafts and Alex sends.
5. **Alerts:** iMessage to self with read-back, falling back to Telegram (S4/S5). An alert that
   cannot be delivered is reported differently from one that was sent (`feasibility.md`).
6. **Reply clock for each platform**, plus quiet hours. The bot stops when Alex replies in the
   thread.
7. **Provider swap:** `src/claude.ts` runs `claude -p` on Max behind the existing interface, with
   the S1 preflight on every run.

### Phase 2 — Module 2: Nothing forgotten

1. **Tables:** `gigs`, `contacts`, `gig_contacts` (with a role), `venues`, `reminders`. A lead
   marked booked creates a gig and attaches its contacts.
2. **The deposit confirmation is the trigger.** It creates the GIG Calendar event once (the event
   id is stored, so it is never duplicated) and starts the reminder schedule.
3. **Reminders.** `next_run_at` is computed inside the transaction (`learnings.md` scheduler
   gotcha).
   - **Balance due:** music performances at 7 days before (client) and on the due date (Alex);
     corporate on the day.
   - **Music call:** a booking link plus the questionnaire, reusing the `wedding-questionnaire`
     Jotform and skills. The questionnaire locks a set number of days before the event.
   - **Logistics check** at 14 and 7 days out: load-in, parking, power, on-site contact, COI
     needed.
   - **Post-gig:** thank-you, review request (GigSalad, Yelp or Google), and an outcome prompt.
4. **Daily digest to Alex:** what's due today, who owes what by event date, unanswered leads, and
   any reminder whose run failed.
5. **Backfill:** import booked gigs already on the GIG Calendar (Dannecker, Pagnini,
   Hilton-Schmitt, Satsang House). Alex reviews the import before it is saved.

### Phase 3 — Module 3: Contracts, invoices, payments

1. **Contract.** Fill the Performance Agreement template (from the Pagnini `.docx` and the Lee &
   Associates PDF) with gig data. Alex's signature is applied from a local image, kept outside the
   repo. The draft is sent only after Alex approves it.
   - A **workshop variant** adds the IP, recording, not-legal-advice and scope clauses
     (`contract-and-payment-process.md`).
2. **Invoice.** Reuse the `booking-to-invoice` skill's layout.
   - A 50% non-refundable retainer, due on signing.
   - A balance schedule by client type.
   - Card payment adds 3.75%, itemized.
   - Checks payable to **Alejandro Guillen**.
   - A W-9 is attached for corporate clients.
   - Never a booking without a deposit.
   - **The invoice goes out with the contract**, not after it.
3. **Signed-return detection.** A PDF coming back in the thread sets the contract to
   `returned_unverified`, and Alex gets "Signed copy back from X, confirm?" with the file. This is
   the Dannecker fix: the attachment is checked and surfaced, never assumed missing.
   - An e-sign service is deferred; the trigger to revisit it is two missed or forged returns.
4. **Payment matching.**
   - **Square:** card clients only. The Square API is polled from the Mac because webhooks can't
     reach it.
   - **Venmo, Zelle and bank emails:** the sender is checked (DKIM plus the domain allowlist).
   - **Bank texts in iMessage:** via S3.
   - Each detected payment is matched by amount, name and the open gig. Alex confirms it with one
     tap; nothing is marked paid without that confirmation.
   - **GigSalad-platform gigs** get a `gigsalad_platform` channel: no off-platform invoice is
     sent, and the payment is recorded from GigSalad's notices. Alex can switch a gig to `direct`
     when the client has shared contact details.

### Phase 4 — Module 4: COIs and logistics

1. **Venue record:** COI required, license required, logistics notes and contacts, built up as
   gigs happen. Seeded from VENUE_INTEL.
2. **COI:** when a venue requires one, the app prepares the additional-insured details, and Claude
   in Chrome fills them in the annual-policy portal. Alex approves before anything is downloaded
   or sent to the venue. The PDF is stored in `documents`.
3. **License requests** are tracked as a document need with a reminder. There is no automation,
   because they are rare.

### Not building (YAGNI)

- multi-user or tenancy
- a client login portal
- a workflow builder
- The Bash, until Alex rejoins
- social DMs
- an e-sign service
- workshop teaching material

## Alternative Approaches Considered

- **Buy a CRM.** Rejected by Alex. HoneyBook costs $29–$129/mo today and nothing integrates
  Venmo or Zelle (`crm-service-business.md`).
- **A new hub app (B) or Claude Code alone (C).** Rejected in the brainstorm.
- **Playwright bots on marketplaces.** Replaced: GigSalad gets Claude in Chrome by Alex's choice,
  and The Bash and Yelp are off auto.
- **Twilio SMS.** Replaced, for the 10DLC reason and Alex's experience with it.
- **An LLM confidence score as the gate.** Rejected. Judges are overconfident, and OWASP LLM01
  says to check outputs with code (`feasibility.md` §8).

## System-Wide Impact

**What a send triggers, in order:**
1. The send gate runs.
2. The message goes out through Gmail or the browser.
3. The single completion function runs.
4. The lead's status changes, atomically.
5. The follow-up schedule is set.
6. The reply clock stops.

The deposit confirmation follows the same pattern: gig status, then the calendar event, then the
reminders.

**Error propagation:**
- Every outside call has a timeout (`learnings.md` P0 #3).
- A Gmail `invalid_grant` raises an alert.
- A Chrome step that fails holds the lead and alerts Alex.
- An undeliverable alert falls back to Telegram, then appears in the digest as "ALERT FAILED".
- No silent fallbacks.

**State risks:**
- A crash after the send but before completion could send twice. Prevented by an idempotency key
  on (lead, channel) checked before sending.
- A duplicate calendar event. Prevented by the stored event id.
- A payment matched to the wrong gig. Prevented because Alex confirms every match.

**Integration test scenarios:**
1. A GigSalad lead whose text contains a phone number produces no contact info in the draft, and
   the gate HOLDS it if any slips in.
2. A draft priced $50 under the floor is HELD.
3. A forged "Venmo" email from a non-Venmo domain is rejected and never matched.
4. Confirming a deposit twice creates one calendar event.
5. A signed PDF arriving in an old thread is surfaced, not missed (Dannecker replay).

## Acceptance Tests

### Happy path
- WHEN a fixture GigSalad lead's draft passes every send-gate check AND auto-send is enabled THE SYSTEM SHALL send it through the completion function and set exactly one follow-up schedule
  - Verify: `npm test -- --test-name-pattern="send-gate auto"` passes
- WHEN Alex approves a held draft THE SYSTEM SHALL deliver it to the client channel (not only to Alex)
  - Verify: `npm test -- --test-name-pattern="approve sends to client"` passes
- WHEN a deposit payment is confirmed THE SYSTEM SHALL create one GIG Calendar event and the reminder rows for that client type
  - Verify: `npm test -- --test-name-pattern="deposit triggers calendar"` passes; `sqlite3 data/leads.db "select count(*) from reminders where gig_id=<fixture>"` returns the expected count
- WHEN a contract PDF attachment arrives in a gig's thread THE SYSTEM SHALL set the contract to `returned_unverified` and alert Alex within one poll cycle
  - Verify: `npm test -- --test-name-pattern="signed return detected"` (Dannecker fixture) passes
- WHEN a Venmo or bank email from an allow-listed, DKIM-passing sender matches an open gig's amount and name THE SYSTEM SHALL propose the match to Alex and mark nothing paid until he confirms
  - Verify: `npm test -- --test-name-pattern="payment match proposes"` passes
- WHEN a music-performance gig is 7 days from its date with a balance open THE SYSTEM SHALL send the client balance reminder once
  - Verify: `npm test -- --test-name-pattern="balance reminder music"` passes
- WHEN the system runs a draft THE SYSTEM SHALL report `apiKeySource` as `none` in the run log
  - Verify: `grep -c '"apiKeySource":"none"' <run log>` equals the number of runs

### Error cases
- WHEN a draft contains a price not equal to the `rates.ts` quote or below the floor THE SYSTEM SHALL HOLD it with reason `price_mismatch`
  - Verify: `npm test -- --test-name-pattern="price mismatch holds"`
- WHEN a GigSalad draft contains a phone number, email or URL, or asks for contact info THE SYSTEM SHALL HOLD it with reason `gigsalad_contact_info`
  - Verify: `npm test -- --test-name-pattern="gigsalad contact holds"`
- WHEN a lead comes from Yelp THE SYSTEM SHALL never auto-send, whatever the gate result
  - Verify: `npm test -- --test-name-pattern="yelp never auto"`
- WHEN the auto-send path runs a lead THE SYSTEM SHALL pass the lead's platform into the pipeline (regression for `orchestrator.ts:130`)
  - Verify: `npm test -- --test-name-pattern="orchestrator passes platform"` fails on `main` and passes after the fix
- WHEN the Gmail token returns `invalid_grant` THE SYSTEM SHALL alert Alex and show `auth: failed` on `/health`, never "0 new mail"
  - Verify: `npm test -- --test-name-pattern="invalid_grant alerts"`; `curl -s localhost:$APP_PORT/health | jq .poller.auth`
- WHEN an alert cannot be confirmed as delivered THE SYSTEM SHALL retry by Telegram and list it as `ALERT FAILED` in the digest
  - Verify: `npm test -- --test-name-pattern="alert fallback"`
- WHEN a payment email fails DKIM or comes from a non-allow-listed domain THE SYSTEM SHALL reject it without matching
  - Verify: `npm test -- --test-name-pattern="forged payment rejected"`
- WHEN the same deposit is confirmed twice THE SYSTEM SHALL keep exactly one calendar event
  - Verify: `npm test -- --test-name-pattern="calendar idempotent"`
- WHEN a gig's channel is `gigsalad_platform` THE SYSTEM SHALL not generate a Venmo/Zelle invoice
  - Verify: `npm test -- --test-name-pattern="gigsalad platform no invoice"`
- WHEN `claude -p` would run with an API key present THE SYSTEM SHALL refuse to run and alert
  - Verify: `ANTHROPIC_API_KEY=x npm test -- --test-name-pattern="preflight refuses api key"`

### Verification commands (every module)
- `npx tsc --noEmit` → exit 0
- `npm test` → all pass, count reported
- `npm run plan:check docs/plans/2026-10-02-feat-booking-hub-plan.md` → `manual_only` (expected: needs human sign-off)
- `curl -s localhost:$APP_PORT/health | jq` → shows the poller's last success and its auth state

## Execution Path

- **Target:** Alex's daily Mac (on about 95% of the time), plus Alex's iPhone for alerts and the
  dashboard (S7).
- **Mechanism:**
  - `APP_PORT=3000 npm start`, launched by a Terminal `.command` login item. Not port 5000, which
    is AirPlay; not a LaunchAgent (Full Disk Access, S3).
  - The helper is launched the same way.
  - Claude Code runs (`claude -p`, Max) are started by the app with `env -u ANTHROPIC_API_KEY`.
- **Prerequisites:**

  | Item | Status |
  |---|---|
  | Claude Max | ALREADY HAVE |
  | Claude in Chrome extension | ALREADY HAVE |
  | Gmail OAuth client | ALREADY HAVE; S6 moves it to production mode |
  | Google Calendar access | ALREADY HAVE (GIG Calendar) |
  | Annual insurance policy | ALREADY HAVE |
  | GigSalad account | ALREADY HAVE |
  | Yelp business account | ALREADY HAVE |
  | Full Disk Access grant for the helper's Terminal | MUST GRANT (Alex, System Settings; S3) |
  | Telegram account + bot | MUST OBTAIN only if S4 fails (free) |
  | Tailscale | MUST OBTAIN only for S7 (free) |
  | Square developer app | MUST OBTAIN in Phase 3, only if card-client polling is kept (free) |

  Each MUST OBTAIN is verified as necessary by its spike before it is set up.
- **Who:** Claude Code builds and runs the tests. **Alex** grants Full Disk Access, runs each
  spike's known-answer check with Claude, approves the first 20 Phase-1 leads, and reviews the
  Phase-2 backfill.
- **Trigger:**
  - Phase 0 spikes run before any Phase 1 code.
  - Each module goes live on Alex's real work the day its tests pass, and the next module starts
    only after a week of live use with no unresolved ALERT FAILED.

## Plan Quality Gate

1. **What is changing?** gig-lead-responder becomes the booking hub, built in four modules after
   Phase 0. The runtime moves from Railway to the Mac, and drafting moves to `claude -p` on Max.
2. **What must not change?**
   - Alex's money terms.
   - The voice and pricing method (ported, not rewritten).
   - No contact info on GigSalad.
   - Yelp is never auto-sent.
   - Nothing is marked paid, and no COI goes to a venue, without Alex's tap.
   - No API-key billing.
   - The production DB is copied to `/tmp` before inspection.
3. **How will we know it worked?** The EARS tests above, plus the success measures against the
   0.4 baseline:
   - win rate (more gigs won)
   - 0 booked gigs missing from the calendar and 0 missed balances (nothing forgotten)
   - admin hours, by Alex's estimate weekly (hours back)
   - median time from lead to first reply (reply speed)
4. **Most likely way this plan is wrong:** an unattended Claude-in-Chrome run is not reliable
   enough, or not tolerated by GigSalad, to be the GigSalad auto-send channel. The S2 spike and the
   20-lead ramp catch this before it matters. The fallback is draft + one-tap + Alex pastes, which
   is still much faster than today. **Second:** the Mac being off for the other 5% of the time.
   Unanswered leads then wait. The digest shows the gap, and Railway is kept until the Mac proves
   itself.
5. **How will a human RUN this, and when?** See Execution Path.

## Success Metrics

| Measure (Alex's order) | Before | Target |
|---|---|---|
| Win rate | 0.4 baseline | above baseline at 3 months |
| Nothing forgotten | Dannecker-type misses happen | 0 booked gigs off the calendar; 0 missed balance or COI dates |
| Hours back | "whole days" | Alex's weekly estimate trending down |
| Reply speed | unknown | ≥80% of GigSalad leads answered within 1 hour (Top Performer needs 24 hours) |

## Dependencies & Risks

- **GigSalad terms vs Claude in Chrome replies.** Bots and scripts are banned (search summary),
  with three strikes before removal. Accepted by Alex as a known risk. Mitigated by the S2 spike,
  the ramp, and the fallback to manual pasting.
- **GigSalad payment rules.** Off-platform payment on an unmarked lead counts as a strike. Handled
  by the `gigsalad_platform` channel, with direct payment only by Alex's choice.
- **iMessage fragility across macOS updates.** Sends have reported success while delivering
  nothing. Every send is read back, and Telegram is the fallback.
- **Max usage limits on `claude -p`.** At 5–15 leads a week the volume is small, but the limits
  are unmeasured. If a run is blocked, the app alerts and holds; it never falls back to an API
  key.
- **Spoofed payment emails.** DKIM plus the allowlist plus Alex confirming each payment.
- **Unverified research items to test before relying on them:**
  - Whether a Square deposit alone fires a payment event.
  - The exact text of GigSalad's terms.
  - Whether The Bash accepts email replies.
  - Whether the Yelp agreement binds non-API businesses.

## Sources & References

- **Origin:** `docs/brainstorms/2026-10-02-booking-hub-brainstorm.md`. Decisions carried forward:
  - own app, approach A
  - confident drafts auto-send, everything else is approved
  - the module order
  - the money terms
  - a deposit triggers the calendar
- **Research:** `docs/research/2026-10-02-booking-hub/` (six reports plus a README).
- **Code:** `src/automation/orchestrator.ts:130`, `src/automation/router.ts:32-103`,
  `src/pipeline/run-pipeline.ts:57-77`, `src/pipeline/context.ts`, `src/data/rates.ts`,
  `src/twilio-webhook.ts:76`, `src/travel-fee.ts:9`.
- **Alex's artifacts:**
  - `~/.claude/docs/contract-and-payment-process.md`
  - `~/Downloads/Performance Agreement - Lee & Associates - Aug 20 2026.pdf`
  - the Pagnini agreement `.docx`
  - the `booking-to-invoice` skill
  - `~/Data/clients/pfe-performances/2026-09-30-failure-brief-dannecker-lauren-RAW.md`
- **Sweep:** `~/Projects/pacific-flow-hub/docs/audits/2026-10-02-crm-gig-apps-sweep/` (todo 020).

## Automation Contract

```json
{
  "auto_work_candidate": false,
  "human_signoff_required": true,
  "risk_level": "high",
  "allowed_paths": ["src/", "tests/", "docs/", "scripts/", "public/", "package.json", "package-lock.json", ".env.example", ".gitignore"],
  "forbidden_paths": [".env", "data/", "credentials.json", "logs/"],
  "source_of_truth": ["docs/brainstorms/2026-10-02-booking-hub-brainstorm.md", "docs/research/2026-10-02-booking-hub/README.md"],
  "required_checks": ["npx tsc --noEmit", "npm test"],
  "stop_conditions": [
    "Any Phase 0 spike fails its known-answer test",
    "A send would bypass the code send gate",
    "A run reports apiKeySource other than none",
    "Any change would send to a real client before the 20-lead review-only ramp is signed off",
    "Railway shutdown or any production DB write without Alex's explicit yes"
  ],
  "linked_expectations": [
    {"files": ["src/automation/orchestrator.ts", "src/pipeline/run-pipeline.ts"], "reason": "Platform must reach the pipeline on the auto-send path"},
    {"files": ["src/data/rates.ts", "src/automation/send-gate.ts"], "reason": "Gate price checks read the same rate table the pipeline quotes from"}
  ]
}
```

## Codex Plan-Review Handoff

```
Work in /Users/alejandroguillen/Projects/gig-lead-responder, branch docs/booking-hub-brainstorm.
FIRST gate: pwd; git branch --show-current; git rev-parse docs/booking-hub-brainstorm; git status --short.
Stop if the branch differs or the tree is dirty. Context: HANDOFF.md, CLAUDE.md, AGENTS.md (if present),
docs/brainstorms/2026-10-02-booking-hub-brainstorm.md, this plan
(docs/plans/2026-10-02-feat-booking-hub-plan.md), docs/research/2026-10-02-booking-hub/README.md.

Plan review, round 1. Check gaps, wrong assumptions, scope creep vs the brainstorm, the Feed-Forward
"least confident" item (unattended Claude-in-Chrome on GigSalad), and the 5-question Plan Quality Gate
including the Execution Path. Specifically challenge: (1) whether the send gate's checks are sufficient
for auto-sending a quote with a price; (2) the Mac-hosted runtime vs keeping Railway; (3) iMessage-to-self
as the primary alert path; (4) the GigSalad mixed payment path vs GigSalad's three-strike rule;
(5) whether every Project rule in 0.3 has a landing place that actually loads at runtime.
Return findings by severity and a Claude Code fix prompt. Do not implement.
```

## Three Questions

1. **Hardest decision in this session?** What may auto-send. Research says auto-send only a
   price-free acknowledgment; Alex wants confident quotes to go out on their own. The plan
   resolves it with a code gate that checks every number against the rate table, plus a 20-lead
   review-only ramp, so auto-send is earned against Alex's own approvals rather than assumed.
2. **What did you reject, and why?**
   - An LLM confidence score as the gate: judges are overconfident, and OWASP says to check
     outputs with code.
   - Twilio: Alex's experience and the 10DLC rules.
   - Bots on The Bash: its terms, and Alex isn't a member.
   - Auto-sending on Yelp: its agreement requires human review.
   - An e-sign service: not needed until returns go missing.
   - Keeping the API key: Alex chose Max.
3. **Least confident about going into the next phase?** Whether an unattended Claude Code run can
   drive Claude in Chrome on GigSalad reliably, and whether GigSalad tolerates it. That is spike
   S2, and it must run first. Second: running the hub on a daily-use Mac (sleep, updates, the 5%
   of time it's off) instead of a server.

## Feed-Forward

Same content as `## Three Questions` above (this repo's CLAUDE.md names the section that way):
hardest decision = Q1, rejected alternatives = Q2, least confident = Q3.
