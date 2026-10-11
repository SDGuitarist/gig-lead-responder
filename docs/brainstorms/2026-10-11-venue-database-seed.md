# Seed: a real, definitive venue database (Alex, 2026-10-11)

**Status:** idea, not started. **Reader and trigger:** the next brainstorm session that picks a new cycle
(HANDOFF "Next" lists it); `/workflows:brainstorm` starts from this file.

## Alex's words

"I've played at probably 80% of venues in San Diego. Let's make a note for creating a real definitive database for
venues with all my details from memory and anything you can pull from Google Calendar, Gmail accounts, and venue
websites, etc."

## Why it matters

Today's venue file (`~/Data/gig-lead-responder/venue-history.json`) has 10 venues. If Alex has played most San Diego
venues, nearly every lead names a venue he knows, and drafts currently say nothing about it. Each true "I've played
here" (with his own details: rooms, event types, load-in, sound) is stronger than any generic line.

## Sources to brainstorm

| Source | What it could give | Constraint |
|---|---|---|
| Alex's memory | which venues, rooms, event types, his own sentence | the only source of a claim sentence; his yes on the exact words (CLAUDE.md rule) |
| Google Calendar (both accounts?) | gig dates + locations = evidence he played a venue, and when | read-only; client names stay private |
| Gmail (both accounts) | bookings, contracts, venue coordinator threads, load-in details | read-only; contains client PII, never into this repo |
| GigSalad / Yelp booking history | venue per booked gig | GigSalad clicks need Alex's yes (HANDOFF hard gate) |
| Venue websites | official names, aliases, room names, address (for matching, not for claims) | public; never turns into an "Alex played here" claim on its own |
| PF-Intel (29 venues seeded) | existing venue intel in the other project | production data, different project |

## Questions for the brainstorm

1. Evidence bar: is a calendar entry at a venue enough to say "Alex has performed here" (fact only), with a sentence
   only from Alex?
2. Where it lives: stays in `~/Data` (private) as the single source; does PF-Intel read from it or stay separate?
3. Matching at scale: hundreds of names and aliases raise the false-match risk (one-direction rule, must-miss list).
4. Privacy: the extraction reads client mail and calendars; what is kept (venue, date, event type) and what is never
   copied (names, emails, prices)?
5. Upkeep: how a new gig adds or updates a venue without a manual session.

## Constraints already settled

Never commit venue sentences to this public repo; `scripts/check-venue-history.ts` must PASS before venue commits
(FC98: never widen its exemption). Gmail/Calendar/GigSalad access needs Alex's yes on scope before any read.

## Feed-Forward

- **Hardest decision:** none yet; this is a seed, not a brainstorm. Filed here (not dev-notes `ideas.md`) so the
  project's next brainstorm reads it.
- **Rejected alternatives:** starting extraction now (needs a plan and Alex's yes on Gmail/Calendar scope).
- **Least confident:** the evidence bar for a fact-only entry; a calendar event at a venue may be a meeting, not a gig.
