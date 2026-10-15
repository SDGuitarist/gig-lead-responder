---
status: pending
priority: p2
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

Not yet known: how many real Yelp leads carry hidden message text. The one lead checked (Sophia, 2026-10-14) had none:
the Yelp page held only date and zip, no event type, no free text. So the cost of this block is unmeasured.

## Proposed approach (a plan to write; Alex decides)

1. Measure first: sample 10 to 20 past Yelp lead emails against the Yelp Biz pages (Alex's regular browser) and count how
   many hold message text the email lacks. If it is rare, the block may not matter.
2. Options if it does matter: (a) keep scraping and solve verification by hand once so the profile keeps the session,
   expecting it to expire; (b) stop scraping and treat Yelp as "held, read it on Yelp" explicitly; (c) look for another
   source of the full message (Yelp's own API or forwarding). Do not retry logins repeatedly: bot defenses can escalate
   against the business account.
3. Whatever is chosen, the HOLD must say why in plain words, and the status file must name it.

## Owner and trigger

Alex decides the option; Claude measures step 1. Trigger: before the 20-lead review-only ramp, because Yelp leads in
the ramp would all be held. Related: `docs/END-TO-END-STATUS.md` (GigSalad logins are the same class of gate).
