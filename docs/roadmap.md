# Gig Lead Responder — Roadmap

> Prioritized features pulled from `~/Documents/dev-notes/ideas.md`.
> When starting a new cycle, pick the top item and run `/workflows:brainstorm`.
> After shipping, move it to the "Shipped" section below.

## Up Next

### 1. Smart HoneyBook Handoff
Stop firehosing every lead into HoneyBook. Qualify leads in the dashboard first, only push to HoneyBook once warm. Adjust Zapier to route through Gig Lead Responder.

### 2. Conversion Intelligence
Log outcomes (booked, lost to competitor, lost to price, ghosted). Dashboard analytics by source, event type, season. Competitor tracking.

### 3. Follow-Up Pipeline V2
Reply detection (Mailgun webhook for client replies), dashboard follow-up tab with status badges and SNOOZE/SKIP controls. Blocked on real email samples from GigSalad/The Bash.

## Backlog (not yet prioritized)

- Multi-Source Lead Inbox — unified view across GigSalad, The Bash, Yelp, website, referrals
- Contact Extraction & Platform Workarounds — research how to get contact info off restricted platforms
- Response Analytics — track which AI responses get replies, feed winning patterns back into the prompt

## Open Maintenance

All 22 code review items resolved. SSE abort/close coverage gap flagged in last review.

## Shipped

- Core response pipeline
- Production automation loop
- Budget mismatch handling
- Rubric comparison fixes
- Dashboard UI redesign
- Lead conversion tracking
- API rate limiting
- Follow-up pipeline V1 (scheduler, AI drafts, SMS approval)
