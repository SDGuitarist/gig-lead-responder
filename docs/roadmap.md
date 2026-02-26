# Gig Lead Responder — Roadmap

> Prioritized features pulled from `~/Documents/dev-notes/ideas.md`.
> When starting a new cycle, pick the top item and run `/workflows:brainstorm`.
> After shipping, move it to the "Shipped" section below.

## Up Next

### 1. Follow-Up Pipeline
Reminders, lead status tracking (new → responded → follow-up due → in conversation → booked → lost), one-click follow-up drafts, snooze. **Why first:** this is where leads die today — biggest ROI.

### 2. Smart HoneyBook Handoff
Stop firehosing every lead into HoneyBook. Qualify leads in the dashboard first, only push to HoneyBook once warm. Adjust Zapier to route through Gig Lead Responder.

### 3. Conversion Intelligence
Log outcomes (booked, lost to competitor, lost to price, ghosted). Dashboard analytics by source, event type, season. Competitor tracking.

## Backlog (not yet prioritized)

- Multi-Source Lead Inbox — unified view across GigSalad, The Bash, Yelp, website, referrals
- Contact Extraction & Platform Workarounds — research how to get contact info off restricted platforms
- Response Analytics — track which AI responses get replies, feed winning patterns back into the prompt

## Open Maintenance

11 pending code review items in `todos/` (1 P1, 4 P2, 6 P3).
SSE abort/close coverage gap flagged in last review.

## Shipped

- Core response pipeline
- Production automation loop
- Budget mismatch handling
- Rubric comparison fixes
- Dashboard UI redesign
- Lead conversion tracking
- API rate limiting
