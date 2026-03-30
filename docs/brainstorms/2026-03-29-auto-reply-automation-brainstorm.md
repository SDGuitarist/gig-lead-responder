# Auto-Reply Automation Layer — Brainstorm

**Date:** 2026-03-29
**Status:** Brainstorm complete
**Next:** `/workflows:plan`

---

## What We're Building

An always-on automation layer that detects incoming gig leads from Gmail, runs them through the existing classify-price-context-generate-verify pipeline, and delivers replies automatically — via Gmail for email leads, via Playwright browser automation for portal leads.

### The Problem

Speed wins gigs. The first musician to respond often gets booked. Currently Alejandro writes replies manually, which means leads can sit for hours. With 5-15 leads per week across three platforms, that's a lot of lost response time.

### The Solution

Add three new capabilities to the existing gig-lead-responder app:

1. **Gmail watcher** — monitors inbox for lead notification emails
2. **Reply router** — sends replies via the right channel (email or portal)
3. **Edge case guardrails** — flags unusual leads for manual review instead of auto-sending

---

## Lead Sources and Reply Methods

| Source | Lead arrives as | Reply method | Auto-send? |
|--------|----------------|-------------|------------|
| GigSalad | Email notification to Gmail | Playwright logs into portal, submits reply | Yes (normal leads) |
| Yelp | Email notification to Gmail | Playwright logs into portal, submits reply | Yes (normal leads) |
| Squarespace website form | Email to Gmail | Gmail API reply-to-sender | Yes (normal leads) |

All three sources share the same trigger: a new email in Gmail matching known patterns.

---

## Why This Approach (vs. Perplexity Computer)

The original idea was to use Perplexity Computer ($200/month) as the orchestrator. We rejected this because:

- The existing pipeline already does the hard work (classification, pricing, cultural context, draft generation, quality gate)
- Perplexity Computer's role would shrink to email monitoring + browser clicks — not worth $200/month
- Building it directly gives full control, no credit caps to manage, and no platform dependency
- Monthly cost: just Claude API usage (already paying for this)

---

## Key Decisions

### 1. Run on the old Mac (dedicated server)
The old Mac (transferred from) becomes a dedicated lead-response server. Plugged in, always on, "Prevent automatic sleeping" enabled. Keeps the new Mac clean for daily work.

### 2. Full automation with edge case guardrails
- **Normal leads:** Pipeline runs, verification gate passes, reply auto-sends immediately
- **Edge case leads:** Held for manual review, Alejandro gets a notification
- Edge cases defined as: very high budget (e.g., >$3,000), verification gate fails after retries, flagged concerns from classifier, unknown/new platform format

### 3. Gmail API for trigger (not polling)
Use Gmail API push notifications or watch() to detect new emails in near-real-time, rather than polling on an interval. Faster and cheaper.

### 4. Playwright for portal replies
GigSalad and Yelp require logging into their web portals to reply. Playwright automates this: login, navigate to lead, paste reply, submit. Credentials stored securely in .env.

### 5. Gmail API for email replies
Squarespace form leads arrive as regular emails. Reply directly using Gmail API — no browser automation needed.

### 6. Three-platform scope (for now)
GigSalad, Yelp, Squarespace form. No others until these are solid. Adding a new platform later = adding one email pattern matcher + one reply handler.

---

## Architecture Overview

```
Gmail Inbox
    │
    ▼
[Gmail Watcher] ── detects lead notification emails
    │
    ▼
[Lead Parser] ── extracts raw lead text from email body
    │
    ▼
[Existing Pipeline] ── classify → price → context → generate → verify
    │
    ▼
[Edge Case Check] ── high budget? gate failed? flagged concerns?
    │
    ├── Normal → [Reply Router]
    │       ├── Squarespace → Gmail API reply
    │       ├── GigSalad → Playwright portal submit
    │       └── Yelp → Playwright portal submit
    │
    └── Edge Case → [Notification to Alejandro]
            └── SMS (Twilio) with reply draft + portal link
```

---

## Resolved Questions

1. **Notification method for edge cases:** Text message via Twilio. Immediate visibility on phone with draft reply + portal link.
2. **What happens if Playwright fails?** Fall back to SMS notification with the draft reply + portal link, so Alejandro can paste it manually. The lead still gets a fast response even if automation breaks.

## Prerequisites

The existing gig-lead-responder pipeline has NOT been live-tested yet (no API key run, no review phase, no compound phase — see docs/HANDOFF.md). The pipeline must be validated before building automation on top of it. Plan phase should account for this.

## Open Questions

1. **Login persistence for portals:** Should Playwright maintain a persistent browser session (stay logged in) or log in fresh each time? Persistent is faster but riskier if session expires mid-reply. (Defer to plan phase — implementation detail.)
2. **Edge case thresholds:** What exact budget, concern, or signal levels trigger a hold for manual review? Needs concrete numbers in the plan phase.
3. **Logging:** What gets recorded for each lead (timestamp, platform, classification, reply sent/held, errors)? Needed for an unattended system — define in plan phase.

---

## Feed-Forward

- **Hardest decision:** Whether to use Perplexity Computer vs. build it ourselves. Decided to build — the existing pipeline already does the hard part, and the automation layer is straightforward plumbing.
- **Rejected alternatives:** Perplexity Computer ($200/month, overkill for email watching + browser clicks), Zapier/Make (limited customization, can't run the full pipeline), notification-only approach (doesn't achieve the speed goal).
- **Least confident:** Portal automation fragility — GigSalad and Yelp can change their website at any time, breaking the Playwright scripts. Need a monitoring/alerting strategy so broken automation doesn't silently fail.
