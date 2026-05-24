# Gig Lead Responder — Roadmap

> Prioritized features ranked by biggest value to the business.
> When starting a new cycle, pick the top unshipped item and run `/workflows:brainstorm`.
> After shipping, move it to the "Shipped" section below.
>
> Last updated: 2026-05-22

## Priority Queue

### 1. The Bash / WeddingWire Parsers
Add these platforms to the Gmail poller. Both already email lead notifications
to Alex's Gmail — they just need a sender pattern in `source-validator.ts` and
a parser in `src/automation/parsers/`. Every uncaptured lead is a missed gig.

**Effort:** Low (1 session each)
**Depends on:** Nothing — standalone

### 2. Phase 2: Auto-Send Enabled
Flip `AUTO_SEND_ENABLED=true`. Leads that pass all routing checks send
automatically. Leads the router holds still come to Alex. Add `done_reason` to
`LeadApiResponse` + `shapeLead()` + dashboard so Alex can see which leads were
auto-sent vs held.

**Effort:** Low (config flip + dashboard `done_reason` rendering)
**Depends on:** Confidence from monitoring Phase 1 review-only leads

### 3. Reply Detection + Auto-Stop Follow-Ups
Detect when a client replies (via Mailgun webhook or Gmail thread check).
Auto-stop follow-up scheduling for that lead. Without this, follow-ups keep
going after the client already responded.

**Effort:** Medium
**Depends on:** Real email samples from GigSalad/The Bash to build reply parser
**Blocks:** Auto-send for follow-ups

### 4. Calendar Integration
Check Alex's calendar before quoting. If the date is already booked,
auto-decline or flag. If open, include availability confidence in the draft.
Prevents quoting dates he can't take.

**Effort:** Medium (Google Calendar API, similar OAuth pattern to Gmail)
**Depends on:** Nothing — standalone

### 5. Response Win/Loss Feedback Loop
Track which draft phrasings correlate with bookings. Over time, feed winning
patterns back into the generate prompt. The compound play — every booking
makes future drafts better.

**Effort:** High (needs outcome data + analysis pipeline + prompt iteration)
**Depends on:** Enough outcome data logged (conversion tracking already exists)

### 6. HoneyBook API Integration
Replace Zapier. When Alex approves a lead, auto-create a HoneyBook project
with event details pre-filled. Cut out manual re-entry.

**Effort:** Medium (HoneyBook API research + integration)
**Depends on:** Nothing — standalone

### 7. Platform Analytics Dashboard
Which platform has the best booking rate? Best price point? Highest response
rate? The data already exists in the leads table — just needs a dashboard view.
Tells Alex where to invest subscription dollars.

**Effort:** Low-medium (queries + dashboard tab)
**Depends on:** Enough leads with outcomes logged

### 8. Venue Intel Auto-Enrichment
When a lead books at a venue not in PF-Intel, auto-create the venue entry from
classification data. The venue database grows passively from real bookings.

**Effort:** Low (PF-Intel API call on `outcome: "booked"`)
**Depends on:** PF-Intel venue write endpoint

### 9. Lead to LiveRequest Bridge
When a lead is booked (`outcome: "booked"`), auto-create a LiveRequest session
with event details pre-filled (date, venue, duration, format). Alex shows up
to the gig with his request interface ready.

**Effort:** Medium (LiveRequest API + Supabase integration)
**Depends on:** LiveRequest API endpoint for session creation

## Deferred Tech Debt

| Item | Trigger |
|------|---------|
| Shared `esc()` extraction to `public/shared.js` | Next time index.html or dashboard.html is edited |
| Levenshtein fuzzy matching | When `unknown_capability` fires > 5% of leads |
| OAuth token refresh persistence on Railway | If token issues appear |
| Broader soft-refusal patterns | When production data shows new variants |
| Unicode normalization in `normalizeFormatText` | When accented-character leads appear |
| `full_draft` length cap | Pre-existing from Cycle 11 |
| Accessibility review | Pre-existing |
| Dual parser unification | Pre-existing |

## Shipped

- P3 Batch + Gmail Intake Phase 1 (review-only mode, capabilities unification, SPF/DKIM hardening) — 2026-05-22
- Capability hardening (alias map, soft refusal detection) — 2026-04-22
- Full codebase audit + fix cycle — 2026-04-07
- Follow-up pipeline V1 (scheduler, AI drafts, SMS approval) — 2026-03-01
- Follow-up pipeline V2 (dashboard tabs, snooze/skip, atomic claims) — 2026-03-05
- Lead conversion tracking (booked/lost/no_reply outcomes) — 2026-02-25
- Dashboard UI redesign (5-tab layout, analytics) — 2026-02-22
- API rate limiting — 2026-02-26
- Budget mismatch handling — 2026-02-21
- Rubric comparison fixes — 2026-02-21
- Core response pipeline — 2026-02-20
- Production automation loop — 2026-02-20
