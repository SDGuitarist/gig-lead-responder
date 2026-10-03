# Booking Hub: Brainstorm

**Date:** 2026-10-02
**Status:** Brainstorm complete
**Next:** `/workflows:plan`
**Origin:** `~/Projects/pacific-flow-hub/HANDOFF.md` (2026-10-02 objective) and the sweep in
`~/Projects/pacific-flow-hub/docs/audits/2026-10-02-crm-gig-apps-sweep/`

---

## What We're Building

One system, built and owned by Alex, that handles the booking business end to end: answering
leads, quoting, contracts, invoices, payment tracking, calendar, reminders, gig logistics and
COIs. It grows out of gig-lead-responder, the only app already running 24/7.

### The problem

- **Slow replies lose gigs.** Leads arrive while Alex is performing, driving, or out of
  bandwidth. A faster competitor books the gig. Today every reply is pasted by hand into the
  claude.ai Project "Gig Lead Response System 4.0".
- **Things get forgotten.** The Dannecker Oct 24 gig was signed and deposit-paid on Sept 1, then
  missing from the calendar until Sept 28. Claude then missed the signed PDF sitting in the
  thread (`~/Data/clients/pfe-performances/2026-09-30-failure-brief-dannecker-lauren-RAW.md`).
- **Money admin is slow.** Quotes, invoices, deposits and balances arrive across Square, Venmo
  and Zelle, and are checked by hand.
- **Each gig has many people.** Couple + planner + venue coordinator, or a corporate contact +
  AV team. There are music-preference calls, logistics, and COIs (often) or licenses
  (sometimes), and the rules differ per venue.

### What the system does

| Job | Behavior |
|---|---|
| Lead replies | Drafts every lead with the Project's full method. **Auto-sends** high-confidence drafts. Texts Alex to approve uncertain ones. |
| Lead sources | GigSalad, Yelp, The Bash (portal replies), email + website form. Texts and calls are captured (read from iMessage, or forwarded/logged by Alex) and drafted for Alex to send. Social DMs out of scope. |
| Contacts | One gig, many people (couple, planner, venue coordinator, corporate contact), each with a role. Client type (corporate, private, couple, planner) shapes templates. |
| Contracts | Creates and fills the Performance Agreement, signs Alex's side, sends it. Client signs with any tool. Detects the signed return. |
| Invoices + payments | Sends deposit/balance invoices. Reads payment emails **and iMessages** (Square, Venmo, Zelle), matches each to a gig, logs it, reminds when due or late. |
| Calendar | Gig goes on the GIG Calendar the moment the deposit lands. |
| Reminders | Balance due; music-call scheduling + questionnaire; venue/planner logistics check; post-gig thank-you, review request, outcome. |
| COIs | Prepares the EventHelper COI. **Buying always needs Alex's approval** (it costs money). |
| Interface | Texts for urgent approvals + a phone dashboard. Claude Code on the Mac for bigger work. |

---

## Why This Approach

**Chosen: A — grow gig-lead-responder into the hub.** It already runs 24/7 with Gmail intake,
SMS approve/edit, follow-ups, outcomes and a quality gate. Lead replies are the costliest job,
and this path improves them first.

**Rejected:**
- **B, a new hub app.** It's the cleaner design and easier to teach, but lead replies would wait
  longest.
- **C, Claude Code as the app** (skills + scheduled jobs on the Mac). Nothing runs while the Mac
  sleeps, so night leads would wait. That works against the #1 success measure.
- **Buying a commercial CRM.** Alex wants his own app. HoneyBook was dropped as too expensive,
  too much manual work, and too complicated. Commercial tools are researched only for features to
  borrow.

**Still stands from `2026-03-29-auto-reply-automation-brainstorm.md`:** an old Mac as the
always-on server, Playwright for portal replies, 5-15 leads a week. That Mac also covers the
parts that need macOS: reading iMessages and working the EventHelper site.

---

## Key Decisions

1. **Own app, not a subscription.** Commercial CRMs (HoneyBook, Dubsado, HubSpot,
   entertainment-specific tools) are researched for features to borrow. Every borrowed feature
   is checked against HoneyBook's three failures.
2. **One plan covers all modules; the build goes in this order:** (1) merged Lead Responder +
   auto-send + the 4 known production defects (pacific-flow-hub todo 020); (2) nothing
   forgotten: deposit → calendar → reminders; (3) contracts + invoices + payment matching;
   (4) COIs and logistics. Each module ships and runs before the next starts.
3. **Confidence decides auto-send.** High confidence sends on its own; anything else waits for a
   text approval. How confidence is measured is a planning question, and so is every portal's
   rules on automated replies.
4. **One Lead Responder: the Project is the brain, the repo is the body.** The Project's rules
   get ported into the repo (see the comparison below), so the repo becomes the single source.
   The claude.ai Project is retired once the repo matches it.
5. **Money terms are fixed, not designed.** 50% non-refundable retainer on signing; balance due
   one week before a music performance (day-of for corporate/one-off); card adds 3.75%; inside 7
   days the full total is owed; W-9 for corporate; checks to Alejandro Guillen; never a booking
   without a deposit (`~/.claude/docs/contract-and-payment-process.md`).
6. **A deposit triggers the calendar.** One event drives the calendar entry, the reminders and
   the status change, so the Dannecker gap cannot recur.
7. **Spending money always needs a human.** COI purchases, refunds, and anything that charges a
   card.
8. **Teaching comes later.** Teaching it in workshops is the long-term goal. It does not shape
   release one.

### Success measures (in Alex's order)

1. More gigs won (win rate on inquiries, against today)
2. Nothing forgotten (0 booked gigs missing from the calendar, 0 missed balance/COI deadlines)
3. Hours back (booking admin down from whole days)
4. Reply speed (time from lead arrival to first reply)

---

## Lead Responder Comparison (2026-10-02)

**Source:** `~/Desktop/Gig_Lead_Response_System_4.0_Extraction.md`. It holds 19/19 knowledge
files, the Project instructions, 11 memory files stored verbatim, and a self-description. File 6
is replaced by `~/Desktop/Rate_Card_Solo_Duo.md`, the complete copy. Both stay outside the repo
because they hold rates and a real client's lead.

**Method:** word-level diff (case, punctuation and dashes ignored). Controls: the Project's two
duplicate pairs (QUICK_REFERENCE files 11/17, EVENT_STRUCTURE_THEORY files 7/18) both read 0
differences.

**Why it matters:** `src/pipeline/context.ts` loads `docs/*.md` while the app runs. Any rule
missing from those docs is missing from the live replies.

| | Finding |
|---|---|
| **Project only** | Graceful Decline pattern (format honesty before price, a specific exit line, 5 gate checks). Competition-count rule (use the platform's number, never estimate, direct = 0). R1-R3 residency tiers (Apr 26; absent from `src/data/rates.ts`, which has the $500 floor). Five files the repo lacks: LEAD_RESPONSE_VOICE, VENUE_INTEL, EVENT_STRUCTURE_THEORY, the T4 reference lead, and memory (T4 + nonprofit pricing, booking terms, venue history, "Alex plays any style on guitar or ukulele"). Big rewrites in PRICING, QUICK_REFERENCE (~180 lines), CULTURAL_CORE, CULTURAL_SPANISH_LATIN, Solo/Duo rate card. |
| **Repo only** | Machinery: intake, SMS approve/edit, follow-ups, hard gate, travel fee. RESPONSE_CRAFT re-framed for the pipeline. ~45 Trio/Ensemble rate-card lines the Project lacks. |
| **Same** | DRAFT_METHOD (identical), Bolero playbook (encoding only), PROTOCOL except the competition rule. |
| **Project-internal conflicts** (from its Part 5) | T4/NP pricing only in memory. "Never mention battery-powered sound" contradicts file passages. AUTHENTICITY_SCREEN.md and FOLLOW_UP.md referenced but missing. Instructions say RESPONSE_CRAFT covers steps 6-11 but it covers 6-8. |

---

## Resolved Questions

- **HoneyBook status?** Not in use. It was dropped as too expensive, too much manual work, and
  too complicated.
- **Costliest job?** Lead replies, then invoicing/payments/quotes.
- **Build or buy?** Build, fully his own.
- **Auto-send?** Yes, for high-confidence drafts.
- **Payment detection?** Payment emails + iMessages, logged, with reminders.
- **Contracts?** App creates, fills, signs and sends. The client signs however they like.
- **COIs?** EventHelper portal, linked from the music Gmail.
- **Lead Responder truth?** Best of both, living in the repo.
- **Trio/Ensemble rate card?** Alex is unsure. The plan shows the differing lines side by side,
  and Alex decides line by line before the port.
- **Win-rate baseline?** Not counted anywhere. The data lives in both Gmail accounts, GigSalad
  and Google Calendar. The plan rebuilds a baseline from those before launch, so "more gigs
  won" can be measured.

## Open Questions

None.

---

## Three Questions

1. **Hardest decision in this session?** auto-sending. It's the biggest lever for winning gigs and the biggest
  risk. One wrong price or tone sent at 2am under Alex's name cannot be unsent, and marketplace
  rules on automated replies are unverified.
2. **What did you reject, and why?** a new hub app (B) and Claude Code on the Mac alone (C). Reasons
  above. Also buying HoneyBook back or adopting any sandbox CRM as-is: none has held real data.
3. **Least confident about going into the next phase?** whether GigSalad, Yelp and The Bash allow automated portal replies, and
  whether Playwright logins survive their bot checks. If not, auto-send shrinks to email/form
  leads and the portals get "draft + one-tap approve." Second: reading iMessages needs Full Disk
  Access on the server Mac, and macOS privacy rules have blocked reads before.
