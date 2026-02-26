---
title: Follow-Up Pipeline
date: 2026-02-26
status: complete
roadmap_item: "#1 — highest ROI, where leads die today"
---

# Follow-Up Pipeline — Brainstorm

## Prior Phase Risk

No prior phase — this is the first cycle for this feature. Prior feature cycle
(rate limiting) is complete. HANDOFF.md notes SSE abort/close as a coverage gap
but that is unrelated to this feature.

## Problem

After sending the initial AI response, the system forgets about the lead.
There is no follow-up, no reminders, no status tracking beyond `done`. Leads
that don't reply within 24 hours are effectively lost — the musician (Alex)
has to manually remember to check platforms and follow up. This is where
the biggest revenue leaks happen.

## What We're Building

A follow-up pipeline that automatically schedules, drafts, and (when
confident) sends follow-up messages after the initial response. The system
tracks each lead's conversation stage and adapts timing based on urgency
signals.

### Core Flow

```
Initial response approved (status = done)
  → Auto-schedule first follow-up (default: 48hrs)
  → When due: AI drafts value-add follow-up message
  → High confidence (passes verify gate 12/14): auto-send to client
  → Lower confidence: SMS draft to Alex for approval
  → Client replies detected via email parsing → cancel scheduled follow-ups
  → No reply → escalate: 5 days (stronger nudge), 10 days (last chance)
  → Alex can SNOOZE via SMS or SKIP to cancel all follow-ups
```

### Delivery Channels

Follow-ups reach clients through multiple channels depending on what
contact info is available:

- **Email** — when client email is available (The Bash usually provides it)
- **SMS to client** — when phone number is available
- **Platform draft** — when only platform messaging exists, draft is sent to
  Alex's phone for manual pasting into GigSalad/The Bash

### Key Components

1. **Schema additions** — `follow_up_status`, `follow_up_scheduled_at`,
   `follow_up_count`, `follow_up_channel`, `snoozed_until` columns
2. **In-process scheduler** — `setInterval` in server.ts, checks every
   15 minutes for due follow-ups
3. **Follow-up draft generator** — AI prompt that creates value-add nudges
   (song suggestions, testimonials, availability updates)
4. **SMS approval flow** — reuses existing Twilio webhook pattern with new
   commands: YES/SKIP/SNOOZE
5. **Reply detection** — parse platform notification emails (GigSalad,
   The Bash) via existing Mailgun webhook to auto-cancel follow-ups
6. **Dashboard tab** — shows follow-up queue, snooze controls, status

## Why This Approach

### Separate `follow_up_status` field (not merged into `status`)

The existing `status` field tracks delivery (received → sent → done). The
`outcome` field tracks resolution (booked/lost/no_reply). Follow-up stage
is a third independent dimension — different triggers, different actors,
different nullability. Small CRMs (Pipedrive, Streak) use this same pattern:
delivery tracking and conversation stage are separate columns.

| Field | Tracks | Values |
|---|---|---|
| `status` | Delivery pipeline | received → sending → sent → done |
| `follow_up_status` | Conversation stage | null → pending → due → sent → in_conversation |
| `outcome` | Final result | booked / lost / no_reply |

`null` default means all existing leads are unaffected — zero migration risk.

### Graduated automation (not fully automatic from day one)

High-confidence responses (passing verify gate 12/14) auto-send. Lower
confidence drafts go through SMS approval. This reuses the existing SMS
approval pattern — no new infrastructure for the approval step.

The goal is fully automatic for all follow-ups eventually, but graduating
trust prevents embarrassing messages while the system learns.

### Reply detection via email parsing (not platform API)

Neither GigSalad nor The Bash has a public API, webhooks, or Zapier
integration. **Email notifications are the only programmatic hook.** Both
platforms email the musician when a client replies, and GigSalad emails
include the full message body. The existing Mailgun webhook can be extended
to distinguish reply notifications from new lead emails.

### Value-add nudge tone (not just "checking in")

Each follow-up adds something new — a song suggestion for their event type,
a recent testimonial, an availability update, a question about their vision.
This gives the client a reason to engage beyond "just following up."

### In-process scheduler for V1

`setInterval` in server.ts is the simplest option — no new infrastructure.
It resets on deploy/restart, but Railway deploys are fast and the check
interval (15 min) means at most one missed cycle. If this proves unreliable,
upgrade to Railway cron job later.

## Key Decisions

| Decision | Choice | Why |
|---|---|---|
| Status field design | Separate `follow_up_status` | Zero migration risk, clean separation of concerns |
| Automation level | Graduated (verify gate) | Prevents bad messages while building trust |
| Confidence signal | Existing verify gate (12/14) | Already built and calibrated — may need adapted checks for follow-ups (shorter, different structure than initial pitches) |
| Follow-up timing | Fixed 48hr/5d/10d + urgency compression | YAGNI — per-lead-type config not needed yet |
| Urgency detection | Event date proximity | Already extracted by pipeline (`event_date` field) |
| Trigger | Auto after initial approval | Zero friction, SMS approval catches mistakes |
| Reply detection | Email parsing via Mailgun | Only viable option — no platform APIs exist |
| Follow-up tone | Value-add nudge | Earns the reply, not just "bumping this" |
| Snooze mechanism | SMS reply (SNOOZE 7 / SNOOZE 3/5) | Matches existing SMS interaction pattern |
| Scheduler | In-process setInterval | Simplest, upgrade to cron if unreliable |
| Delivery channel | Multi: email, SMS, platform draft | Use what's available per lead |
| Implementation approach | Incremental layers | Each layer shippable independently |

## Urgency-Aware Timing

Default schedule: 48 hours → 5 days → 10 days (3 follow-ups max).

When the event date is close, compress the windows:

| Event proximity | First follow-up | Second | Third |
|---|---|---|---|
| > 6 weeks out | 48 hours | 5 days | 10 days |
| 2–6 weeks out | 24 hours | 3 days | 7 days |
| < 2 weeks out | 12 hours | 2 days | 4 days |

The pipeline already extracts `event_date` — this is a simple date
comparison, not a new AI call.

## Reply Detection Design

Extend the existing Mailgun webhook (`POST /webhook/mailgun`) to
distinguish three email types:

1. **New lead** — from GigSalad/The Bash lead notification templates
   (current behavior, unchanged)
2. **Client reply** — from platform notification emails indicating the
   client responded to your message
3. **Other** — reminders, marketing, etc. (ignore)

Detection signal: GigSalad reply emails come from `@gigsalad.com` with
a different subject pattern than new leads. Match on subject line patterns
(e.g., "New message from" vs "New lead from") and sender address.

**Lead matching challenge:** When a reply email arrives, the system must
match it to a specific lead in the database. Possible signals: client name
in the email body/subject, event date, platform-specific lead ID in the
email URL or headers. This is the hardest unsolved detail in reply detection
— the plan phase must define a matching strategy and test it against real
email samples.

When a client reply is detected:
- Set `follow_up_status = 'in_conversation'`
- Cancel any scheduled follow-ups for that lead
- Optionally: SMS Alex "Client replied to [Lead Name] — check platform"

## Implementation Layers (build order)

1. **Schema + types** — add columns, update TypeScript types
2. **Scheduler** — setInterval loop, query for due follow-ups
3. **Follow-up draft generator** — new AI prompt for value-add nudges
4. **SMS approval flow** — extend Twilio webhook with YES/SKIP/SNOOZE parsing
5. **Reply detection** — extend Mailgun webhook to catch platform replies
6. **Dashboard tab** — follow-up queue, status badges, snooze controls

## Open Questions (for Plan Phase)

1. **Reply-to-lead matching:** How does a reply email get linked to a specific
   lead in the database? Needs real email samples to identify reliable signals
   (client name, event date, platform lead ID in URLs/headers).

2. **Verify gate adaptation:** The 14 gut checks were calibrated for initial
   response pitches. Follow-ups are shorter and structurally different — which
   checks apply, and do any need adjusted pass criteria?

## Three Questions

1. **Hardest decision in this session?** Reply detection scope for V1. It adds complexity (email parsing for replies vs new leads, subject pattern matching, per-platform detection) but without it, the system can't know when to stop following up — leading to embarrassing double-contacts. Including it was the right call but it's the riskiest layer.

2. **What did you reject, and why?** Rejected replacing the existing `status` field with a unified lifecycle. It would have been "cleaner" conceptually but would touch every query, filter, and dashboard card in the codebase. The separate `follow_up_status` field has zero migration risk and matches how small CRMs actually do it. Also rejected fully automatic follow-ups for V1 — the verify gate provides a natural confidence threshold, but until we see real follow-up performance data, graduated trust is safer.

3. **Least confident about going into the next phase?** The email parsing for reply detection. We confirmed GigSalad reply emails include the message body, but the exact subject line patterns and sender addresses for "client replied" vs "new lead" vs "reminder" emails haven't been tested against real samples. If the patterns are ambiguous, reply detection could misclassify new leads as replies (canceling follow-ups prematurely) or miss replies entirely. The plan phase should address this by defining a testing strategy with real email samples before building the parser.

## Feed-Forward

- **Hardest decision:** Reply detection in V1 — adds complexity but prevents double-contacts
- **Rejected alternatives:** Unified status field (too much blast radius), fully automatic V1 (trust not yet established)
- **Least confident:** Email parsing patterns for reply detection — real GigSalad/The Bash email samples needed to validate subject line matching before building the parser
