# Win-rate baseline (plan §0.6), last 12 months: 2025-10-10 .. 2026-10-09

**Reader and trigger:** the Module 1 success measure ("win rate above the 0.6 baseline at 3 months",
`docs/plans/2026-10-02-booking-hub-roadmap.md`), read when Module 1 has run 3 months; and
`docs/END-TO-END-STATUS.md` (0.6 row). **Status: PARTIAL**: Yelp is missing (below).
Collected 2026-10-09 by Claude Code, read-only, with Alex's go-ahead. Counts only: no client names are recorded.

## 1. GIG Calendar ("Alex's GIG Calendar", Google Calendar), events starting in the window

| What | Count |
|---|---|
| All events | 100 (no next page; cross-checked: a separate Jan–Oct 2026 query matched month by month) |
| Recurring teaching (lessons, ukulele/guitar clubs) | 49 (not gigs) |
| One-off titled "GIG…" | 21 |
| Other titles that are clearly performances (a library performance; two Oct gigs whose titles start with a ⚠️/✅ marker) | 3 |
| **Paid performances (confirmed)** | **24** |
| Unpaid performances (Alex, 2026-10-09): "December Nights: Spanish Village", "JFGM Dream of Niwa Bridal Show" (Nov 9), "Japanese Friendship Garden" (Dec 7), "Onyoku Sessions" (all Onyoku sessions are unpaid) | 4 (not wins) |
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

## 2b. GigSalad, account `alex@alexguillenmusic.com` (business; Alex signed it in 2026-10-09)

| Folder | Threads in window | Status breakdown (in window) |
|---|---|---|
| Inbox "All" (3 pages, 44 rows, 0 unparsed) | 44 | Event date passed 23 · No longer available 8 · Message sent 7 · Message read 4 · **Booked 1** · Declined lead 1 |
| Archived (1 page, 8 rows) | 8 | Declined lead 8 |
| **Total lead threads** | **52** | **Booked on GigSalad: 1** ("Booked gigs" page: 1 total, 1 in the window) |

By month (inbox + archive): 2025-12: 3 · 2026-01: 3 · 02: 9 · 03: 4 · 04: 8 · 05: 5 · 06: 5 · 07: 5 · 08: 4 ·
09: 2 · 10: 4.

**Both GigSalad accounts: 247 lead threads, 3 marked booked.** Possible overlap: a client who contacted both
profiles counts once per account; not de-duplicated (names were never read).

**Why GigSalad's "Booked" is not a win count (Alex, 2026-10-09):** "I try to move everything off platform and hardly
ever book anything on the platform." Wins must come from the calendar (or another source of truth), with each gig
attributed to its lead source. That attribution does not exist yet: a design question for Module 1's win-rate
measure.

## 3. Missing (owner, trigger)

| Source | Why missing | Needed |
|---|---|---|
| Yelp business dashboard | The Claude in Chrome extension denies `biz.yelp.com` (site permission) | Alex allows the site in the extension, or reads the 12-month lead and booking counts |
| GigSalad "date = received or last activity?" | Not verified | Open question; one way to check is a known recent lead whose received date is known |
