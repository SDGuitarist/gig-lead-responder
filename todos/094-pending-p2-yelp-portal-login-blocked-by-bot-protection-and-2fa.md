---
status: pending
priority: p3
issue_id: "094"
tags: [yelp, portal, login, module-1, phase-0]
dependencies: []
unblocks: []
sub_priority: 1
---

# 094: Yelp portal login is blocked (bot protection, then email 2-step verification)

## Problem Statement

`YelpPortalClient.fetchLeadDetails` (`src/automation/portals/yelp-client.ts`) cannot log in to Yelp Biz, so every Yelp lead
that needs portal enrichment is held ("Yelp enrichment failed: Login failed — may need manual auth").

Measured 2026-10-15 (lead #17, Gmail message 1a13bd8fa0454331, run with `scripts/ingest-one.ts`):
- The app's headless browser profile (`data/browser/yelp`) gets HTTP 403 and a blank page on `https://biz.yelp.com/login`
  (title "yelp.com", no inputs). Screenshot: `logs/screenshots/yelp-fetch-login-fail-*.png`.
- A visible (headed) Chromium on the same profile also got 403, then `?dd_referrer=` in the URL (DataDome bot protection).
- Alex: the login then sends a 2-step verification email, and the link opens in his regular browser, outside the
  automated session. The app's browser cannot finish it unattended.
- The Yelp password in `.env` was never the failing part: the form never rendered.

MEASURED 2026-10-16 (step 1 below, done): 10 past Yelp leads (2026-08-20 to 2026-10-05) were compared, email vs Yelp Biz page, by a
read-only helper in Alex's regular browser; plus Sophia (2026-10-14) by me. All pages loaded logged in. Result: **0 of 11 had
client content hidden from the email.** 6 of 10 carry client free text (the "Are there any other details you'd like to share?"
answer) and the email's plain text already holds it (I verified one, Jade, by reading the email myself: the full text,
guest count and budget are in it). Sophia, Jann, Erika, Michael, Eric did not answer that question. One difference: Madalyne
updated her details after the first email, so the page held a later version. The page adds only a created time and, on some leads, a
phone number. These counts come from the helper's report and are not re-checked by me beyond Jade; sample = every Yelp
"requested a quote" email in the last 90 days.
**So the premise "Yelp emails truncate client messages" does not hold for the current email format, and the portal login is not what
blocks the leads: the parser is (todo 096).** This todo drops to "park it" unless a later lead shows hidden text.

## Proposed approach (a plan to write; Alex decides)

1. ~~Measure first~~ DONE 2026-10-16 (see above): 0 of 11 hidden. Re-run the sample only if the email format changes or a lead shows text the email lacked.
2. Options if it does matter: (a) keep scraping and solve verification by hand once so the profile keeps the session,
   expecting it to expire; (b) stop scraping and treat Yelp as "held, read it on Yelp" explicitly; (c) look for another
   source of the full message (Yelp's own API or forwarding). Do not retry logins repeatedly: bot defenses can escalate
   against the business account.
3. Whatever is chosen, the HOLD must say why in plain words, and the status file must name it.

## Owner and trigger

Alex decides the option; Claude measures step 1. Trigger: before the 20-lead review-only ramp, because Yelp leads in
the ramp would all be held. Related: `docs/END-TO-END-STATUS.md` (GigSalad logins are the same class of gate).
