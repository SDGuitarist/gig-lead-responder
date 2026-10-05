# GigSalad lead page: real structure (both accounts, 2026-10-04)

**Reader and trigger:** whoever builds GigSalad portal reading (`src/automation/portals/gigsalad-client.ts`
fetch + a pure page parser). Read before writing the parser or its fixture.

**How it was read:** Alex signed in to the music account in Chrome and allowed Claude to open any lead
(2026-10-04). Two lead pages were opened read-only (a personal occasion and a wedding reception); no button was
pressed. Structure only is recorded here: no names, phone numbers, addresses or amounts.

## Where a lead lives

- Inbox: `https://www.gigsalad.com/promokit/inbox` (rows link to `/promokit/gig/<numeric id>`).
- Lead page: `https://www.gigsalad.com/promokit/gig/<numeric id>`, title `Gig Lead from <First L.> | GigSalad`.
- Unknown: how the email's `tracking.gigsalad.com` link maps to the gig id (follow the redirect once, on a real
  email, with Alex's OK; or match the lead in the inbox by first name + event type + date).

## The "Event info" region (an ARIA region named "Event info")

Label/value pairs, so parse by **label text**, not CSS classes. Seen on both pages unless marked optional:

| Field | Shape on the page | Notes |
|---|---|---|
| Client | `First L.` | first name + initial only |
| Phone | `(xxx) xxx-xxxx` next to a "Phone number" image | **NEVER store, log or put in a prompt** (contact data; GigSalad bans off-platform contact) |
| Responded | `N member(s)` + `responded` | competition context |
| Quotes sent | `N member(s)` + `sent a quote` / `sent quotes` | **the displayed quote count R358 compares against** |
| Active quotes | `0 have active` + `quotes`, or `N quotes` + `are active` | wording flips with the number |
| Date | `Thu, June 17, 2027` (weekday, month day, year) | calendar link carries ISO `?date=YYYY-MM-DD` (easier to parse) |
| Time | `10:00 PM – 10:45 PM (45 minutes)` / `3:30 PM – 5:30 PM (2 hours)` | duration in parentheses |
| Location | city, state zip, country; or venue name + street address + city, state zip | zip feeds the travel lookup; a venue name is the start of the string when present |
| Event type: | e.g. Personal Occasion, Wedding Reception | |
| Requested: | e.g. World Music, Classical Guitarist | the category the client picked |
| Planning stage: | e.g. "<name> is planning to book soon" | **optional** |
| Number of guests: | `N guests` | |
| Budget range: | `$A – $B` | **optional** (missing on one of two) |
| Age range of audience: | e.g. Unknown | **optional** |
| Equipment needed: | e.g. Backline (instruments), I'm not sure yet | |
| Performance location: | e.g. Outdoor (without cover) | **optional** |

## The client's message

A heading in the thread holding the client's request. On both pages it was GigSalad's stock text "Please send me a
quote.", so for many leads the Event info block is the whole lead. The thread also contains Alex's own replies and
GigSalad notices ("Changes have been made to this event ..."); the parser must not take those as the client's words.

## Business account (2 more leads, read-only, same day)

Same page, same "Event info" region, same label/value layout, so **one parser serves both accounts**. Differences:

- **No competition counts at all** (no responded / sent quotes / active lines) on either lead. Membership-dependent
  (the page offers "Upgrade to see it now"). So R358's "displayed count" exists only on music-account leads; for
  business-account leads the count is absent, not zero.
- **Phone masked** (`(xxx) ***-****`) or missing entirely, with "Phone number revealed after booking". Drop it either way.
- **More optional labels:** `Details:` (the client's own free text: the richest field), `Group size preferred:`
  (`N person`), `Expenses covered:`, `Performance area size:`, `Song requests:`.
- The two accounts' inboxes hold **different gig ids**: a lead belongs to one account's portal (the earlier finding
  that lead emails land in both mailboxes is about email, not the portal).

## Parser rules that follow

- Unknown labels are kept as extra details (GigSalad adds fields); a missing optional label is absent, never guessed.
- Competition: quotes-sent count when shown; **absent** (not 0) when the page shows none.
- Phone: never extracted, masked or not.

## Open before building

1. Email → gig id mapping (above).
2. A lead that has never been answered (all four pages read had replies); the thread may differ.

## Opening a lead marks it read (measured 2026-10-05)

Known-answer test, business account, with Alex: Alex marked one old, already-handled lead unread. The inbox's
Unread view (`/promokit/inbox-unread`) listed exactly that one lead. The app then opened it once through its real
read path (`fetchGigSaladLead`, read-only, no click). Afterwards the Unread view was **empty**. So the app reading a
lead's page marks it read in Alex's GigSalad inbox. Still unknown: whether the client sees anything (e.g. "viewed")
and whether it affects GigSalad response-time stats. Useful for later: `/promokit/inbox-unread` lists unread leads
without opening them, so the app can tell which leads Alex has not seen yet.
