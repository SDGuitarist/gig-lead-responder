# Win-rate baseline (plan §0.6), last 12 months: 2025-10-10 .. 2026-10-09

**Reader and trigger:** the Module 1 success measure ("win rate above the 0.6 baseline at 3 months",
`docs/plans/2026-10-02-booking-hub-roadmap.md`), read when Module 1 has run 3 months; and
`docs/END-TO-END-STATUS.md` (0.6 row). **Status: PARTIAL**: GigSalad account 2 and Yelp are missing (below).
Collected 2026-10-09 by Claude Code, read-only, with Alex's go-ahead. Counts only: no client names are recorded.

## 1. GIG Calendar ("Alex's GIG Calendar", Google Calendar), events starting in the window

| What | Count |
|---|---|
| All events | 100 (no next page; cross-checked: a separate Jan–Oct 2026 query matched month by month) |
| Recurring teaching (lessons, ukulele/guitar clubs) | 49 (not gigs) |
| One-off titled "GIG…" | 21 |
| Other titles that are clearly performances (a library performance; two Oct gigs whose titles start with a ⚠️/✅ marker) | 3 |
| **Performances (confirmed)** | **24** |
| Ambiguous, Alex to classify ("December Nights: Spanish…", two Japanese Friendship Garden events, "Onyoku Sessions") | 4 |
| Calls, appointments, webinars | the rest |

This counts gigs from EVERY source (GigSalad, Yelp, direct, agencies, referrals), not GigSalad wins.

## 2. GigSalad, account `alex.guillen.music@gmail.com` (the signed-in account, read from `/promokit/account`)

Threads whose inbox date falls in the window. **The inbox date is probably the thread's last activity, not
the day the lead arrived (unverified)**, so treat this as approximate.

| Folder | Threads in window | Status breakdown (in window) |
|---|---|---|
| Inbox "All" (`/promokit/inbox`, 13 pages, 243 rows total, 0 unparsed dates) | 133 | Event date passed 63 · No longer available 34 · Declined lead 12 · Message read 11 · Message sent 5 · Waiting on quote 3 · **Booked 2** · Removed 1 · Quote read 1 · Quote expired 1 |
| Archived (`/promokit/inbox-archive`, 225 pages, 1,660 rows since 2014, 0 unparsed) | 62 | Declined lead 55 · Event date passed 5 · No longer available 2 |
| **Total lead threads** | **195** | **Booked on GigSalad: 2** |

By month (inbox + archive): 2025-10: 10 · 11: 8 · 12: 8 · 2026-01: 15 · 02: 16 · 03: 13 · 04: 24 · 05: 22 ·
06: 23 · 07: 15 · 08: 17 · 09: 12 · 10: 12.
"Booked gigs" page (`/promokit/gigs`): 16 gigs since 2017, **1** with an event date in the window.

**GigSalad's "Booked" status undercounts wins.** 2 booked threads vs 24 calendar performances: bookings
finalized off-platform or never marked booked do not show. A win rate from GigSalad status alone would be
wrong. The Module 1 baseline needs a source attribution per calendar gig, or Alex's estimate.

Method (reproducible, read-only): in a signed-in tab, fetch each inbox page (`/promokit/inbox`,
`/promokit/inbox/N`; same for `/promokit/inbox-archive`), parse `a.inbox__table-row`, take the date at the end
of `.inbox__table-cell--from` ("Oct 8" = 2026; "10/08/25" = MM/DD/YY) and the text of
`.inbox__table-cell--status`. Names were never returned.

## 3. Missing (owner, trigger)

| Source | Why missing | Needed |
|---|---|---|
| GigSalad account `alex@alexguillenmusic.com` | The browser is signed in to the music account; Claude cannot type passwords | Alex signs in to the business account in the same Chrome, then the same method runs |
| Yelp business dashboard | The Claude in Chrome extension denies `biz.yelp.com` (site permission) | Alex allows the site in the extension, or reads the 12-month lead and booking counts |
| Calendar: 4 ambiguous events | Titles don't say | Alex: paid gigs or not? |
| GigSalad "date = received or last activity?" | Not verified | Open question; one way to check is a known recent lead whose received date is known |
