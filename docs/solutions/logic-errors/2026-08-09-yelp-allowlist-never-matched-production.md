---
title: The Yelp Allowlist That Never Matched Production
date: 2026-08-09
tags: [allowlist, silent-failure, credential-leak, unreachable-code, verification, regex]
apps: [gig-lead-responder]
phase: compound
---

# The Yelp Allowlist That Never Matched Production

## Prior Phase Risk

The brainstorm (`docs/brainstorms/2026-08-07-reply-detection-samples.md`) flagged:

> "§4a is settled at the code level (the regexes provably cannot match the observed
> senders), but **the business impact is not measured.** Unknown: how many Yelp leads
> were dropped over what period, and whether any converted anyway because Alex answers
> Yelp on the app regardless of the system."

**This phase accepts that risk rather than closing it.** The fix shipped without ever
measuring the loss, because the measurement requires a production DB copy and the
business decision (chase old leads) was handled manually instead. The gap is real and
is carried forward below.

## Problem

Every Yelp lead had been silently rejected for months. The system had never ingested
one, and nothing anywhere said so.

It was not found by looking for it. The session was pulling real email samples to
build a reply-detection parser (roadmap #3). Surveying the mailbox to answer a
*different* question is what exposed it.

## What We Found

### 1. The allowlist described a sender that does not exist

```js
yelp: /^(no-reply|biz-alerts)@yelp\.com$/i,
```

Real Yelp lead mail arrives from `reply+<32 hex>@messaging.yelp.com`. Both halves fail:
the local part is neither literal, and `messaging.yelp.com` is not `yelp.com`. The
pattern is `^…$` anchored — deliberately, as an anti-spoofing control — so there was no
substring near-miss to soften it. It matched **zero percent** of live traffic.

Confirmed by executing the live regexes against the live observed senders rather than
reading them:

| Real sender | Result |
|---|---|
| `reply+<hex>@messaging.yelp.com` | REJECT — every Yelp lead and reply |
| `gigs@gigsalad.com` | REJECT — payment / booking notices |
| `leads@gigsalad.com` | ACCEPT — the only path that ever worked |

Six Yelp conversations sat in the mailbox, three with client replies. None ingestible.

### 2. The one instrument pointed at it could not report the failure

```js
let rejectedEmailCount = 0;   // in-memory, exposed via /health
```

It resets on every process restart, so on Railway `/health` reported `rejectedEmails: 0`
essentially always. **A channel rejecting 100% of its traffic and a channel working
perfectly produced the same reading.** The gauge existed, was wired to a health
endpoint, and was incapable of showing the thing it was for.

### 3. The code behind the closed door had never run — and leaked credentials

`parseYelpEmail` had never executed in production, because nothing ever got past
validation to reach it. It had no test file. Run against a real Yelp email for the
first time, it captured Yelp's passwordless login URL — a bearer credential — into
**two** fields:

```
portalUrl : https://biz.yelp.com/login/passwordless/redirect/<TOKEN>?…
rawText   : "…Monserate Winery… | [ Respond Now ](<same URL>)"
```

`rawText` is the field sent to the Claude API. Fixing the allowlist alone would have
begun transmitting a live credential to a third party on every Yelp lead.

Two independent causes:

- `extractYelpPortalUrl` matched `biz\.yelp\.com\/[^"]*message[^"]+`, and the login URL
  contains `return_url=%2Fmessaging%2F…`. It matched the credential itself. There is no
  clean portal link in the email at all.
- `extractTruncatedMessage` stopped on `/^(View|Reply|Respond|…)/i`, but Yelp's
  plaintext is markdown, so the CTA arrives as `| [ Respond Now ](https://…)`. The `^`
  anchor never matched, capture ran past the CTA, and swallowed the URL.

## What We Built

`197f118` — allowlist (`src/automation/source-validator.ts`)

- Added `^reply\+[0-9a-f]{32}@messaging\.yelp\.com$` as a second **anchored**
  alternative. Exact matching kept; SPF/DKIM enforcement depends on it.
- Yelp sends a client's reply from the *same* address as the original lead, so sender
  alone cannot separate them. `validateSource` now returns `kind: "lead" | "reply"`;
  the orchestrator skips replies before the pipeline. Without this, one observed client
  who replied 3 times in 29 minutes would have become 3 phantom leads, 3 Claude drafts
  and 3 SMS.
- Replies stay `valid: true` and are **not** counted as rejections (see pattern 2).
- Deliberately did **not** add `gigs@gigsalad.com`. Accepting it today would turn every
  payment receipt into a phantom lead; it belongs with booked-detection.

`4ff91c6` — parser (`src/automation/parsers/yelp.ts`)

- `portalUrl` is now rebuilt from the `return_url` path with the token discarded, and
  only `/messaging/<id>/thread/<id>` is accepted — an arbitrary redirect is refused.
- Stop-word check runs against a *normalized* line (URLs removed, markdown unwrapped,
  table pipes stripped) so decoration cannot smuggle a CTA past the guard.
- HTML entities decoded; `stripCredentialUrls()` guards `rawText` defensively
  regardless of which extractor produced it.
- `src/yelp-parser.test.ts` — the first coverage this parser has ever had. 331 → 342
  tests.

## Key Pattern: fixing a gate makes dormant code reachable — audit behind the door first

The allowlist bug was *protecting* the credential leak. As long as no Yelp email got
through, the parser's defects were unreachable and harmless. The fix is what would have
armed them.

Unreachable code does not stay correct while it waits. It rots quietly, because nothing
tests it, nothing runs it, and no incident ever points at it. The absence of bug reports
is not evidence of correctness when the code cannot execute — it is the *expected*
reading either way.

**So: when a fix will make a previously-dead path live, treat everything behind that
path as unreviewed, whatever its age or apparent maturity.** Run it against real input
before shipping the thing that opens it. Here that meant executing `parseYelpEmail`
against a real email *before* merging the allowlist fix, which is the only reason the
credential never reached the API.

This generalises to feature flags being switched on, deprecated endpoints being
re-enabled, permissions being widened, and any migration that starts routing traffic
somewhere it has never gone.

## Second Pattern: an instrument that cannot report its own failure is decoration

`rejectedEmailCount` is the compact example: it could not distinguish a dead channel
from a healthy one, and it reported that non-answer confidently, on a health endpoint.

The same shape appeared **three more times while fixing this**, which is why it is worth
recording rather than treating as a one-off:

| Check | The trap |
|---|---|
| `tsc` baseline via `git stash -u` | `-u` also stashed the `node_modules` symlink, so tsc never ran. Zero parseable errors read as "clean baseline". |
| "Do the new tests catch the bug?" | Reverting the parser made the suite report `1 test, 1 fail` — a module *import* failure, not assertions catching anything. |
| `/health` after deploy | Identical response before and after the fix. It could only prove the service survived, never that new code was live. |

Each was caught the same way: **run the instrument against a case with a known answer
first.** A control sender that should return nothing. A `tsc --version` sanity line. A
secret-scanner fired at a planted fake key. If the instrument cannot produce a *positive*
on demand, its negative means nothing.

Corollary applied in the fix itself: replies are not marked invalid. Doing so would have
fired `incrementRejectedEmailCount()` and logged `REJECTED`, making genuine client mail
indistinguishable from a spoofing attempt — reproducing the exact conflation that hid
this outage. **Different failures must read differently.**

## Three Questions

1. **Hardest pattern to extract:** Separating "the allowlist was wrong" from the thing
   actually worth carrying forward. The regex typo is not reusable knowledge. The
   reusable part is that the broken gate was *shielding* an unreviewed code path, so the
   fix and the audit behind it had to ship together. That reframing only appeared after
   tracing what `validateSource` passing actually triggers downstream.

2. **What did you consider documenting but left out:** A push to make
   `rejectedEmailCount` persistent, per-platform, and alertable — the obvious "never
   again" fix. Left out because it is speculative design, not a lesson learned, and
   because a per-platform counter still cannot distinguish "no Yelp leads arrived" from
   "Yelp leads were rejected". The honest instrument is a *positive* one — assert that
   each configured platform has ingested at least one lead in N days — and that deserves
   its own cycle rather than a paragraph here. Also left out: the GigSalad
   booked-detection design and the Yelp reply-detection design, both live in the
   brainstorm and neither validated by a real lead yet.

3. **What might future sessions miss:** **The fix has never processed a real Yelp
   email.** Everything green is tests against fixtures built from observed senders. The
   whole path — poller → validator → parser → portal enrichment → pipeline — has never
   run end to end on live mail, and stage 4 (`YelpPortalClient.fetchLeadDetails`) is
   just as unexercised as the parser was, and by exactly the same mechanism. Expect the
   next defect there. Also easy to miss: `parseConfidence` is hardcoded `"low"` for
   Yelp, so leads *will* require portal enrichment and will not flow like GigSalad ones.

## Feed-Forward

- **Hardest decision:** Whether to add `gigs@gigsalad.com` while touching the allowlist.
  It was in my own earlier recommendation and I reversed it — accepting that sender
  without booked-detection existing would convert every payment receipt into a phantom
  lead. Fixing two channels at once was less valuable than fixing one correctly.

- **Rejected alternatives:** Loosening the allowlist to substring matching, which would
  have "fixed" Yelp in one character and quietly disarmed the anti-spoofing control that
  SPF/DKIM enforcement rides on. Also rejected: committing raw email samples as
  fixtures — they embed live `biz.yelp.com/login/passwordless/` URLs. Fixtures use
  same-shape placeholder tokens instead.

- **Least confident:** The business impact remains unmeasured, unchanged from the
  brainstorm. Nobody knows how many Yelp leads were lost, over what period, or whether
  any converted anyway because Alex answers Yelp in the app regardless of the system.
  Answering it needs a **copy** of the production leads table (count rows with
  `platform = 'yelp'`; expect zero) compared against Yelp's own dashboard — never a
  direct production read. Until then the size of this incident is genuinely unknown, and
  "we fixed it" should not be mistaken for "we know what it cost."

- **Still open:** the five other Yelp conversations were never ingested and nothing
  will retroactively pull them in. The Bash behaviour is unknown — if it resembles Yelp
  (email-visible replies) roadmap #1 expands reply coverage; if it resembles GigSalad
  (on-platform only) it does not. `form-submission@squarespace.com` has zero mail in the
  mailbox despite a parser existing for it, so that source's status is unresolved.
