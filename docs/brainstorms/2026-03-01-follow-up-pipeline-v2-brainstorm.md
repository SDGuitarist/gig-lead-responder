---
title: Follow-Up Pipeline V2 — Dashboard-First
date: 2026-03-01
status: complete
roadmap_item: "#3 — Follow-Up Pipeline V2"
prior_brainstorm: docs/brainstorms/2026-02-26-follow-up-pipeline-brainstorm.md
---

# Follow-Up Pipeline V2 — Dashboard-First Brainstorm

## Prior Phase Risk

> **From V1 brainstorm (2026-02-26):** "Least confident about email parsing
> patterns for reply detection — real GigSalad/The Bash email samples needed
> to validate subject line matching before building the parser."

**How V2 addresses this:** We sidestep this risk entirely. Approach A
(Dashboard-First) replaces automatic reply detection with a manual "Client
Replied" button on the dashboard. Reply detection becomes a future add-on
once email samples are collected — not a blocker.

## Problem

V1 of the follow-up pipeline is shipped and working: auto-scheduled follow-ups,
AI drafts, SMS approval (SEND/SKIP), 3 follow-ups at 24h/3d/7d. After a
handful of real leads, four friction points have surfaced:

1. **Copy-pasting drafts** — Alex receives the follow-up draft via SMS, then
   manually pastes it into the platform messaging system
2. **No visibility** — no way to see which leads have pending follow-ups
   without checking the database directly
3. **Can't tell if they replied** — follow-ups might go out after a client
   already responded, which looks unprofessional
4. **Timing is off** — fixed 24h/3d/7d doesn't match real conversation pace
   (some leads need faster follow-up, others need a pause)

## What We're Building

A mobile-responsive follow-up dashboard that gives Alex full visibility and
control over the follow-up pipeline from his phone. The dashboard replaces
SMS as the primary control surface (SMS stays as a notification channel).

### Core Components

1. **Filtered lead list** — tabs for Due Now, Awaiting Reply, Snoozed, All.
   Each lead card shows: client name, event type/date, follow-up count,
   draft preview, action buttons
2. **Action buttons per lead** — Approve (send follow-up), Skip, Snooze,
   "Client Replied" (pauses follow-ups)
3. **Snooze controls** — quick presets (1 day, 3 days, 1 week) plus a date
   picker for specific dates
4. **Per-lead follow-up controls** — manage each lead independently (V1 only
   operates on the most-recent lead via SMS)

### What's NOT in V2

- **Automatic reply detection** — deferred until email samples are collected.
  Manual "Client Replied" button handles this for now.
- **Direct client delivery** — Alex still pastes follow-ups into platforms.
  Direct email/SMS sends require client contact info storage and trust
  calibration (20+ successful sends first).
- **Urgency-based timing bands** — V1 brainstorm designed these but the fixed
  schedule is adequate at current volume. Revisit when leads are time-sensitive.
- **Conversion analytics** — outcome tracking exists but per-follow-up
  attribution (which follow-up # converted) is deferred.

## Why This Approach

### Dashboard over reply detection

Reply detection is the "right" solution but it's blocked on email samples
nobody has collected yet. A manual "Client Replied" button solves 90% of
the problem (preventing embarrassing double-contacts) with zero new parsing
code. When email samples eventually arrive, reply detection layers on top
without changing the dashboard UI.

### Mobile-responsive web over native app

The existing Express server already serves a dashboard. Making it responsive
is a CSS/layout change, not a new tech stack. Alex can add it to his iPhone
home screen for an app-like experience. A native app would require React
Native or Swift — weeks of work for marginal UX gains at this stage.

### Filtered list over kanban board

Kanban boards look great on desktop but are painful on phone screens
(horizontal scrolling, tiny cards). A filtered list with tab navigation
works well on mobile and is simpler to build. At 1-5 active follow-ups,
a list is more than sufficient.

### SMS stays as notification, not primary control

SMS was the right V1 choice (zero UI needed). But per-lead controls, snooze
with date pickers, and draft previews don't fit in SMS. The dashboard becomes
the primary control surface; SMS becomes a notification: "You have 2 follow-ups
due — open dashboard to review."

## Key Decisions

| Decision | Choice | Why |
|---|---|---|
| Reply detection | Manual button, not auto | Blocked on email samples, manual covers 90% |
| Primary interface | Mobile-responsive dashboard | Solves visibility + control, Alex is mobile |
| View type | Filtered list with tabs | Mobile-friendly, simpler than kanban |
| Snooze UX | Presets (1d/3d/1w) + date picker | Quick for common cases, flexible for specific |
| SMS role | Notification only | "2 follow-ups due" alert, actions on dashboard |
| Per-lead controls | Yes, from day one | V1's most-recent-only was a known limitation |
| Direct client sends | Deferred | Needs contact storage + trust calibration |

## Resolved Questions

1. **Dashboard auth on mobile:** Use a long-lived cookie or token so the
   phone bookmark opens straight to the dashboard without re-entering
   credentials every time.

2. **SMS notification frequency:** Both — real-time SMS when the first
   follow-up becomes due, plus a daily digest if any are still pending.
   Ensures nothing slips through without being noisy.

3. **Draft editing on mobile:** No editing — approve or skip only. If the
   draft needs changes, skip it and write your own. Editing on a phone
   keyboard adds friction. A regenerate button could be a future add-on.

## Three Questions

1. **Hardest decision in this session?** Whether to include reply detection at
   all or defer it entirely. Reply detection is the technically elegant solution
   to the "don't follow up after they replied" problem, but it's blocked on
   email samples that haven't been collected. The manual "Client Replied" button
   is unglamorous but unblocked and solves the same user problem.

2. **What did you reject, and why?** Rejected native iOS app — would require a
   new tech stack (React Native or Swift) for marginal UX gains when a
   responsive web app with home screen bookmark gives 90% of the experience.
   Also rejected building the full V2 in one shot (reply detection + dashboard +
   snooze + direct delivery) — too much scope, high context-death risk, and
   reply detection is blocked anyway.

3. **Least confident about going into the next phase?** The mobile UX for the
   follow-up dashboard. The current dashboard was built for desktop. Making it
   truly usable on a phone (tap targets, card layout, snooze date picker,
   draft preview readability) requires careful design decisions that this
   brainstorm doesn't answer. The plan phase should include wireframes or at
   least a component breakdown for mobile layout.

## Feed-Forward

- **Hardest decision:** Reply detection — defer vs. include (deferred it)
- **Rejected alternatives:** Native iOS app (wrong ROI), full V2 in one shot (scope risk)
- **Least confident:** Mobile UX design for the dashboard — needs wireframes or component breakdown in the plan phase
