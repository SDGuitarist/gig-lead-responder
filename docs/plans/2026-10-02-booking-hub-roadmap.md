---
title: "Booking hub roadmap (leads, gigs, money, contracts, COIs)"
type: roadmap
status: active
date: 2026-10-02
origin: docs/brainstorms/2026-10-02-booking-hub-brainstorm.md
---

# Booking Hub Roadmap

**Reader and trigger:** whoever plans or reviews any booking-hub module. This file holds the decisions,
the order of the modules and the success measures. **It is not a build plan.** Each module gets its
own plan, written only after the module before it has run live for a week, so that real results
shape it.

| Plan | Status |
|---|---|
| `docs/plans/2026-10-02-feat-hub-phase0-lead-replies-plan.md`: Phase 0 + Module 1, lead replies | **Written, deepened, awaiting Codex plan review** |
| Module 2: nothing forgotten (gigs, deposit → calendar → reminders, logistics, COI text) | Not written. Trigger: Module 1 live for 1 week with no unresolved ALERT FAILED |
| Module 3: contracts, invoices, payment matching | Not written. Trigger: Module 2 live for 1 week |

*The split was Alex's choice on 2026-10-02, on the architecture reviewer's advice: spike results
will change the later modules, and reviewing them now would spend the review budget on guesses.
Module 4 (COIs) merges into Module 2's logistics check, per the simplicity review.*

## Why

The brainstorm names four problems:
- Slow replies lose gigs.
- Booked gigs and payments get forgotten (the Dannecker case).
- Money admin is manual across 4 payment rails.
- Every gig involves many people and rules that change from venue to venue.

No commercial tool imports marketplace leads, reconciles Venmo or Zelle, or tracks venue COIs
(`docs/research/2026-10-02-booking-hub/`). Those gaps are why building makes sense. Alex wants his
own app. He dropped HoneyBook as too expensive, too much manual work, and too complicated.

## Decisions (brainstorm + research + Alex's answers, 2026-10-02)

| Topic | Decision | Source |
|---|---|---|
| Build or buy | Alex's own app, grown from gig-lead-responder (approach A) | Brainstorm |
| Host | **Alex's MacBook, lid open on the charger at night.** Started under `caffeinate`, with an outside heartbeat monitor | Alex; architecture review |
| Drafting | `claude -p` on the **Claude Max** subscription, never an API key, usage credits OFF | Alex; memory rule |
| Auto-send | Confident drafts auto-send, but **code decides what counts as confident**: a send gate plus a 20-lead review-only ramp | Brainstorm KD3, revised by research |
| GigSalad | **Email reply by default** (GigSalad delivers it onto the platform). Claude in Chrome is the fallback. Never ask for or share contact info | Alex; feasibility §1; security C1 |
| Yelp | Approve-only. The reply discloses the AI use | Yelp Leads Program Agreement |
| The Bash | Deferred until Alex rejoins | Alex |
| Alerts | iMessage to self, read back to confirm delivery. Telegram only if that fails. No Twilio | Alex; feasibility §2 |
| iMessage reading (text leads, payment texts) | **Delayed** until email alone proves too weak. Alex forwards text leads meanwhile | Alex, on the simplicity review |
| GigSalad payments | Mixed path, chosen per booking. In-platform by default; direct when the client shares contact details | Alex |
| Money terms | 50% non-refundable retainer on signing; balance 1 week before a music performance, day-of for corporate; card +3.75%; full total owed inside 7 days; W-9 for corporate; checks to Alejandro Guillen | `~/.claude/docs/contract-and-payment-process.md` |
| Square | Card clients only, read from Square's receipt emails. No developer app | Alex |
| COIs | Annual policy Alex already has. The app prepares the additional-insured text and Alex approves it | Alex; simplicity review |
| Lead Responder | The claude.ai Project's rules are ported into the repo. The Project is archived after the port plus the 20-lead ramp | Brainstorm KD4 |

## Module order and success measures

Each module ships and runs on real work before the next one starts.

1. **Lead replies.** Measures: win rate and reply speed.
2. **Nothing forgotten.** Measure: 0 booked gigs off the calendar, 0 missed balance or COI dates.
3. **Money and contracts.** Measure: hours back.

| Measure (Alex's order) | Before | Target |
|---|---|---|
| Win rate | Phase 0.4 baseline | above baseline at 3 months |
| Nothing forgotten | Dannecker-type misses happen | 0 off-calendar gigs, 0 missed money or COI dates |
| Hours back | "whole days" | Alex's weekly estimate trending down |
| Reply speed | unknown | ≥80% of GigSalad leads answered within 1 hour |

## Borrow / avoid (from the research)

**Borrow:**
- one-tap approval
- a two-lane send gate
- a reply clock for each platform
- payment rules tied to the event date and stored on the template
- "Record payment" with the method and who paid
- fixed reminder points
- must-play / do-not-play lists
- a per-gig logistics sheet
- a "who owes what, by event date" view
- the bot stops once Alex replies

**Avoid:**
- workflow builders
- treating off-platform payments as second-class
- auto-sent replies with unchecked prices
- client logins
- calendar sync that lags

## Carried forward for Modules 2–3 (do not lose these)

From the deepen reviews in `docs/research/2026-10-02-booking-hub/deepen/`:

**Data model (`data.md`)**
- `payments` and `payment_allocations` (with kinds: deposit, balance, tip, card_fee, cancellation)
  instead of one `total_cents`.
- A refund is a new row, never an edit.
- `confirmed → reversed`, with a recorded reason.
- `gigs.status` holds lifecycle states only (booked, played, closed, cancelled). Payment states
  are worked out from the allocations, never stored.
- A `gig_events` audit log.
- `gigs.lead_id` can be empty and the gig gets an `origin` field.
- `calendar_event_id` is UNIQUE.
- Contacts are de-duplicated by normalized email and phone, never merged automatically on a name.
- Event dates are local to Los Angeles, and due times are computed with a timezone library. Test
  the DST changeover weeks.
- Nightly `.backup` to `~/Data`, with a restore test.
- A retention rule (payments kept 7 years).

**Simplicity (`simplicity.md`)**
- No separate helper process.
- One `gig_contacts` table at first.
- Reminders need only `due_at`.
- No questionnaire lock.
- Seed the 4 existing gigs with a script, not import code.
- No workshop contract variant.
- No Chrome on the insurance portal.

**Security (`security.md` M1/M2)**
- The contract is signed only inside the approve step.
- The signature image and the W-9 live in `~/Data`, encrypted.
- The W-9 goes only to a verified corporate contact.
- COI details are extracted as fields that Alex approves before use.
- Bank texts are hints, never evidence of payment.
- Payment emails require `dmarc=pass` with an aligned domain.

**Architecture (`architecture.md` Q5)**
- Every reminder type has a "too late to send" time. Missed reminders go to Alex's digest, never to
  the client late.
- Catch-up items reach Alex as one digest, not a burst.

## Execution Path

N/A -- this roadmap is not built directly. Every module plan carries its own Execution Path, and
the first one is in `docs/plans/2026-10-02-feat-hub-phase0-lead-replies-plan.md`.

## Not building (YAGNI)

- multi-user
- a client portal
- a workflow builder
- The Bash (until Alex rejoins)
- social DMs
- an e-sign service (trigger: two missed or forged signed returns)
- workshop teaching material
- the phone dashboard over Tailscale (trigger: Alex asks for it after Module 1)

## Three Questions

1. **Hardest decision in this session?** Splitting the plan after Alex had chosen one plan. The
   architecture review showed that reviewing modules the Phase 0 spikes will change spends the
   two-NO-GO budget on guesses. Alex agreed.
2. **What did you reject, and why?** Running every available reviewer (about 40) during
   deepening: the research already covered the ground, and the gate-era audit warns against stacking
   gates. Keeping Railway as a second poller: it would send double replies.
3. **Least confident about going into the next phase?** Whether the MacBook, lid open on the
   charger, really stays awake and reachable at night. The S6 spike and the heartbeat monitor test
   this.

## Feed-Forward

Same as `## Three Questions` above: hardest decision = Q1, rejected alternatives = Q2, least
confident = Q3.
