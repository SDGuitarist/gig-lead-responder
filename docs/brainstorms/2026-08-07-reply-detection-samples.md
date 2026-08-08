---
title: Reply Detection — real sample survey (roadmap #3)
date: 2026-08-07
status: draft
---

# Reply Detection: what the mailbox actually contains

Pulled from Alex's connected Gmail on 2026-08-07 to unblock roadmap item #3,
"Reply Detection + Auto-Stop Follow-Ups", whose stated dependency was "real email
samples from GigSalad/The Bash to build reply parser."

**Search instrument was verified before trusting any negative result.** A known-present
sender (`leads@gigsalad.com`) returned data; a nonsense control sender returned `{}`.
So `{}` in this document means genuinely zero, not a failed query.

## Bottom line — READ THIS FIRST

**The survey went looking for reply samples and found a capture bug instead. Yelp leads
have never been able to enter the system.** `validateSource` cannot match the address
real Yelp lead mail comes from, so every one is rejected as `Unknown sender`. Six Yelp
conversations sit in the mailbox, three of them with client replies, and none of them
could have been ingested. See §4a — **confirmed by executing the live regexes against
the live sender addresses**, not inferred.

That outranks reply detection. Reply detection improves handling of leads already
captured. This is a channel that was never captured at all, and the roadmap's own
justification for item #1 is "every uncaptured lead is a missed gig."

The reply-detection findings below remain valid and are still worth building, after.

## Reply detection findings

The roadmap says "detect when a client replies (via Mailgun webhook or Gmail thread
check)." That framing assumes one mechanism. **It is source-specific, and for the
platform named in the dependency it does not exist at all.**

| Source | Client reply visible in Gmail? | Mechanism |
|---|---|---|
| **Yelp** | **YES — explicit, machine-readable** | Dedicated `RE:` notification per reply |
| **GigSalad** | **NO** | All mail is one-way notification; conversation is on-platform |
| **Squarespace** | N/A — zero mail exists | Parser exists in code, no matching mail |
| The Bash / WeddingWire | Not yet integrated (roadmap #1) | Unknown |

**Yelp is the only source that can drive reply detection today**, and it was not the
platform the roadmap dependency named.

## 1. Yelp — the usable signal

### Discriminators (strongest first)

1. **`utm_source` in body links** — `request_a_quote_new_message_respondable_email_v2`.
   Machine-readable email-type tag. Cleanest discriminator available.
2. **First line of `plaintextBody`** — `Hi <BizName>, <FirstName> has replied to your message.`
3. **Body header** — `New Message from <FirstName>`
4. **Subject prefix** — `RE: <BizName>'s response to <First> <LastInitial>.`
   Initial lead mail is the same subject *without* the `RE:` prefix.

Do not key on the subject alone. `RE:` is the weakest of the four and the most likely
to change or collide.

### Correlation key — how to match a reply back to a lead

The sender address carries a per-conversation token:

```
reply+<32-hex>@messaging.yelp.com
```

The token is **stable across an entire conversation.** In the sample set, the initial
lead notification and all three subsequent replies shared one token. This is the join
key. Capture it on the initial lead and match inbound replies against it.

A second durable id appears in the Respond Now URL path:
`/messaging/<inbox-id>/thread/<thread-id>`. Usable as a secondary key.

### Extracting the client's actual message

In `plaintextBody`, the client's text sits between the reviewer-stats line and the
`Respond Now` CTA. Redacted shape:

```
New Message from <First>

---
---
| | | [ <First> <L>. ](https://yelp.com/user_details?userid=<ID>&...)
---
**<City>, <ST>**
| | 0 | | 0
---|---|---|---
---

<<< THE CLIENT MESSAGE IS HERE >>>

---
---
| [ Respond Now ](https://biz.yelp.com/login/passwordless/redirect/<TOKEN>?...)
```

Real messages carry real qualifying content. One sample corrected the venue and
confirmed duration — exactly the sort of message that must stop a follow-up ladder.

### Idempotency requirement (non-obvious, from real data)

One client sent **three replies within 29 minutes**, producing three separate
notification emails on the same conversation token. Auto-stop must be idempotent:
three notifications must not produce three state transitions, three "replied" writes,
or three dashboard entries. Given `MAX_FOLLOW_UPS = 3`, an off-by-one here burns the
entire ladder.

## 2. GigSalad — no reply signal exists

Nine threads, **every one a single message**, all one-way. Sender variants:

| Sender | Purpose |
|---|---|
| `leads@gigsalad.com` | New lead + nudges ("unread lead", "waiting to hear from you") |
| `gigs@gigsalad.com` | Gig reminders and **payment notifications** |
| `yourfriends@gigsalad.com` | Marketing / quarterly stats |

Because the system **SMSes the draft to Alex** (`sendSms(lead.compressed_draft)`) and
he posts it on-platform, there is no outbound email for a client to reply to. There is
no thread to check and no inbound webhook to fire.

**Two usable proxies instead of a reply:**

- **Payment notification = booked.** `gigs@gigsalad.com`, subject `💸 We've just sent
  you a payment!`, body carries `booking #<id>` and an amount. A deposit arriving is
  stronger evidence than a reply and should hard-stop follow-ups and set
  `outcome: "booked"`.
- **Nudge = inverse signal.** "You have an unread lead from X" and "X is waiting to
  hear from you" mean Alex has *not* responded. Never treat these as replies. They are
  the opposite, and their wording is close enough to mislead a naive matcher.

## 3. Squarespace — parser with no traffic

`from:form-submission@squarespace.com` returns `{}` (verified against control). A
parser exists at `src/automation/parsers/squarespace.ts` with no corresponding mail.
Either the sender pattern changed, website leads route elsewhere, or none have arrived.
Worth resolving before counting website leads as a covered source.

## 4. Two defects found while surveying

### 4a. CONFIRMED — the Yelp allowlist cannot match any real Yelp sender

`src/automation/source-validator.ts:16`

```js
yelp: /^(no-reply|biz-alerts)@yelp\.com$/i,
```

The pattern is `^...$` anchored, and the file's docstring states the exactness is
deliberate: "Uses exact sender patterns (not substring matching)". Live Yelp lead and
reply mail arrives from `reply+<32-hex>@messaging.yelp.com`. Both halves fail: the local
part is not `no-reply`/`biz-alerts`, and `messaging.yelp.com` is not `yelp.com`. Anchoring
means there is no substring escape hatch.

Verified by running the live regexes against the live observed senders:

| Real sender | Result |
|---|---|
| `reply+<hex>@messaging.yelp.com` | **REJECT** — every Yelp lead and every Yelp reply |
| `gigs@gigsalad.com` | **REJECT** — payment / booking notifications |
| `leads@gigsalad.com` | ACCEPT — the only working path |
| `yourfriends@gigsalad.com`, `press@yelp.com`, `no-reply@mail.yelp.com` | REJECT — correct, marketing |

**Consequences:**

1. **Every Yelp lead is dropped at the door.** GigSalad new-lead mail is the only source
   the system has ever been able to ingest.
2. **`gigs@gigsalad.com` is also rejected**, so the payment-notification signal proposed
   above as the GigSalad booked-detector needs this sender added before it can work.

**Why this was never noticed:** `rejectedEmailCount` (line 27) is a plain in-memory
counter exposed via `/health`. It resets to 0 on every process restart, so on Railway it
reports near-zero almost always. A silently-dropped channel and a healthy one produce the
same reading. The counter cannot distinguish them, and it is the only instrument pointed
at this failure.

**Do not fix by loosening to substring matching.** The exactness is a deliberate
anti-spoofing control and SPF/DKIM enforcement depends on it. Add the real patterns
explicitly, e.g. `^reply\+[0-9a-f]{32}@messaging\.yelp\.com$` and
`^gigs@gigsalad\.com$`, and add a test per real observed sender.

### 4b. Security — these emails contain live authentication URLs

Yelp reply notifications embed `biz.yelp.com/login/passwordless/redirect/<TOKEN>` links,
which are bearer credentials. **Do not commit raw samples, and do not log full bodies.**
Any fixture must be redacted. Raw samples were deliberately not written to this repo.

## 5. Sample inventory (redacted)

| Source | Conversations | With replies | Notes |
|---|---|---|---|
| Yelp | 6 | 3 | One had 3 replies in 29 min |
| GigSalad | 9 | 0 | Structurally impossible via email |
| Squarespace | 0 | 0 | No mail at all |

Message ids and conversation tokens were left out on purpose. Re-pull from Gmail with
`from:yelp.com` when building fixtures, and redact before committing.

## Recommended order for the plan phase

**0. Fix the allowlist first (§4a).** Smallest change here, and the only one that
changes whether a channel exists. Add the real Yelp and `gigs@gigsalad.com` patterns
with a test per observed sender. Everything below is worth less until this lands,
because reply detection on a source that cannot be ingested is unreachable code.

Then split roadmap #3, which the evidence says is at least two features:

1. **GigSalad booked-detection via payment email** — do this first. A deposit with a
   booking number is unambiguous, and "money arrived" is a stronger stop condition than
   "someone replied." Depends on the `gigs@` sender fix above.
2. **Yelp reply detection** — cleaner parse, smaller channel. Depends on the Yelp
   sender fix above.

**Also worth re-checking:** `origin/HEAD` points at `feat/gig-lead-pipeline`, last
touched 2026-03-30 and **432 commits behind `main`**. Anything reading "the default
branch" is reading a March snapshot. Same stale-pointer class as §4a's counter.

## Three Questions

1. **Hardest decision in this session?** Whether "no results" from Gmail meant absence
   or a broken query. Resolved by verifying the instrument against both a known-present
   sender and a nonsense control before trusting any negative.
2. **What did you reject, and why?** Writing raw email samples into the repo as
   fixtures. They contain client PII and live passwordless login URLs. Redacted
   structural specs give the parser everything it needs without the hazard.
3. **Least confident about going into the next phase?** §4a is settled at the code level
   (the regexes provably cannot match the observed senders), but **the business impact is
   not measured.** Unknown: how many Yelp leads were dropped over what period, and
   whether any converted anyway because Alex answers Yelp on the app regardless of the
   system. The intended instrument, `rejectedEmailCount`, cannot answer this — it is
   in-memory and resets on restart. Answering it needs the production leads table
   (count rows with `platform = 'yelp'`; expect zero) compared against Yelp's own
   dashboard. **Per the standing rule, copy the DB before querying it — do not read
   production directly.**

   Also still unverified: whether The Bash behaves like Yelp (email-visible replies) or
   like GigSalad (on-platform only). That determines whether roadmap #1 expands reply
   coverage or not.
