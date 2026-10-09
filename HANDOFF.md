# HANDOFF -- Gig Lead Responder

**Date:** 2026-10-05
**Branch:** `feat/hub-phase0` (cut from `docs/booking-hub-brainstorm` at `c644210`; pushed; not merged)
**Phase:** Work, Phase 0 **in progress**. 0.1, 0.2 (code), 0.3 (all but the alert half of `invalid_grant alerts`), 0.4, S1, S1-adv done. **0.5 port: 29 TO PORT remain.** 0.6 blocked. **GigSalad portal reading BUILT.** Module 1 not started.

## START HERE — pricing session (2026-10-05..07)

**State:** branch `feat/hub-phase0`, pushed. Suite: **679 pass / 0 fail / 1 skip**.

**CLOSED reviews this session (all of them; none open):** R358 competition count (R3 GO, authorized); R292
holiday/peak hold (R2 test fix, no R3 per Alex); $150 minimum profit R295/R362 (R2 GO); written-price check
(R3 GO, authorized); duo $600 minimum profit (R2 unreachable, closed with pinning test per Alex); no 1-hour duo
(R3 GO, authorized). Records in `docs/reviews/2026-10-05-*` and `docs/reviews/2026-10-07-*`.

**Built:**
- R358: GigSalad's displayed competition count is authoritative only on a parsed page (`gigsaladPage`).
- R292: Valentine's, Cinco de Mayo, Mother's Day, Fourth of July, NYE leads HELD (`holiday_peak:`), no price.
- R058/R072/R104: no T1 below-floor exception; **written-price check** (`src/pipeline/post-check.ts`
  `belowFloorPrices`/`dollarAmounts`): a draft stating a dollar figure below the floor that the app did not supply
  is held; the client's stated budget is NOT exempt (Alex); budget gap exempt; both drafting paths.
- R295 (+ R362 half): `minimumProfitHold` (`src/pipeline/price.ts`): sourced profit = price + travel fee
  (unless included) - $200/hr x musicians - stipend, < $150 held, scoped alternative too; T1 duo / flamenco duo
  3h+ held. Trio/mariachi/bolero NOT checked (no cost data). Note kept out of drafting prompts.

**Written-price check — CLOSED (R3 GO, authorized by Alex).** Threshold is the price the client is told (quote, or
quote+travel): any unsupplied figure below it is held (Alex option c, 2026-10-07); a malformed amount is held as
unreadable. Records `docs/reviews/2026-10-07-draft-price-codex-round{1,2,3}.md`. R362 subcontractor half NOT
PORTED (Alex).

**Duo minimum profit at Alex's $600 — DONE, review CLOSED** (R1 NO-GO fixed; R2 NO-GO verified unreachable, closed
by Alex with pinning test `port manifest R295: a scoped alternative is always shorter`, mutation-proven, no R3).
At 2-3h a duo / flamenco duo (and its scoped alternative) is held when price + travel fee - $600 - stipend < $150;
T1 4h+ held. Records `docs/reviews/2026-10-07-duo-profit-codex-round{1,2}.md`.

**No 1-hour duo — DONE, review CLOSED (R3 GO, authorized by Alex).** Alex 2026-10-07: "just like the mariachi"
(both duos). 1-hour rows removed from `DUO_RATES` / `FLAMENCO_DUO_RATES` (`a85930b`): a 1-hour request is booked
and priced as 2 hours (duo T2P $1,100 anchor; no-viable-scope minimum $1000 for 2hr). Sourced duo and solo keep
1 hour. New post-check rule `priced_hours_` (`e03816e`, narrowed `81d1568`): on an ordinary quote where pricing
rounded the request up, both drafts must state the priced hours, or the lead is held (skips residency, graceful
decline, no-viable-scope, clarification; asked hours must be > 0). Records `docs/reviews/2026-10-07-duo-2h-*`.

**R300-R302 structured price line — DONE, review CLOSED.** Alex 2026-10-09 chose his own replies' format
("[Format], $[price], [hours] hours", included clause only on formats he performs, every tier, no extension price).
`clientTotal()` (price.ts) is the one client-facing total everywhere (header, budget modes, price line, residency
series, post-check). R1/R2/R3 NO-GO (R2 and R3 each run twice: Claude + Alex); the HARD CAP fired after R3; Alex
chose to fix the last finding (residency series + travel, `1fba7c4`) and ship with no further Codex round.
Records `docs/reviews/2026-10-09-price-line-codex-round{1,2,3}.md` (round 2 carries a correction: Claude wrongly
called the residency-series case unreachable). Dual-format mariachi with a fee: unreachable, left as is.

**Known gaps:** trio/mariachi/bolero minimum profit unchecked (no cost data); holiday hold reads the model's
`event_date_iso`; written amounts spelled out in words are not read.

**Remaining TO PORT (19):** T4/NP (R403, then F1 R020-R025). Other: R006, R081-R089 + R405 (PF-Intel
production data, ask first), R329, R398 (later module).

### Three Questions (pricing session)
1. **Hardest implementation decision?** The written-price exempt list: every exemption is a hole, and the two most
   tempting ones (the client's budget, a floor-only threshold) were exactly where Alex found the gaps.
2. **Considered changing but left alone?** Parsing amounts spelled out in words, and checking above-quote figures:
   both trade many false holds for rare catches.
3. **Least confident going into the next phase?** None of these checks has met a real model draft; the dollar
   reader's false-hold rate on real replies is unmeasured.

### Prompt for Next Session

```
Work in /Users/alejandroguillen/Projects/gig-lead-responder.
FIRST gate (stop and ask Alex if anything differs):
  pwd; git fetch origin; git branch --show-current          # expect: feat/hub-phase0
  git rev-parse HEAD; git rev-parse origin/feat/hub-phase0  # expect: identical
  git status --short                                        # expect: clean
Read: HANDOFF.md "START HERE — pricing session", CLAUDE.md.
No Codex review is open. Every pricing review this session is CLOSED. ONE answer from Alex is pending (Alex's catch
2026-10-09): the residency-series fix `1fba7c4` makes a series with a travel fee "$1,250 per night" (travel EVERY
night, ~$600/month extra for a weekly venue), decided as a consistency fix, not a pricing decision; no doc covers
recurring travel. Options: (a) travel every night (as built), (b) none for recurring, (c) base per night and
travel arranged separately per venue (Claude's recommendation; residency leads are always held). Build nothing on
it until he answers.
Next pricing group: T4 / NP tiers (R403, then F1 R020-R025). Pull the Project's numbers from ~/Data/gig-lead-responder/
(several are "to be set" in the source) and SHOW ALEX EVERY PRICE BEFORE WRITING CODE; no new or changed price
without his explicit OK.
One concern per commit, failing test first, commit only on a green suite; npm run test:match (exit 3 = zero matches).
Codex: `codex exec -s workspace-write "..." < /dev/null`; check git status after; record every verdict in docs/reviews/.
HARD GATE: never start the Mac poller or server against real mail. Never open data/leads.db from a test.
STOP and ask Alex before: any real send; any GigSalad click or opening GigSalad/Yelp lead pages; Full Disk Access;
any change to .env or production data; any new or changed price. Do not start Module 1. Update HANDOFF.md before stopping.
```

## Earlier: R358 + holiday/peak session (2026-10-05)

### Three Questions (R358 + holiday session)
1. **Hardest implementation decision?** What counts as trusted provenance for the competition count: line text,
   then the caller's platform, then "this text is a parsed page". Each Codex round narrowed it one step.
2. **Considered changing but left alone?** The parser accepting any client-typed `Label:` line (a fake
   `Competition:` line can still reach the MODEL; the check now holds that case). A label allow-list is broader work.
3. **Least confident going into the next phase?** The holiday hold depends on the model extracting the event date;
   nothing checks the date on non-GigSalad leads.

### Prompt for Next Session

```
Work in /Users/alejandroguillen/Projects/gig-lead-responder.
FIRST gate (stop and ask Alex if anything differs):
  pwd; git fetch origin; git branch --show-current          # expect: feat/hub-phase0
  git rev-parse HEAD; git rev-parse origin/feat/hub-phase0  # expect: identical
  git status --short                                        # expect: clean
Read: HANDOFF.md "START HERE — R358 + holiday/peak session", CLAUDE.md, docs/reviews/2026-10-05-holiday-codex-round2.md.
Two questions are with Alex (HANDOFF): the drafted-price check design (a/b), and the $150 minimum profit
(duo cost model, T1 duo 3-4h, formats covered). Get his answers before any code. No new or changed price without his explicit OK.
One concern per commit, failing test first, commit only on a green suite; npm run test:match (exit 3 = zero matches).
Codex: `codex exec -s workspace-write "..." < /dev/null` (without </dev/null it waits on stdin forever); check git status after.
HARD GATE: never start the Mac poller or server against real mail. Never open data/leads.db from a test.
STOP and ask Alex before: any real send; any GigSalad click or opening GigSalad/Yelp lead pages; Full Disk Access;
any change to .env or production data; any new or changed price. Do not start Module 1. Update HANDOFF.md before stopping.
```

## Earlier: end of the residency + GigSalad session (2026-10-04/05)

**State:** branch `feat/hub-phase0`, pushed. Suite on the Mac: **628 pass / 0 fail / 1 skip / 0 todo** (2026-10-05).
Codex CLI runs reviews with `-s workspace-write` (16 tests sandbox-blocked, Mac-only); check `git status` after.
Commits are gated on a green suite (`a2ee091` was pushed red once; fixed `221c738`).

**Reviews (all records in `docs/reviews/`):**
- **Residency** (`c047b49..fbb00f6`): R1 NO-GO (1 P1, fixed), R2 **GO**. CLOSED.
- **GigSalad portal reading** (`a86b7f4..3828dfb`): R1 NO-GO (5 P1 + P2, all fixed), R2 NO-GO (1 P1 + P2, fixed),
  R3 (authorized by Alex) = **(c) narrowing residue: the HARD CAP FIRED** (slash phones). Alex chose a different
  approach for contact scrubbing (below). Everything else in that range was confirmed fixed by Codex.
- **Contact scrubber, new approach** (`cc96a0e..250b857`): R1 NO-GO (time-line leak, fixed), R2 NO-GO (P2 test only;
  leak CONFIRMED CLOSED). Alex: fix the test, no round 3 → `095cba0` (4 mutation-proven tests, not Codex-reviewed).
  CLOSED.
- **Startup login check + browser-job bounds** (`5c7a9e3`..`2c8db39`): R1 NO-GO, R2 NO-GO, R3 (authorized) **GO**.
  Every GigSalad browser job takes turns per account profile, 60 s limit, a timed-out browser is killed (pgrep/pkill on
  its `--user-data-dir`, with `--`) before release; a whole GigSalad lead read is capped at 90 s.
- **Live login status** (`5649f6d`..`dab4718`): R1 NO-GO, R2 NO-GO, R3 (authorized) **GO**. Every GigSalad lead's
  inbox reads refresh `/health` (ordered by read tickets) and print the loud line once per change.
- **"Mark as unread"** (`ba232b4`..`e8df37f`): R1 NO-GO (one-page proof; opened page not restored), R2 **GO**. After the
  app opens a lead page it clicks that lead's own "Mark as unread" (exact single button in this lead's form) and
  proves it: in `/promokit/inbox-unread`, and the WHOLE `/promokit/inbox-archive` walked without it. Every opened
  (or maybe-opened) page is restored; a failed restore is a notice, never a retried lead. The app's only GigSalad
  click (pinned in `src/send-surface.test.ts`). Proven live on one test lead with Alex's OK.
- **No review is open.** One flaky full-suite failure (1 of 8 runs, not reproduced) led to `92e2358`.

**Built (residency):** R099 setup space; classify `engagement_type`/`residency_tier`/`residency_cadence`/`price_asked`;
`RESIDENCY_RATES` R2/R3 (Alex-approved); every residency HELD; residency drafting states a per-night number only when
the venue asked and a rate exists; non-solo recurring = series at the private price, no discount.

**Built (GigSalad, `docs/research/2026-10-04-gigsalad-lead-page.md`):** a GigSalad lead email (first name, event type,
date, time only) → `findGigSaladLead` matches it in BOTH accounts' inboxes (option A) → `fetchGigSaladLead` reads the
lead page with that account's own app login (landed page must be exactly that lead) → the page must agree with the
email (name, type, date, time window) → the pipeline runs on the page's details. Any doubt HOLDS with the reason on
the dashboard. Contact data: one rule (any letter-free stretch with 7+ digits is a phone; money/times/dates exempt;
emails removed; names letters only). **GigSalad posting is REFUSED** in `dispatchReply` (Alex replies himself).
Startup: the poller checks both logins once and says loudly if one expired; `/health` shows `gigsalad`.

**Alex decided (2026-10-04/05):** GigSalad read from the lead page; app login option 1 (`npm run gigsalad:login --
music|business`, Alex signs in himself, no password stored; **both signed in and verified per account**); matching
option A (no tracking-link click); one expired login does not hold the other account's leads; business pages show no
competition count → kept at anchor; R285 Encuentro NOT PORTED; residency numbers/holds as above; no residency
deposit; after the GigSalad cap: a different scrubber approach; scrubber: no round 3; login alert: startup check only.

**Alex decided 2026-10-05 (answered):** opening a GigSalad lead marks it read (MEASURED); Alex chose option A: the app
puts every lead it opened back to unread (built and reviewed GO, above). Still unknown: whether the client sees a
"viewed" signal when the app opens a lead (not visible from Alex's side). Alex's test lead (business) is unread again.

**Known gaps (owner Claude unless said):**
- **Expired GigSalad login is not pushed to Alex** (startup check + live status on /health and the log; no push).
  Trigger: Module 1's alert channel (named requirement). Same channel: system-skipped follow-ups, invalid_grant.
- A held GigSalad lead is marked processed: not retried after Alex signs in again (stays on the dashboard).
- Remaining identity risk (option A): two leads with the same first name, event type, date AND time window, with
  the real one absent from both inboxes. Closing it needs the tracking link (Alex declined).
- Scrubber residue: a phone number spelled out in words. Fail-closed cost: e.g. "1500-2000" in Details is removed.
- `engagement_type`/`price_asked` and all GigSalad drafting are UNEXECUTED on a real model/lead.
- Poller retry counter not restart-proof (deferred); migration v3 runs on the real data/leads.db at next server
  start (backup first).

**Remaining TO PORT (28 after R358):** pricing group (Alex: Project numbers, shown before commit): holiday/peak + context
modifiers (R058/R072/R104/R292), $150 minimum profit (R295/R362), quote formatting by tier (R300–R302), T4/NP
(R403, then F1 R020–R025). Other: R006 (design + paid model runs), R081–R089 + R405 (PF-Intel production data, ask
first), R329, R398 (later module). R358 PORTED 2026-10-05 (review closed GO, see top).

### Three Questions (residency + GigSalad session)
1. **Hardest implementation decision?** Contact scrubbing. A list of phone separators lost three review rounds in a
   row; Alex chose one rule (letter-free stretch with 7+ digits) whose gaps cost detail instead of leaking, with
   strict allow-listed safe shapes (money, times, dates) so an exemption cannot shield a phone.
2. **Considered changing but left alone?** Posting replies on GigSalad (refused outright instead; Alex replies) and
   retrying held GigSalad leads automatically after a re-login (needs Module 1's hold/alert design).
3. **Least confident going into the next phase?** None of the GigSalad path has run on a real incoming lead email
   end to end (only read-only page checks and synthetic emails); the first real lead may expose an email wording or
   page shape not seen in the 4 leads read.

**Next phase (Claude's recommended first move, Alex agreed 2026-10-05):** R358 first. The chain may already exist:
the GigSalad page parser emits "Competition: N quotes sent by other members" (music account) or "not shown
(unknown)" (business); classify's COMPETITION EXTRACTION RULE reads the displayed count; classify-verify's
parseQuoteCount holds a lead whose model count disagrees (probed 2026-10-05). Prove it with a test from page text
to the hold, then mark R358 PORTED (manifest test must pass). Then the next pricing group (Project numbers shown
to Alex before any code).

### Prompt for Next Session

```
Work in /Users/alejandroguillen/Projects/gig-lead-responder.
FIRST gate (stop and ask Alex if anything differs):
  pwd; git fetch origin; git branch --show-current          # expect: feat/hub-phase0
  git rev-parse HEAD; git rev-parse origin/feat/hub-phase0  # expect: identical
  git status --short                                        # expect: clean
Read: HANDOFF.md "START HERE" section, CLAUDE.md, docs/research/2026-10-02-booking-hub/port-manifest.md (row R358).
No Codex review is open. First move: R358. Write a failing test that goes from a music-account GigSalad page text
(parseGigSaladLeadPage, invented fixture) through classify-verify (verifyClassificationHeuristics): the displayed
"quotes sent" count is in rawText, a matching model count passes, a different one is held, and a business page
("not shown (unknown)") raises nothing. Build only what the test shows is missing, then mark R358 PORTED with its
marker and test (npm run test:match -- "port manifest" must pass). Then the next pricing group: pull the Project's
numbers from ~/Data/gig-lead-responder/ and SHOW ALEX EVERY PRICE BEFORE WRITING CODE.
One concern per commit, failing test first, commit only on a green suite; npm run test:match (exit 3 = zero matches).
For each finished range: Codex round 1 via `codex exec -s workspace-write` (check git status after), record every
verdict in docs/reviews/. Never put source text, client names or contact data into the public repo.
HARD GATE: never start the Mac poller or server against real mail. Never open data/leads.db from a test.
STOP and ask Alex before: any real send; any GigSalad click or opening GigSalad/Yelp lead pages; Full Disk Access;
any change to .env or production data; any new or changed price. Do not start Module 1. Update HANDOFF.md before stopping.
```

## 2026-10-03 evening (session 0153v273) — port review #2, round 2 fixes + two Alex money fixes

- **Codex round 2 = NO-GO** (2 findings), recorded `84eedb3` → `docs/reviews/2026-10-03-port-pricing-codex-round2.md`.
  Second NO-GO: automatic review iteration has STOPPED. Round 3 only with `Round 3 authorized by Alejandro: YES`.
- `e23baf4` **classify**: `stealth_premium`, `competition_quote_count`, `format_requested`, `event_energy`,
  `venue_name`, `client_first_name` now parse or reject (was: `{}` venue → `TypeError ... trim`). Test `classify parse`.
- `e575b0c` **manifest**: a PORTED row's named test must assert its marker; conditional rows must assert absence.
  It caught 16 rows; fixed. R078/R079/R094/R097/R369/R406 are prompt rules the model applies: UNEXECUTED until a real lead.
- `5f4ce51` **(Alex) RESPONSE_CRAFT** no longer names duo/trio/quartet/5-piece prices (T2P-only, wrong for D leads).
  Test `always-loaded docs state no prices except reviewed non-quote figures` ($500, $1M/$2M COI, $4,000 lead size).
- `3ea5e64` **(Alex) Tier A venue hold**: a lead naming a Tier A venue priced below T3 (or without the premium flag)
  is held, naming the venue. One list `src/data/venues.ts` feeds the prompt and the check. Dropped from the old code
  list (not Tier A in the prompt): Westgate, bare "Torrey Pines". Test `tier A venue hold`.
- Suite 495 pass / 0 fail / 4 skip; `tsc` clean; `git diff --check` clean. Not pushed.
- **Open, not reviewed by Codex:** `5f4ce51` and `3ea5e64` (both outside the round-2 fix prompt, both Alex's calls).
  Still open from Claude's mistaken pass, low severity: follow-up prompt and dashboard show requested hours, not
  priced hours (`src/prompts/follow-up.ts:32`, `src/utils/shape-lead.ts:47`); range pattern flags
  "$2,700 — 200 guests" (fails closed: held).

### Three Questions
1. **Hardest implementation decision?** R094/R097: Codex asked for a runtime test of venue signals, but the model
   applies them; no code seam exists. Chose a truthful condition + UNEXECUTED label over a fake-model test.
2. **Considered changing but left alone?** Forcing T3 for Tier A venues in code: it changes prices; Alex chose hold.
3. **Least confident going into review?** The Tier A hold may hold more real leads than expected (any model that
   picks T2 for a Tier A venue); no real lead has been run.

**Round 3 = GO (Alex authorized it). Review #2 is CLOSED** (`docs/reviews/2026-10-03-port-pricing-codex-round3.md`).
The port's files are no longer frozen by review #2.

**BUILT 2026-10-04: requests between card lengths round UP** (`lookupPrice`; test `duration rounds up`). Above the longest
card length it stays at the longest. Also fixed by it: solo/duo have no 1.5 h row, so 1.5 h was priced as 1 h; now 2 h.
Not executed on a real lead or Codex-reviewed.

**2026-10-04, same session: R320 graceful decline PORTED** (`41d1e4c`, `bcc222b`): classify sets `graceful_decline`
(fit mismatch or sensitive moment); the lead is always held; generate gets the GRACEFUL DECLINE MODE block (order:
one-sentence acknowledgment, format honesty, price, specific exit); verify §7d, a "Graceful decline failed" reason
always fails the gate; the post-check lets the two look-elsewhere exit patterns through in decline mode only.
**Also fixed:** hold notes (`classification_verify:`, `graceful_decline:`) rode in `flagged_concerns`, so generate was
told to "address" e.g. "Tier A venue ... priced at T2" in the client draft. Now `withoutHoldNotes` keeps them out of
generate and verify; the router still holds on them. Test `internal hold notes never reach the draft or the gate`.
Suite 504 / 0 / 4, `tsc` clean. Commits `c4273f5` onward are NOT pushed and NOT Codex-reviewed.

**Remaining 56 TO PORT, and why none was built:** R018/R266/R272 (strategic reserve: must be stored with the lead,
`src/db`; was frozen by review #1, UNBLOCKED 2026-10-04); R358 code half (GigSalad parser in `src/automation`; UNBLOCKED
2026-10-04); R006 (needs a
design pass + live drafting runs, per its row); group 5 needs Alex's numbers; group 6 other repos/data.

**2026-10-04, later (session 0153v273): review #1 closed, then R018 + a poller fix. NOT Codex-reviewed, not pushed past `79929a0`:**
- `606b49a` **migration v3** (Alex approved): `leads.strategic_reserve_json`. ⚠ It applies to the REAL `data/leads.db` the next
  time the server starts (backup `data/backups/pre-v3.db` first).
- `7be518e`, `f56aa8f` **R018/R266/R272 strategic reserve PORTED**: generate banks up to 3 unused insights (never a
  price), both save paths store them, follow-up n builds on the n-th one. Model quality UNEXECUTED.
- `e887ec4` **(Alex flagged) auth detection**: the poller stopped for good on ANY error text containing "401"; now it
  reads the HTTP status and `invalid_grant`. Also fixes the reverse (a real 401 without the digits was missed).
- Suite 527 / 0 / 4.
- ⚠ **FINDING (2026-10-04, 3 real GigSalad "New lead" emails, both mailboxes, read-only; HTML checked too):** the
  email holds ONLY the client's first name, event type, date and time window, plus a "View the details & reply" link.
  **No quote count, budget, guest count, genre or message.** `src/automation/parsers/gigsalad.ts` expects those fields
  (its fixtures are hand-written: "Quotes received: 4"), so on a real email the pipeline would classify from one
  sentence. Consequences: R358's code check has no displayed count to compare against (the email never shows one);
  real GigSalad lead details live only on the GigSalad page (portal enrichment = Alex's call: "reading GigSalad
  dashboards" is on the ask-first list). R358 NOT built. Needs Alex's decision before more GigSalad work.
  **Also:** every link in the real email is a `tracking.gigsalad.com` redirect (8 in the one checked; 0 `www.gigsalad.com`
  links), and all three `extractPortalUrl` patterns require `www.gigsalad.com`, so a real lead gets no `portalUrl` and
  `gigsaladClient.submitReply` has nowhere to go. Same root: the parser was written against invented emails.
  **Alex 2026-10-04: there are TWO GigSalad accounts** (music email and business email, separate logins), and leads
  from both land in BOTH inboxes. So the same lead can arrive twice, and any portal read or reply must use the
  account the lead belongs to. Portal reading itself is still undecided.
- **Codex round 1 on `79929a0..07a5376` = NO-GO (2 P1 + 1 P2), all fixed** (`4023ef8`, `b7b4754`;
  `docs/reviews/2026-10-04-reserve-auth-codex-round1.md`). Next: round 2 with `-s workspace-write` so Codex runs the
  tests itself (probe: 515/531 runnable there, the 16 others are sandbox-blocked and need the Mac).
- **Round 2 = NO-GO (3 P1), the SECOND NO-GO: automatic iteration STOPPED** (`docs/reviews/2026-10-04-reserve-auth-codex-round2.md`).
  Codex ran the tests itself (`-s workspace-write`): 515 pass, 16 sandbox-only failures. Remaining: follow-up drafts stored
  unvalidated (they go to Alex for approval first, not to clients); drafts and positive signals reach the verify/rewrite
  prompts raw; the reserve's price filter misses forms like "€900", "USD 900", "for 900", and allows 2 sentences.
  **Round 3 authorized by Alejandro: YES** (2026-10-04). Fixed in `700ecfd`, `aabe142`, `0e3882e`; round 3 = the last:
  a NO-GO fires the cap (no round 4; Alex picks: different approach, revert, or accept).
  ⚠ **Known gap (Alex flagged 2026-10-04):** a follow-up draft that breaks the rules is retried, then the scheduler marks
  the lead `skipped`; its "skipped" alert goes through `alertAlex`, which cannot deliver until Module 1, and the
  dashboard shows `skipped` exactly like a skip Alex pressed himself. So a system-skipped follow-up is silent today.
  Pre-existing for any follow-up failure; this change adds one more route into it. Owner Claude; trigger: Module 1's
  alert channel, or sooner a dashboard label for system skips (reason stored on the lead).
- **The app's Gmail token is `alex.guillen.music@gmail.com`** (checked 2026-10-04 with a read-only `getProfile`). Yelp and
  Squarespace leads arrive ONLY there, GigSalad in both, so the poller does see all three platforms.
- `a484455` real redacted lead emails in `examples/emails/` (GigSalad, Yelp, Squarespace): Yelp and Squarespace parse
  as their tests expect; **GigSalad is a `todo` (known gap)**. `2531024`: the test runner now counts todo apart from
  skip (`LEAF_MATCH {..., "todo":1}`), so a known gap never reads as a harmless skip. Suite 534 / 0 / 1 skip / 1 todo.
- Next also: Alex's call on the GigSalad finding.

**Review #3 (round-up + R320 + hold-note filter, `97eec2b..58352b1`): CLOSED, round 2 GO** (round 1 prompt: session scratchpad
`codex-round1-rounding-decline.md`, gate at `58352b1`). **Round 1 = NO-GO, 1 finding (backstop case-sensitive), FIXED**
(docs/reviews/2026-10-04-rounding-decline-codex-round1.md). **Round 2 = GO: review #3 CLOSED**
(docs/reviews/2026-10-04-rounding-decline-codex-round2.md). Its file freeze is lifted. Also get review #1's verdict (unblocks R018 and R358).

**Next phase:** Review.

## 2026-10-03 (session 33bddb35, ~09:10–15:30) — poller cursor, wake, lease, S1-adv, the whole port review

**Supersedes the "Queued" list and the prompt in the section below.** Results are rows in `spikes.md`; port detail is in `port-manifest.md`.

**Part 1 (`72ad079`..`e1fb163`, runtime; under Codex review):**
- **0.3 poller cursor = migration v1** `poller_state`; `pollOnce()` resumes from it; the Gmail list follows page tokens
  (was: first 20 only). `/health` now has `poller.last_success_at`, `poller.auth` (`never`/`ok`/`failed`), `lease.host`.
- **Failed lead retried, not skipped (Alex caught it):** a failure holds the cursor (3 attempts, then `GAVE UP` in the
  log); `processLead` resumes a half-done `received` row instead of dying on `UNIQUE`.
- **0.3 wake catch-up:** `src/wake-watch.ts` (30 s tick, >2 min jump) → `pollNow()` + `kickFollowUpScheduler()`.
- **0.2 same-host lease = migration v2** `runtime_lease`; every poll needs it; `holdsLease()` ready for Module 1.
  **Send sites pinned** by file and count (7), with a planted-call control.
- **0.7 S1-adv PASSED**; **real server booted** with Gmail disabled (migrations, loopback, `/health` observed).
- ⚠ **Incident (my error):** a failing-first test opened the real `data/leads.db` and applied migration v1 (one empty
  table, data unchanged, backup `data/backups/pre-v1.db`). **Alex kept it.** Guard: tests can never open a non-temp DB.

**Part 2 (`0252977`..`83c2ea9`, the port):** every one of the 406 rows reviewed: 197 ALREADY PRESENT, 102 PORTED,
32 NOT PORTED (all approved by Alex), **75 TO PORT**, 0 BLOCKED. What changed in the app:
- **Loaded for drafts now:** Alex's voice spec (`docs/LEAD_RESPONSE_VOICE.md`, every lead); event-arc theory when
  classify sets the new `event_arc`; Bolero playbook for bolero leads. Merged from the Project: PRINCIPLES (read the
  absences), CULTURAL_SPANISH_LATIN (bolero/trova), CULTURAL_CORE (Vehicle), RESPONSE_CRAFT (graceful decline,
  category vs format).
- **Classify:** competition only from the platform's count (else 0); named venue tiers, premium signals, zip 92091,
  red-flag patterns; `event_arc`; `extended_dancer`.
- **Generate:** every quote states the 50% deposit and setup needs (110V outlet, armless chair).
- **Post-check (`src/pipeline/post-check.ts`):** Alex's voice kill list, at most one `!`, and **any battery mention
  fails** (Alex: never mention battery-powered sound; also removed from everything the model sees). Verify names the
  voice judgment checks (hedges, false binary, triads...).
- **Pricing:** all 208 prices on the three Project rate cards now match `src/data/rates.ts`
  (`npx tsx scripts/port-rate-compare.ts`). Added (Alex): full mariachi 35+ miles out uses the card's outside-SD table
  with travel built in; 3-hour flamenco trio with the dancer for 2 hours when the lead asks.
- **Removed from draft context (Alex):** stale price shorthand (QUICK_REFERENCE), range-quote samples + the ranges
  rule (PRICING_TABLES), battery wording; 7 example lines word-swapped so no loaded example fails the post-check.

**Open for Alex:**
- ⚠ **Public repo holds personal contact data:** `docs/venue_intel_seed_data_v2.csv` (venue contacts' names and email
  addresses), pre-existing. Untouched. Removing it from the history is a history rewrite: his call.
- **0.6 baseline is blocked:** GigSalad was not signed in (Claude can't enter passwords) and the permission system
  refused opening the Yelp business dashboard (client personal data). Options: Alex signs in and allows it, or Alex
  reads the numbers himself.
- Codex round 1 verdict (paste it in; record in `docs/reviews/`). Full Disk Access (S3). Module 1 §1.2 redesign (G1).

**⚠ TWO Codex round-1 reviews OUT, separate change sets (record each verdict in `docs/reviews/`):**
- **Review #1 (poller/lease/wake, `2f2ec7d..e1fb163`): round 1 = NO-GO, 4 P1 + 3 P2** (2026-10-04,
  `docs/reviews/2026-10-04-phase0-runtime-codex-round1.md`). **5 fixed, 2 deferred with owner + trigger** (retry counter
  persistence: before unattended overnight runs; invalid_grant alert: after Module 1's alert channel). **Round 2 = GO:
  review #1 CLOSED** (`docs/reviews/2026-10-04-phase0-runtime-codex-round2.md`). Its file freeze is lifted.
- **Review #2 round 1 = NO-GO** (4 findings, `docs/reviews/2026-10-03-port-pricing-codex-round1.md`), all fixed in
  `2c24998`..`68af85b` with tests, plus two Alex-raised money fixes (quoted hours = priced hours; stale PRICING_TABLES
  prices removed). **Round 2 = NO-GO, 2 findings, both fixed** (see the 2026-10-03 evening section above).
  **Round 3 = GO: review #2 CLOSED** (`docs/reviews/2026-10-03-port-pricing-codex-round3.md`).
- **Review #2 (port, pricing, draft rules, `e1fb163..198d94d`):** prompt in the session scratchpad
  `codex-round1-port-pricing.md`. **CLOSED 2026-10-03 (round 3 GO):** its file freeze is lifted and the port is
  unpaused. Review #1 closed 2026-10-04 (round 2 GO), so its files (src/db, src/app.ts, src/server.ts, src/wake-watch.ts,
  src/follow-up-scheduler.ts) are no longer frozen either. No review is open.
- Since the first handoff, groups 1–2 of the queue were done (`9425cb5`..`198d94d`): delivery mode (derived from
  format), Instrument Rule, sourced drafting + sourced integrity (gate backstop in code), compressed draft keeps a fear
  resolution, qualification block, request type + fears pre-work, urgency phrases, present-vs-excellent rubric.
  Manifest now (2026-10-04): 197 ALREADY PRESENT, 121 PORTED, 32 NOT PORTED, 56 TO PORT.

**⚠ Codex round 1 OUT (~13:15):** reviews `2f2ec7d..e1fb163`. Until the verdict is back, do NOT edit `src/automation/`,
`src/db/`, `src/app.ts`, `src/server.ts`, `src/wake-watch.ts`, `src/follow-up-scheduler.ts` (its gate stops Codex if
they move). Nothing in Part 2 touched them. Prompt: session scratchpad `codex-round1-phase0-runtime.md`.

**Fixed (Alex caught it):** `lookupPrice` now always reports the hours it priced (`e0e11fd`).
**BUILT 2026-10-04 (Alex decided 2026-10-03): a request between card lengths ROUNDS UP** (2.5 h → 3 h). See the top section.

**Queued, no Alex needed (next session):** the 75 TO PORT rows, grouped (each row names its destination):
1. **Delivery mode** (R349–R353, R397, R406, R335, R257): a `delivery_mode` classify field (Instrument Rule: guitar
   any style + ukulele = Alex performs) that the loaded Sourced Delivery layer and a sourced generate/verify block key on.
2. **Small prompt gaps:** request type in the reasoning block (R244/R249/R268); urgency phrases (R369); compressed
   draft must keep a fear resolution (R340); qualification-tier block (R341); verify rubric (R256/R258).
3. **Graceful decline code half** (R320): verify checks + `graceful_decline` hold; exempt its exit line from
   `SOFT_REFUSAL_PATTERNS`. **Strategic reserve** (R018/R266/R272). **CULTURAL_CORE for any tradition** (R006).
4. **Code checks:** competition count must equal the platform's displayed count (R358 code half; parser work).
5. **Needs Alex's numbers:** residency R1–R3 + engagement type (R220, R221, R276–R286, R303, recurring rows), T4 and
   NP tiers + `buyer_track` (R403, then the F1 T4 reference lead), $150 minimum profit (R362/R295), context modifiers
   and holiday/peak pricing (R292, R058/R072/R104), quote formatting by tier (R300–R302).
6. **Other repos/data:** venue profiles and venue history in PF-Intel (R081–R089, R405); setup space table (R099);
   negotiation replies (R398, later module); DRAFT_METHOD banner (R329, only if that file is ever loaded).
Add the plan's "port inventory fully accounted" test only when no row is TO PORT.

### Prompt for Next Session

```
Work in /Users/alejandroguillen/Projects/gig-lead-responder.
FIRST gate (stop and ask Alex if anything differs):
  pwd; git fetch origin; git branch --show-current          # expect: feat/hub-phase0
  git rev-parse HEAD; git rev-parse origin/feat/hub-phase0  # expect: identical
  git status --short                                        # expect: clean
Read: HANDOFF.md "START HERE" section, CLAUDE.md, docs/research/2026-10-02-booking-hub/port-manifest.md.
No Codex review is open. Ask Alex for his decision on the two "Waiting on Alex" items before any GigSalad or pricing work.
Then the remaining TO PORT rows that need neither, one concern per commit, failing test first, verify with
npm run test:match (exit 3 = zero matches). For each finished range: Codex round 1 via the CLI with
`codex exec -s workspace-write` (check git status after), record every verdict in docs/reviews/.
Never put source text, client names or contact data into the public repo (fixtures: redact, then verify).
HARD GATE: never start the Mac poller or server against real mail. Never open data/leads.db from a test.
STOP and ask Alex before: any real send; Full Disk Access; reading GigSalad/Yelp dashboards; any change to
.env or production data; any new or changed price. Do not start Module 1. Update HANDOFF.md before stopping.
```

### Three Questions

1. **Hardest implementation decision in this session?** Which kill-list words become code bans. The voice spec says
   cut "just" and "perfect" on sight, but two of Alex's own converted replies use them ("Just say the word", "perfect
   for that"). His real results won: code bans only words he never uses; context words go to verify as judgment.
2. **What did you consider changing but left alone, and why?** Loading DRAFT_METHOD.md and VERIFICATION.md whole.
   Their rules are mostly already in the generate/verify prompts, the April `1bc9cad` commit unloaded them on purpose,
   and their chat banners ("load the next file") would confuse the model. Gaps became named TO PORT rows instead.
3. **Least confident about going into review?** Behaviour no unit test can show: the new loaded docs (voice spec,
   event arcs, merged files) make the generate context much longer, and the stricter post-check (kill list, battery,
   one `!`) may push more drafts into rewrite-then-hold. Neither has been run on a real lead; that needs the Max
   provider (Module 1). Also from part 1: wake and lease are unit-tested only (S6), and the 3-attempt counter is in
   memory, so a crash loop retries forever.

## 2026-10-03 — Phase 0 work session (supersedes the 10-02 "Prompt for Next Session")

**Done (9 commits on `feat/hub-phase0`; evidence rows in `docs/research/2026-10-02-booking-hub/spikes.md`):**
- **0.1 `test:match`**: `scripts/run-tests.mjs`, `scripts/leaf-reporter.mjs`, `scripts/test-files.mjs`. Exit 0/1/2/3 as planned.
  **Deviation found and fixed:** node:test reports a *skipped* test as a pass, so a skipped-only match would have exited 0;
  skips are now counted apart (sentinel `{"pass","fail","skip"}`). `npm test -- --test-name-pattern=X` is now refused (exit 2).
  The parser scaffold became `tests/parsers/parsers.test.ts` on node:test (5 real tests now run; 3 skip for missing fixtures).
- **Test runner can't bill.** ⚠ **Incident:** a failing-first test ran the real pipeline on the shell's `ANTHROPIC_API_KEY`
  (~6–8 billed calls, dry-run, temp DB, nothing sent). The runner now sets a dead key and `ANTHROPIC_BASE_URL`.
  Gap: `node --test <file>` run directly bypasses the runner.
- **0.3 fixed:** orchestrator passes `platform` (`26228a7`); DKIM → **Gmail DMARC pass for the platform's own domain**, with
  real headers from all 3 platforms as the overshoot control (`bc49c49`); dashboard requires creds in every env, binds
  `127.0.0.1`, trust proxy loopback (`2faeacf`). Full suite: **377 pass, 0 fail, 4 skip**; `tsc` clean.

**Found (all in `spikes.md`):**
- **Railway's poller is probably not running** (inference): `/health` shows `rejectedEmails: 0` after 8 weeks up on
  `edc8cfb` (= `main`), and the poller stops itself on `invalid_grant` while `/health` stays "ok". Unverified until the logs are read.
- **The Mac's Gmail token is dead** (`invalid_grant`, file from 2026-05-31). 0.2 step 4 needs a fresh sign-in anyway.
- `railway` CLI is logged out (`invalid_grant`), so 0.2 step 1 is only half done.
- **Merge caution:** `main` → Railway auto-deploy would now bind `127.0.0.1` and fail health checks. Merge only after 0.2 retires Railway.

**Blocked on Alex (nothing here was attempted):**
1. `! railway login`, so Claude can finish 0.2 step 1 (read `AUTO_SEND_ENABLED`, `DRY_RUN`, `GMAIL_TOKEN_PATH`, poller logs).
2. **Travel-fee ZIP table:** the plan says track `data/zip_distances.json`, but the repo is **PUBLIC** and 1,265 ZIP→miles
   rows let anyone triangulate the origin (likely home). Options: commit it anyway / keep it untracked (works on the Mac
   today) / store it in `~/Data`. Not done.
3. 0.2 steps 2–3 (stop Railway, revoke grant), 0.5 file move, S2/G1 real sends, Full Disk Access (S3) — unchanged, need his yes.

**Update 2026-10-03 (later, same day; details in `spikes.md`):**
- Railway: config read (live auto-send was on), deployment removed (`/health` → 404), **GitHub disconnected**.
- Gmail: no grant existed on either mailbox, so nothing to revoke. App published to **"In production"**; Mac re-signed-in
  at 08:21 and verified (`getProfile` → alex.guillen.music@gmail.com). S5 check due **2026-10-11**.
- ZIP table committed (Alex OK'd public); Desktop extraction files moved to `~/Data/gig-lead-responder/`; direct
  `node --test` runs can no longer bill.
- ⚠ **HARD GATE: do NOT start the Mac poller (0.2 step 5).** Drafting still uses the paid API key (`src/claude.ts`), not
  Max. Unblock only via the §1.6 `claude -p` provider or with drafting disabled. Alex also still owes the C1 call.

**Later still (same day):** Twilio fully removed (poller pinned to dry-run; alerts go through `src/alert.ts`, which
reports not-delivered, so dashboard **Approve returns an error** until Module 1; `twilio` package uninstalled).
**G1 FAILED:** Gmail replaces a supplied Message-ID (`spikes.md` G1), so plan §1.2's duplicate-send recovery must be
redesigned in the Module 1 plan before any auto-send. Open for Alex: port questions (a)(b)(c), Full Disk Access (S3).

**Queued** *(SUPERSEDED by the session-33bddb35 section above)*:
- ~~Twilio delete~~ DONE. ~~0.4 migration runner~~ DONE. ~~port questions a/b/c~~ ANSWERED (plan §0.5).
- 0.3 poller cursor = **migration v1** (`poller_state`), then wake catch-up and `/health` fields
  (`poller.last_success_at`, `poller.auth`, `lease.host`), each with its plan test name.
- 0.2 same-host `runtime_lease` (migration v2) + extend `src/send-surface.test.ts` to pin today's send sites.
- 0.7 S1-adv (the §1.6 allowlisted env only).
- 0.5 port: manifest over the 406 rows in `port-inventory.md`; source is now `~/Data/gig-lead-responder/`.
- 0.6 baseline: read-only GigSalad/Yelp dashboards + calendar in Chrome (Alex's accounts; ask first).
**Still needs Alex:** Full Disk Access for the terminal (S3). **Module 1 plan must redesign §1.2** (G1 failed).

### Prompt for Next Session — SUPERSEDED (see the top section)

```
Work in /Users/alejandroguillen/Projects/gig-lead-responder.
FIRST gate (stop and ask Alex if anything differs):
  pwd
  git fetch origin
  git branch --show-current                      # expect: feat/hub-phase0
  git rev-parse HEAD; git rev-parse origin/feat/hub-phase0   # expect: identical
  git status --short                             # expect: clean
  git log --oneline HEAD..origin/main            # expect: empty
Read: HANDOFF.md (2026-10-03 section, all three updates), CLAUDE.md,
  docs/research/2026-10-02-booking-hub/spikes.md, docs/plans/2026-10-02-feat-hub-phase0-lead-replies-plan.md (Phase 0).

Task: continue Phase 0 from the "Queued" list in HANDOFF.md, in order (poller cursor as migration v1 first).
One concern per commit, failing test first, verify with npm run test:match (exit 3 = zero matches).
HARD GATE: never start the Mac poller or server against real mail (drafting still bills the API key).
Railway is retired and disconnected; do not reconnect it. Record results in spikes.md and commit them.
STOP and ask Alex before: any real send; Full Disk Access; reading his GigSalad/Yelp dashboards; any
change to .env or production data. Run claude -p ONLY with the plan's section 1.6 allowlisted environment.
Do not start Module 1. Update HANDOFF.md before stopping.
```

### Three Questions

1. **Hardest implementation decision in this session?** How strict the DMARC check could be without causing another
   Yelp-style outage. Real headers settled it: Gmail reports the *parent* domain (`yelp.com` for `messaging.yelp.com`),
   so the check matches a per-platform DMARC domain list, not the From address's exact domain.
2. **What did you consider changing but left alone, and why?** Committing `zip_distances.json` (a public repo would leak a
   home location; Alex's call), adding `gigs@gigsalad.com` to the allowlist (the tests show it's rejected on purpose:
   payment notices), and deleting Twilio tonight (its creds check is the live-mode gate, so it needs its own careful commit).
3. **Least confident about going into review?** The Railway inference. If Railway's poller *is* alive, it is a second
   writer right now, and every plan step that assumes "Railway is idle" is wrong until the logs are read.

---

*Previous section (2026-10-02 planning), kept for history. Its "Prompt for Next Session" is SUPERSEDED.*

## 2026-10-02 — Booking hub (supersedes "Current State" below for what to do next)

**Goal (Alex):** grow this app into one system for leads, gigs, reminders, contracts, invoices,
payments and COIs, run on his MacBook and drafted with Claude Max.

**Done this session (all docs, no `src/` change):**
- Brainstorm: `docs/brainstorms/2026-10-02-booking-hub-brainstorm.md`, refined once.
- Research: `docs/research/2026-10-02-booking-hub/`. It holds 6 research reports, 6 deepen
  reviews, and the Trio/Ensemble side-by-side.
- Roadmap: `docs/plans/2026-10-02-booking-hub-roadmap.md`, with the decisions, module order and
  success measures.
- Plan (Phase 0 + Module 1, lead replies, deepened):
  `docs/plans/2026-10-02-feat-hub-phase0-lead-replies-plan.md`. `plan:check` reports
  `manual_only`, the expected result.
- The claude.ai Project "Gig Lead Response System 4.0" was extracted and compared against the
  repo. The extraction sits on `~/Desktop` and must move to `~/Data/` before the port (step 0.5).

**Found today, live in production code (fix in Phase 0, not yet fixed):**
- The auto-send path drops `platform` (`src/automation/orchestrator.ts:~130`).
- The DKIM check accepts any domain (`src/automation/source-validator.ts:79-84`).
- The dashboard binds to every network and turns auth off outside production (`src/server.ts:43`,
  `src/auth.ts`).
- The poller looks back only 5 minutes after a restart (`src/automation/poller.ts:75`).
- **`npm test -- --test-name-pattern=X` runs all tests and exits 0 even when X matches
  nothing**, so name-filtered test runs prove nothing until `test:match` (step 0.1) exists.

### Decision (Alex, 2026-10-03): start Phase 0. No Codex round 3.

The review loop stopped after 2 NO-GOs (both in `docs/reviews/`). Alex chose execution over a
round 3, because every remaining risk (G1, C1, S2, S3, S6, FileVault restarts) is runtime
behaviour that only Phase 0 can settle. The planning branch `docs/booking-hub-brainstorm` is
pushed to origin and is not merged into `main`.

### Prompt for Next Session — SUPERSEDED 2026-10-03, DO NOT RUN

```
Work in /Users/alejandroguillen/Projects/gig-lead-responder.
FIRST gate (stop and ask Alex if anything differs):
  pwd
  git fetch origin
  git branch --show-current                      # expect: docs/booking-hub-brainstorm
  git rev-parse HEAD origin/docs/booking-hub-brainstorm   # expect: the two SHAs match
  git status --short                             # expect: clean
  git log --oneline HEAD..origin/main            # expect: empty (else a peer landed work on main; ask Alex)
Read: HANDOFF.md (2026-10-02 section), CLAUDE.md,
  docs/plans/2026-10-02-feat-hub-phase0-lead-replies-plan.md (Phase 0 only),
  docs/research/2026-10-02-booking-hub/spikes.md, docs/plans/2026-10-02-booking-hub-roadmap.md.

Task: Alex chose to start Phase 0 (2026-10-03). No Codex round 3.
1. Create branch feat/hub-phase0 from docs/booking-hub-brainstorm.
2. Run /workflows:work on the plan, PHASE 0 ONLY, in order: 0.1 test:match first, then 0.2 to 0.7.
   One concern per commit (~50-100 lines), failing test first. Verify with npm run test:match, never with
   npm test -- --test-name-pattern (that form passes on zero matches).
3. Record every spike and known-answer result in spikes.md with committed evidence. Nothing counts
   as "recorded" until it is committed.
STOP and ask Alex before: stopping Railway or revoking its Gmail grant (0.2 steps 2-3); any real send
(S2, G1); granting Full Disk Access; moving the ~/Desktop extraction files into ~/Data (0.5); any change to
Railway, .env or production data. Run claude -p ONLY with the plan's section 1.6 allowlisted environment
(this shell has ANTHROPIC_API_KEY set). Do not start Module 1. Update HANDOFF.md before stopping.
```

### Three Questions

1. **Hardest decision in this session?** What may auto-send. The answer: a slot-allowlist code
   gate plus a 20-lead review-only ramp, instead of an LLM confidence score.
2. **What did you reject, and why?** Twilio (blocked without 10DLC registration), bots on The Bash
   and Yelp (their terms), Railway as a second poller (double sends), one plan for all modules
   (Alex chose to split), and `--test-name-pattern` as a verification command (proven to match
   nothing and still pass).
3. **Least confident about going into the next phase?** The MacBook as the host: sleep, the lid,
   and OS restarts that wait at the FileVault login screen. Spike S6 and the heartbeat monitor
   detect this; neither prevents it.

---

*Earlier state, kept for history:*

**Previous date:** 2026-07-18. **Previous phase:** Real-lead intake completed locally; partial analysis complete and the remaining backlog is blocked by exhausted Anthropic API credits.

## First 60 Seconds: Peer-Session Check

Sessions run in parallel here. On 2026-08-08 one cut a branch at `e339340` while another
landed `197f118` + `4ff91c6` (Yelp credential-leak fix) on `main`; it found out at merge time.

1. **Before cutting a branch:** `git fetch origin && git log --oneline HEAD..origin/main`.
   Fetch first — without it, "up to date" and "stale" both print nothing. Any line = a peer landed work.
2. **Before editing:** `git status --short`. A dirty tree you did not dirty is a live peer; read
   every diff before touching it (global CLAUDE.md → "Parallel Sessions on One Repo").
3. **After merging `main` into your branch:** re-run `npm run typecheck && npm test` locally — a
   clean merge means no textual conflict, not that the combination works. CI only runs once you push.

> **Reconciliation note (2026-06-25):** Phase 2 was implemented and merged on
> 2026-05-31 but the HANDOFF/plan/compound all drifted, leaving a false
> impression that Phase 2 hadn't started. Reconciled from verified git history:
> HANDOFF + plan status corrected (PR #20), and the skipped compound doc written
> + learnings propagated (this cycle). No production code changed.

## Current State

### 2026-07-18 real-lead intake session

- Imported **16 genuine, future-dated gig inquiries** from the authenticated Gmail account into `data/leads.db`: 13 Squarespace inquiries and 3 GigSalad inquiries.
- Excluded reminders, duplicates, tests, obvious spam, and past events. Every imported record has a dated event between 2026-07-20 and 2027-02-13.
- Imported records as raw `received` leads only. No AI analysis or draft generation ran, and no email or SMS was sent.
- Kept `DRY_RUN=true` and `AUTO_SEND_ENABLED=false` throughout the import. The one-time import payload and helper were removed after verification.
- Verified the database contains exactly 16 leads and `git diff --check` passes.
- Investigated the dashboard's long-running “Pipeline running” state. All 16 imported records have `pipeline_completed_at = NULL` and no draft, confirming that no analysis job was active. A sending-disabled test of one lead returned Anthropic HTTP 401 (`API key is invalid`). The test record was restored exactly to its pre-test `received` state and the temporary diagnostic helper was removed.
- Re-tested after the user replaced the `.env` value on 2026-07-20. The file has exactly one well-formed `ANTHROPIC_API_KEY` entry with the expected prefix and no whitespace or placeholder text, but Anthropic still returns HTTP 401. No lead was modified. The credential itself is invalid or revoked and must be regenerated in Anthropic Console.
- After a new key was generated, found that an older inherited shell variable was overriding `.env`; running with that stale value removed validated the new key successfully.
- Saved three no-send analyses: Sydney Lukasezck (confidence 90, gate passed), Samantha V (confidence 70, gate passed), and Lali (confidence 0, gate failed and requires manual review). Johnny Martinez and Jennifer hit clarification-draft validation errors without record changes. The account then returned `credit balance is too low`, leaving the other 11 records untouched.
- All 16 leads remain in `received` status. The three saved drafts have `pipeline_completed_at = NULL` intentionally so startup recovery cannot interpret them as interrupted SMS deliveries. No email, platform reply, or SMS was sent.

### 2026-07-18 dashboard UI/UX session

Completed the full ten-item operational pass in priority order:

- Clarified approval scope and destination; **Approve draft** explicitly sends the phone-ready copy to Alex’s phone, not to the client.
- Rebuilt expanded leads as a focused review workspace with a primary draft, collapsible phone copy, confidence explanation, decision brief, and persistent actions.
- Added urgency-based queue ordering and visible reasons, Follow-Up badges/banner, guided Analyze first use and progress, actionable Insights, retry/loading/error states, keyboard row expansion, and populated mobile layouts.
- Used a temporary, isolated fictional fixture database for visual verification, then stopped the fixture server, detached the database from the project, and removed the generator after confirming the product must display real gigs only.
- Verified fictional populated Queue, expanded lead, Follow-Ups, Insights, Analyze validation, and 390px mobile states in the in-app browser. No live record was touched and no message was successfully sent.
- Saved final evidence in `docs/audits/2026-07-18-ui-ux/` and updated the audit.
- Verification: dashboard script syntax passed; `git diff --check` passed; `npm test` **315 passed, 0 failed**. `npx tsc --noEmit` still reports pre-existing errors in automation/router/Claude typing files not changed in this pass.

Completed a combined desktop/mobile audit and implemented the highest-priority fixes in `public/dashboard.html` and `public/dashboard.css`:

- Fixed document-level horizontal overflow caused by the five-tab mobile navigation.
- Added compact 2×2 mobile metrics, task-oriented empty states, and direct next actions.
- Added a persistent Analyze label and clearer helper copy.
- Added tab semantics, roving focus, arrow-key navigation, visible focus, and reduced-motion support.
- Bumped the dashboard stylesheet URL through `v=5` so the responsive and operational corrections are not masked by the one-hour static cache.
- Saved before/after evidence and the audit at `docs/audits/2026-07-18-ui-ux/`.
- Verified 390px and 1280px layouts in the local dashboard. `npm test`: **315 passed, 0 failed**.

The original empty-state gap was checked with temporary isolated fictional fixtures that are no longer connected to the app. Real approval/follow-up mutations and live AI streaming remain intentionally unexecuted until an inert staging adapter is available.

**Phase 1** (P3 Batch + Gmail Intake) — complete: brainstorm → plan → work → review → compound. 293 tests passing at that baseline.

**Phase 2** (Gmail Intake: Enable Auto-Send + Dashboard done_reason) — **implemented, Codex-reviewed, and merged to `main` via PR #19 on 2026-05-31.** Delivered:
- **P0 fix:** auto-send path calls `completeApproval()` (`src/automation/orchestrator.ts:295`) so auto-sent leads schedule follow-ups atomically.
- **P1:** `autoSendEnabled` mode logged at startup (`9c97fd5`); guards against stale Railway env vars.
- **done_reason** rendered on lead cards (`2d0dd3e`, `public/dashboard.html`) and threaded through orchestrator + DB layer.

`main` is up to date with `origin/main` (pushed). Test count not re-verified in this reconciliation pass.

**Auto-send is NOT live.** `autoSendEnabled` defaults to `false` (review-only). Enabling is a one-way operational change via Railway env `AUTO_SEND_ENABLED=true` — deliberately gated behind a draft-quality monitoring period per the Phase 2 plan's `feed_forward.risk`. This is an operational decision for Alex, not unfinished code.

## Outstanding

| Item | Notes |
|------|-------|
| **Enable auto-send in production** | Operational call: flip Railway `AUTO_SEND_ENABLED=true` after the review-only monitoring period confirms draft quality. |
| **Production-lessons addendum** | Once auto-send runs live, add an addendum to the Phase 2 solution doc (reply quality, false-auto-send rate, follow-up behavior). The solution doc marks production validation as PENDING. |
| **TODO — replace stale Twilio Auth Token** | Dashboard **Approve** (SMS phone-copy to Alex) fails with **500 → Twilio 401 (code 20003)**. Root cause: `TWILIO_AUTH_TOKEN` in `.env` is **31 chars, should be 32** (truncated on paste). Fix: copy the full token from console.twilio.com → Account Info into `.env` line ~20, then verify live before retrying: `curl -s -o /dev/null -w '%{http_code}' https://api.twilio.com/2010-04-01/Accounts/$SID.json -u "$SID:$TOKEN"` must return **200** (per key-rotation rule: verify with a real auth call, not a string match). Until fixed, drafts are still fully usable — copy them from the dashboard directly. Twilio creds live only in `.env` (not `~/.zshrc`), so no shell fix needed. |

## Key Artifacts

| Phase | Location |
|-------|----------|
| Phase 1 Plan | `docs/plans/2026-05-22-feat-p3-batch-gmail-intake-plan.md` |
| Phase 1 Solution | `docs/solutions/architecture/2026-05-22-p3-batch-gmail-intake-phase1-hardening.md` |
| Phase 2 Plan | `docs/plans/2026-05-31-feat-gmail-intake-phase2-auto-send-plan.md` (status: completed) |
| Phase 2 Solution | `docs/solutions/architecture/2026-05-31-gmail-intake-phase2-auto-send-done-reason.md` (production lessons PENDING) |
| Dashboard UI/UX Audit | `docs/audits/2026-07-18-ui-ux/AUDIT.md` |

## Deferred Items (still open from Phase 1)

| Item | Reason |
|------|--------|
| Extract shared esc() to public/shared.js | Two-file duplication (index.html + dashboard.html) |
| Levenshtein fuzzy matching | Not justified by production data |
| OAuth token refresh persistence on Railway | Accepted for Phase 1 |
| full_draft length cap | Pre-existing from Cycle 11 |
| Dual parser unification | Pre-existing |
| Broader soft-refusal patterns | No production data yet |
| Unicode normalization in normalizeFormatText | No production data yet |

_(done_reason in dashboard — completed in Phase 2, removed from this list.)_

## Cross-project reference — FilmCon dashboard patterns (2026-07-18)

The archived FilmCon dashboard (`~/Projects/filmcon/docs/solutions/2026-07-18-filmcon-dashboard-unshipped-patterns.md`, code at git tag `filmcon-dashboard-archived`) generalized two patterns that came *from here* and loop back to open work here:

- **Audit-first, success-only atomic write** is the generalized form of *this project's own* Phase 2 P0 fix — the auto-send path calling `completeApproval()` (`src/automation/orchestrator.ts:295`) so the state change and its follow-up/audit land atomically. When adding any **new state-changing path**, route it through the one canonical atomic function; never re-implement inline (that was the original bug).
- **Deploy fail-open + unenforced-gate + stale-env** lessons speak directly to the **`AUTO_SEND_ENABLED` Railway gating**. Before flipping auto-send live: enforce the safety gate *in code/CI*, not by remembering to check it; log the resolved flag at startup (already done — keep it); and verify the live Railway env with a real check, not an assumption (the "guards against stale Railway env vars" note here is the same class as FilmCon's fail-open-because-ENVIRONMENT-never-wired P0).

### 2026-08-07 security fix + typecheck diagnosis session

**Shipped and verified live.** `public/mockup-hybrid.html` was served **without
authentication** on production. `src/app.ts:68` registers `express.static` *after*
the three `sessionAuth`-protected routes (`/dashboard.html`, `/`, `/index.html`),
so every other real file in `public/` was public. The exposed file publishes quote
figures verbatim ($250–$850).

Moved to `docs/design/` rather than deleted — seven references across
`AGENT_EPISODES.md`, the redesign plan, and the brainstorm cite it as the approved
design reference, and deleting it would have left dangling citations. All
references updated in the same commit. PR #22, squash-merged as `e339340`.

Verified against production with a control, before and after:

| Path | Before | After |
|---|---|---|
| `/mockup-hybrid.html` | **200** (56,506 bytes) | **401** |
| `/health` | 200 | 200 |
| `/dashboard.html` | 401 | 401 |
| `/no-such-file.html` | 401 | 401 |
| `/dashboard.css` | 200 | 200 |

The 401 on a **nonexistent** path is the control that makes the reading
interpretable: it proves the 200 was a genuine static serve of a real file, not a
blanket allow. Scope is limited to files that actually exist in `public/` — this
was not directory traversal. Railway auto-deployed from `main` ~40s after merge.

**Diagnosed, not fixed: `npx tsc --noEmit` fails with 10 errors.** Pre-existing;
this session touched no `.ts`. They are 4 root causes:

| Group | Errors | Root cause | Fix |
|---|---|---|---|
| **A** | 6 | `src/claude.ts:4` — `Awaited<ReturnType<Anthropic["messages"]["create"]>>` resolves to `Message \| Stream` because `create` is overloaded and no literal `stream: false` narrows it. `Stream` has no `.content`. Hits `claude.ts:59,110` + three test mocks. | `type ClaudeMessageResponse = Anthropic.Message;` then add `citations: null` to the three mocks' text blocks (SDK `TextBlock` requires it). |
| **B** | 3 | `types.ts:24` `RecommendedFormat = Format \| "unresolved"` passed where a plain `Format` is required: `router.ts:79`, `generate.ts:429`, and `:434` as a downstream consequence. | Narrowing guard before each lookup so `"unresolved"` is handled explicitly. |
| **C** | 1 | `orchestrator.ts:264` — `AutoSendDeps.sendSms` typed `=> Promise<void>`, real `sendSms` returns `Promise<{success, error?}>`. | Widen the dep type. |
| **D** | 1 | `shape-lead.test.ts:62` — `@ts-expect-error` above `delete (lead as any).done_reason`; the `as any` makes the line legal, so the directive expects an error that no longer occurs. | Delete the directive line. |

**Group B is the only correctness risk** — `"unresolved"` reaching the pricing
lookup returns `undefined` and propagates into a quote. A, C, D are hygiene.

**Why these accumulated: there is no typecheck gate.** No `tsc` in
`package.json` scripts, no `.github/workflows`, no git hooks. `tsx` strips types
without checking them, so the 315-test suite (all passing) has never looked at
them. "Tests pass" and "the code typechecks" are different claims and only one
was being measured.

**Tracker correction found, not applied:** `todos/052-pending-p2-extract-css-from-dashboard.md`
is still `status: pending` but the work is **done** — verified: `public/dashboard.css`
exists (1358 lines), `dashboard.html` has **0** inline `<style>` blocks and links
the stylesheet. Landed in `6baf6cd`. (Its filename says `052`; the heading inside
says `# 047:`.) Flip the status and reconcile the number.

**RESOLVED 2026-08-07** in `54d90bf` — status flipped, file renamed to
`todos/052-done-p2-extract-css-from-dashboard.md`. The sha above was also wrong
(`8641f3b` → `6baf6cd`, corrected in `aa93fa0`).

## Prompt for Next Session — SUPERSEDED, DO NOT RUN

> Completed 2026-08-07 on branch `fix/typecheck-errors` (pushed, head `54d90bf`).
> All 10 errors are fixed. Kept verbatim for the record — the live instructions are
> in **Prompt for Next Session** at the bottom of this file.

```
Project root: /Users/alejandroguillen/Projects/gig-lead-responder

Read HANDOFF.md, section "2026-08-07 security fix + typecheck diagnosis session".
Fix all 10 `npx tsc --noEmit` errors, in this order, each as its own commit on a
branch off main (do NOT commit to main):

1. Group B first — it is the only correctness risk. Add narrowing guards so
   "unresolved" is handled explicitly before the Record<Format, FormatRates>
   lookup. Files: src/types.ts:24, src/automation/router.ts:79,
   src/prompts/generate.ts:429 and :434.
2. Group A — change src/claude.ts:4 to `type ClaudeMessageResponse =
   Anthropic.Message;` then add `citations: null` to the text blocks in
   src/claude-extended.test.ts:10, src/confidence.test.ts:60,
   src/run-pipeline.test.ts:70.
3. Group C — widen AutoSendDeps.sendSms in src/automation/orchestrator.ts to
   match the real sendSms return type.
4. Group D — delete the dead @ts-expect-error at src/shape-lead.test.ts:62.

Then add "typecheck": "tsc --noEmit" to package.json scripts and confirm BOTH
`npm run typecheck` (0 errors) and `npm test` (315 pass) are green before the
final commit. Do not touch data/leads.db or .env.

Also flip todos/052-pending-p2-extract-css-from-dashboard.md to status: resolved
and rename the file — the work landed in 6baf6cd (verified: dashboard.css exists,
0 inline <style> blocks in dashboard.html).
```

### Three Questions — security fix + typecheck diagnosis session

1. **Hardest implementation decision in this session?** Whether to delete `mockup-hybrid.html` (which is what was authorized) or move it. Seven docs cite it as the approved design reference, so deleting would have closed the exposure while creating seven dangling citations — trading one failure class for a worse one. Moving it out of the served directory and updating every reference in the same commit achieves the same security outcome with no collateral damage, so I deviated and said so explicitly rather than executing the literal instruction.
2. **What did you consider changing but leave alone, and why?** The 10 typecheck errors — diagnosed and grouped but not fixed, because Alex drew the line at a fresh session. Also `.claude/agent-memory/` (gitignored this session rather than committed: it is another agent's scratch state, and committing it would make a stale April note about `ukulele_solo` authoritative for future sessions — that specific claim is now false, `ukulele` routes to `sourced_cultural_solo` per `docs/Sourced_Format_Definitions.md:22`). And `todos/052`, left for the next session with the verification already done.
3. **Least confident about going into review?** Group B's fix shape. I know the three sites and the mechanism, but not what the *correct* behavior is when a format is genuinely `"unresolved"` at a pricing lookup — throw, return a clarification-mode sentinel, or fall back to a default tier is a product decision, not a type-system one. Whoever fixes it should decide that deliberately rather than picking whatever silences `tsc`. Separately: `src/error-middleware.test.ts:155-156` asserts a 200 on `/dashboard.html` as proof auth is intact, but the test runs with `DASHBOARD_USER`/`PASS` unset, which takes the dev bypass at `src/auth.ts:118-126` — "auth passed" and "auth was disabled" produce the same 200. Not a live hole (`src/server.ts:18-21` hard-fails in production without those vars), but that test cannot detect its own bypass.

### 2026-08-07 typecheck fix session (10 `tsc` errors → 0)

#### Prior Phase Risk

Previous phase's "Least confident about" answer, verbatim:

> Group B's fix shape. I know the three sites and the mechanism, but not what the
> *correct* behavior is when a format is genuinely `"unresolved"` at a pricing lookup —
> throw, return a clarification-mode sentinel, or fall back to a default tier is a
> product decision, not a type-system one.

**How this phase addressed it:** by investigating reachability before writing a line of
fix. The premise turned out to be false — at neither site was it a product decision.

**Shipped, not merged.** Branch `fix/typecheck-errors`, cut off `main` at `e339340`,
pushed at `54d90bf`. No PR opened, nothing merged, `main` still fails `tsc`.

| # | Commit | Group | Errors |
|---|--------|-------|--------|
| 1 | `c48dbc2` | B — unresolved format | 10 → 7 |
| 2 | `4d79719` | A — ClaudeMessageResponse | 7 → 2 |
| 3 | `12c6721` | C — sendSms return type | 2 → 1 |
| 4 | `726cae8` | D — dead ts-expect-error | 1 → 0 |
| 5 | `54d90bf` | typecheck script + todo 052 | — |

**Gates:** `npm run typecheck` → 0 errors. `npm test` → 315 pass, 0 fail, 52 suites.
Re-run independently twice (review agent, then the orchestrating session) rather than
taken on report from the agents that made the changes.

**Group B was two opposite problems, not one product decision.**

- `router.ts:79` — `"unresolved"` **does** reach it (traced: `prompts/classify.ts:67-72`
  emits it, `pipeline/classify.ts:33-38` allows it, `enrich.ts:35-37` preserves it,
  `orchestrator.ts:153` routes it). But `getFormatFamily` was **already total** — it
  loops the family table, matches nothing, returns `"unknown"`. The type was too narrow
  for a function that already handled the case. Fix: widen the parameter.
- `generate.ts:429/434` — `"unresolved"` **cannot** reach it. `findMinFloor` has exactly
  one caller, gated behind `budget.tier === "no_viable_scope"`; every `PricingResult`
  carrying `"unresolved"` is constructed with `budget.tier: "none"`; and `lookupPrice`
  already throws on `"unresolved"` at `price.ts:57`. Fix: narrow the parameter to
  `Format`, with `as Format` at the call site behind a documented invariant.

No runtime guard was added at either site, deliberately: at the first it would be
redundant, at the second it would be dead code masquerading as a safety check.

`PricingResult.format` was deliberately **left** as `RecommendedFormat`. Narrowing it
would trade these 3 errors for 2 new ones at `run-pipeline.ts:35` and `:138` and force
inventing a replacement sentinel — a behavior change smuggled in as a typecheck fix.

**Verification method worth reusing: emitted-JS diff.** Rather than eyeballing the diff
for smuggled behavior, the review transpiled `main`'s and `HEAD`'s version of all four
changed production files through the repo's own esbuild and diffed the output — identical
for all four. Zero runtime behavior change proven mechanically instead of asserted. The
instrument was checked too: `tsc --listFiles` confirms all four files were actually
typechecked, and the test glob matches all 24 test files — so "0 errors" could not have
quietly meant "nothing ran".

**Two errors in the previous handoff, found and corrected:**

- Group A is **5** errors, not 6. The stated 6+3+1+1 = 11; there are 10.
- Todo 052 landed in **`6baf6cd`**, not `8641f3b` (corrected in `aa93fa0`). `8641f3b` is
  the 07-18 UI/UX pass and touches no CSS at all, so `git show 8641f3b` would have read
  as a falsely-closed todo.

**Unplanned but mechanically required:** `src/orchestrator.test.ts` (the spy mock must
return `{success: true}` once `sendSms` is widened) and `ClaudeMessageRequest` →
`MessageCreateParamsNonStreaming` in `src/claude.ts`.

**The new gate is not wired to anything.** `"typecheck": "tsc --noEmit"` exists in
`package.json`, but there is still no `.github/workflows` and no git hooks. It runs only
when a human remembers to run it — the same unenforced-gate class that let 10 errors
accumulate in the first place.

## Prompt for Next Session — SUPERSEDED 2026-08-08, DO NOT RUN

> The typecheck stream in this block is fully closed (items 1-4 all done as of
> `defe03e`). The lead-processing item is still live and has been carried
> forward verbatim into the current **Prompt for Next Session** at the bottom
> of this file. Kept here for the record only.

```
Project root: /Users/alejandroguillen/Projects/gig-lead-responder

Run the "First 60 Seconds: Peer-Session Check" at the top of HANDOFF.md before any edit.
Two sessions worked this repo on 2026-08-07/08 and both streams are recorded below.

PRIMARY (from the lead-processing stream):
After Anthropic API credits are added, process only the 13 real received leads whose
`full_draft` is NULL. Unset the inherited ANTHROPIC_API_KEY so dotenv loads the current
`.env` value, and keep DRY_RUN=true and AUTO_SEND_ENABLED=false. Isolate
clarification-mode generation failures and do not send email or SMS.
Relevant files: data/leads.db, .env, src/run-pipeline.ts, public/dashboard.html.

TYPECHECK STREAM — items 1-3 are DONE as of 2026-08-08, do not redo them:
  [x] 1. fix/typecheck-errors merged (PR #23, f478239). main typechecks clean.
  [x] 2. CI gate wired (PR #24, 9cfa5f8) — .github/workflows/ci.yml runs typecheck +
         test on PRs and pushes to main. Branch protection on main now REQUIRES the
         "typecheck + test" check, with strict + enforce_admins both on. Verified by
         a real rejected push: "GH006: Protected branch update failed".
  [x] 3. todos/082 filed (PricingResult rehydration unvalidated at the DB boundary).
  [x] BONUS. tsconfig now typechecks scripts/ too (PR #25, 400bb1a) — it previously
         passed a planted error in scripts/ at exit 0.
  [ ] 4. STILL OPEN: src/error-middleware.test.ts:155-156 asserts a 200 on
         /dashboard.html as proof auth is intact, but runs with DASHBOARD_USER/PASS
         unset and so takes the dev bypass at src/auth.ts:118-126. "Auth passed" and
         "auth was disabled" produce the same 200; the test cannot detect its own
         bypass. Not a live hole (src/server.ts:18-21 hard-fails in production).

Also open, not urgent: `npm audit` reports 10 vulnerabilities (1 low, 5 moderate,
4 high), deliberately not gated in CI. No linter is configured.

Do not touch data/leads.db or .env.
```

### Three Questions — typecheck fix session (2026-08-07)

1. **Hardest implementation decision in this session?** Whether to trust the previous
   session's framing of Group B as a product decision. The handoff said the fix shape
   was a product call and implied a runtime guard; the conservative move was to
   implement one. Instead I spent four parallel read-only agents on reachability first.
   That inverted the answer: at `generate.ts` the guard would have been unreachable dead
   code that reads as a safety check, and at `router.ts` it would have duplicated
   behavior the function already had. Taking a well-written handoff at face value would
   have produced a worse codebase than the type errors it replaced.
2. **What did you consider changing but left alone, and why?** `PricingResult.format`
   (narrowing it looks tidy but forces inventing a new sentinel — see above). The
   `twilio-webhook.ts:152` persistence hole, left as a todo rather than fixed here: it is
   pre-existing, it fails loud rather than silent, and folding it in is exactly the scope
   creep the reviewer flagged on commit 5. And `.claude/agent-memory/`, still untracked.
3. **Least confident about going into review?** The `as Format` cast at
   `generate.ts:374`. The unreachability proof is sound today, but it rests on an
   invariant maintained by convention across four files — not by the type system and not
   by any test. Nothing fails loudly if a future edit constructs a `PricingResult` with
   `format: "unresolved"` and `budget.tier: "no_viable_scope"`; the cast just goes quiet.
   A test asserting that combination is unconstructible would convert the comment into an
   enforced invariant. Related: the emitted-JS-identical proof shows behavior did not
   change, which is not the same claim as the types now describing reality correctly.

### 2026-08-08 CI gate, dependency, and deploy-verification session

#### Prior Phase Risk

Previous phase's "Least confident about" answer, verbatim:

> The `as Format` cast at `generate.ts:374`. The unreachability proof is sound today,
> but it rests on an invariant maintained by convention across four files — not by the
> type system and not by any test.

**How this phase addressed it: it did not.** That invariant is still unenforced. It is
recorded in `todos/082`, which covers the same boundary from the read side. Accepted
rather than closed, and named here so it is not mistaken for handled.

**Six PRs, all merged, `main` at `defe03e`.**

| PR | What | Merge |
|---|---|---|
| #26 | land the 2026-08-07 session records on main | `2df70df` |
| #27 | file todos 083, 084, 085 | `1f626cf` |
| #28 | resolve all 10 dependency vulnerabilities | `a8389e5` |
| #29 | audit gate; close 084; file 086 | `5196ff8` |
| #30 | `/health` build identifier | `2550b96` |
| #31 | close 086 | `defe03e` |

**The gate is now enforcing, not advisory.** Branch protection on `main` requires the
`typecheck + test` check, with `strict: true` (branch must be up to date, which is the
direct answer to `main` moving under a session mid-PR) and `enforce_admins: true`.

Proven, not assumed. A real push of an empty commit straight at `main` was rejected:

```
remote: error: GH006: Protected branch update failed for refs/heads/main.
remote: - Required status check "typecheck + test" is expected.
```

A first attempt used `git push --dry-run` and reported success — dry-run never reaches
the server's receive-time checks, so "would be allowed" and "was never evaluated" print
identically. That result was discarded rather than counted.

**Dependency vulnerabilities: 10 → 0** (`npm audit`). Lockfile-only; `package.json` is
byte-identical, no `--force`, no semver-major bump. `npm audit fix` cleared 9. The tenth
could not be fixed that way: it kept printing "fix available via `npm audit fix`" while
changing nothing, because `tsx@4.21.0` pinned `esbuild@0.27.3`. `npm update tsx`
(4.21.0 → 4.23.11) resolved `esbuild@0.28.1`. **The advisory covers `0.27.3 - 0.28.0`,
so landing on `0.28.0` would have looked like an upgrade and fixed nothing** — "newer"
and "patched" are different claims.

**`npm audit` is gated separately, on purpose** (`.github/workflows/audit.yml`). It
queries the registry at run time, so an advisory published overnight can red a
previously-green PR with no code change. Blocking unrelated work at an arbitrary moment
is how a gate stops being read. It runs on PRs touching `package.json`/`package-lock.json`,
weekly for drift, and on demand. `--audit-level=high` fails the run; the step before
prints the full report unfiltered. Verified against a known answer: clean repo exit 0,
scratch project with `lodash@4.17.11` exit 1.

**Deploys are now verifiable.** `/health` previously returned
`{"status":"ok","rejectedEmails":N}` — no build identifier. Railway auto-deploys from
`main`, so the only post-merge signal was a `200` that was equally true before the merge.
It now returns `commit` and `startedAt`. Confirmed end to end: merge commit `2550b96`,
production `/health` returned `"commit":"2550b96"`. First deploy in this repo verified
rather than inferred.

That also settled an open assumption — `RAILWAY_GIT_COMMIT_SHA` is the correct variable
name. It was checkable only because the field returns a literal `"unknown"` on failure
instead of being omitted; a wrong guess stayed visible rather than going silent.

**Coverage gap closed:** `tsconfig.json` was `include: ["src"]`, so `npm run typecheck`
never looked at `scripts/` — 91 files checked, zero from `scripts/`, confirmed by
planting a type error there that passed at exit 0. Now 94 files. `scripts/plan-gate.ts`
is executed code with its own test file and had been unguarded.

**Housekeeping:** 15 merged branches deleted (all verified as ancestors of `main` first,
SHAs recorded). Suite 315 → 351. Five branches remain, four genuinely unmerged.

## Prompt for Next Session — SUPERSEDED 2026-08-09, DO NOT RUN

> The PRIMARY item (13 leads) and all four open todos are still live and have been
> carried forward verbatim into the current **Prompt for Next Session** at the bottom
> of this file. Kept here for the record only.

```
Project root: /Users/alejandroguillen/Projects/gig-lead-responder

Run the "First 60 Seconds: Peer-Session Check" at the top of HANDOFF.md before any edit.
main was defe03e when this was written; this handoff commit sits on top of it, so
check `git log -1` rather than trusting that SHA. CI (typecheck + test) is a REQUIRED
status check with strict and enforce_admins on, so you cannot push to main directly —
branch, PR, let CI pass, merge.

VERIFY A DEPLOY LIKE THIS (new as of 2026-08-08):
  curl -s https://gig-lead-responder-production.up.railway.app/health | jq -r .commit
  It must equal the merged SHA. "unknown" means the build identifier broke.

PRIMARY — carried forward, still open:
After Anthropic API credits are added, process only the 13 real received leads whose
`full_draft` is NULL. Unset the inherited ANTHROPIC_API_KEY so dotenv loads the current
`.env` value, and keep DRY_RUN=true and AUTO_SEND_ENABLED=false. Isolate
clarification-mode generation failures and do not send email or SMS.
Relevant files: data/leads.db, .env, src/run-pipeline.ts, public/dashboard.html.

OPEN TODOS (nothing p1 outstanding):
  083 p2  src/error-middleware.test.ts:155-156 asserts 200 on /dashboard.html as proof
          auth works, but runs with DASHBOARD_USER/PASS unset and takes the dev bypass
          at src/auth.ts:118-126. "Auth passed" and "auth was disabled" are identical.
          Not a live hole. Its acceptance criteria require DEMONSTRATING the fixed test
          goes red when sessionAuth is removed — do not skip that step.
  082 p2  PricingResult rehydrated from the DB with one-field validation, then cast.
          Also the home of the unenforced generate.ts:374 invariant.
  081 p2  advisor tool — Opus on generate/verify.
  085 p3  no linter configured; decide adopt-or-not and record the decision either way.

Do not touch data/leads.db or .env.
```

## Three Questions

1. **Hardest implementation decision in this session?** How to wire `npm audit` into CI.
   The obvious move was adding a step to `ci.yml`, which would have made it a required
   check on every PR. I rejected that: `npm audit` queries the registry at run time, so
   its verdict depends on what advisories exist today rather than on anything in the
   repo, and an advisory published overnight would red a previously-green PR with no code
   change. For a solo maintainer that means being blocked at an arbitrary moment on work
   unrelated to the finding — the precise mechanism by which a gate stops being read. A
   separate workflow, triggered on lockfile changes plus a weekly schedule, keeps the
   signal and drops the false blocking. The reasoning is written into the file so the
   next person does not "simplify" it back into `ci.yml`.
2. **What did you consider changing but left alone, and why?** The `generate.ts:374`
   invariant — still unenforced, deliberately left to `todos/082` rather than folded into
   an unrelated PR. `npm audit` at `--audit-level=moderate` rather than `high`; rejected
   because moderate advisories in dev tooling are a steady trickle and would turn the
   gate into noise. And `enforce_admins` was initially set to `false` as a safety valve
   before I reversed it — a bypassable gate for a sole admin reproduces the exact failure
   this session was closing.
3. **Least confident about going into review?** That the CI gate covers what matters, as
   opposed to what is easy to check. It runs `tsc` and the test suite. It does not run a
   linter (`085`), does not gate on `npm audit` for most PRs by design, and — the real
   gap — **nothing verifies the deployed app actually works.** `/health` returning the
   right SHA proves the right code shipped; it does not prove the pipeline processes a
   lead correctly. 351 tests pass against a suite that has never sent a real message.
   Separately: `--audit-level=high` means moderate advisories now accumulate silently.
   That is a deliberate trade, but it is the kind of threshold that gets set once and
   never revisited, so it is worth a look if the moderate count ever climbs.

---

### 2026-08-09 compound phase — Yelp allowlist capture bug

**Shipped:** `695b62a` (PR #33) — `docs/solutions/logic-errors/2026-08-09-yelp-allowlist-never-matched-production.md`, closing the cycle opened by `197f118` + `4ff91c6` on 2026-08-07.

**What the cycle was.** While pulling real Gmail samples to build a reply parser (roadmap #3), the survey found that `source-validator.ts` allowed `/^(no-reply|biz-alerts)@yelp\.com$/i` while real Yelp mail arrives from `reply+<32 hex>@messaging.yelp.com`. Anchored pattern, so no near-miss: **every Yelp lead had been rejected as "Unknown sender" for months.** Six conversations in the mailbox, three with client replies, none ingested.

**The part that mattered more than the bug.** Fixing the allowlist would have armed `parseYelpEmail`, which had never executed and had no tests. Audited against a real email first, it captured Yelp's passwordless login URL — a bearer credential — into `portalUrl` **and** `rawText`, the field sent to the Claude API. Both fixed before the allowlist change merged.

**Process deviation, recorded not endorsed:** no plan phase and no `/workflows:review` phase this cycle. Verification was 342/342 tests (11 new, proven to fail against the pre-fix parser), a typecheck error set proven byte-identical to `main`, and CI green. **There are no review-agent finding counts — do not read their absence as "review found nothing."**

**Deliberately NOT done:** `gigs@gigsalad.com` was not added to the allowlist. Accepting it without booked-detection turns every payment receipt into a phantom lead.

### Three Questions — compound phase (2026-08-09)

1. **Hardest pattern to extract?** Separating "the allowlist regex was wrong" from the reusable lesson. The typo is not knowledge. The reusable part is that the broken gate was *shielding* an unreviewed code path, so the fix and the audit behind it had to ship together. That only surfaced after tracing what `validateSource` passing actually triggers downstream.
2. **What did you consider documenting but left out?** A redesign making `rejectedEmailCount` persistent and per-platform. Left out because a per-platform counter still cannot distinguish "no Yelp leads arrived" from "Yelp leads were rejected" — the honest instrument is a *positive* liveness assertion (each configured platform has ingested ≥1 lead in N days), and that deserves its own cycle.
3. **Least confident about?** **The fix has never processed a real Yelp email.** Everything green is fixtures. `YelpPortalClient.fetchLeadDetails()` is next in the chain and unexercised by exactly the mechanism that left the parser untested — expect the next defect there. Business impact also remains unmeasured.

## Prompt for Next Session — SUPERSEDED 2026-10-03, DO NOT RUN (current prompt is in the 2026-10-03 section at the top)

```
Project root: /Users/alejandroguillen/Projects/gig-lead-responder

Run the "First 60 Seconds: Peer-Session Check" at the top of HANDOFF.md before any edit.
Check `git log -1` rather than trusting any SHA written here. CI (typecheck + test) is a
REQUIRED status check with strict and enforce_admins on, so you cannot push to main
directly — branch, PR, let CI pass, merge.

VERIFY A DEPLOY LIKE THIS:
  curl -s https://gig-lead-responder-production.up.railway.app/health | jq -r .commit
  It must equal the merged SHA. "unknown" means the build identifier broke.
  NOTE: `rejectedEmails` in that same response is in-memory and resets on restart. It
  cannot distinguish a dead channel from a healthy one. Never read it as evidence.

PRIMARY — carried forward, still open:
After Anthropic API credits are added, process only the 13 real received leads whose
`full_draft` is NULL. Unset the inherited ANTHROPIC_API_KEY so dotenv loads the current
`.env` value, and keep DRY_RUN=true and AUTO_SEND_ENABLED=false. Isolate
clarification-mode generation failures and do not send email or SMS.
Relevant files: data/leads.db, .env, src/run-pipeline.ts, public/dashboard.html.
(Alex's standing rule is to NOT buy usage credits — confirm with him before assuming
this item is unblocked.)

NEW — first real Yelp lead is the open verification:
The 2026-08-07 Yelp fix has never processed a real Yelp email. When one arrives, watch
the whole chain: poller → validateSource (expect kind:"lead") → parseYelpEmail →
YelpPortalClient.fetchLeadDetails() → pipeline. fetchLeadDetails is the next unexercised
stage; treat it as unreviewed. Read
docs/solutions/logic-errors/2026-08-09-yelp-allowlist-never-matched-production.md first.

OPEN TODOS (nothing p1 outstanding):
  083 p2  src/error-middleware.test.ts:155-156 asserts 200 on /dashboard.html as proof
          auth works, but runs with DASHBOARD_USER/PASS unset and takes the dev bypass
          at src/auth.ts:118-126. "Auth passed" and "auth was disabled" are identical.
          Not a live hole. Its acceptance criteria require DEMONSTRATING the fixed test
          goes red when sessionAuth is removed — do not skip that step.
  082 p2  PricingResult rehydrated from the DB with one-field validation, then cast.
          Also the home of the unenforced generate.ts:374 invariant.
  081 p2  advisor tool — Opus on generate/verify.
  085 p3  no linter configured; decide adopt-or-not and record the decision either way.

Do not touch data/leads.db or .env.
```
