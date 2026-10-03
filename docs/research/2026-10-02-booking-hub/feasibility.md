# Booking-App Integration Feasibility Report

Date: 2026-10-02. All sources accessed 2026-10-02 unless noted. Read-only research; nothing was signed up for.
Method: ~60 web searches and fetches. Several official pages returned HTTP 403 to the fetcher (GigSalad /terms, Twilio support articles, Thimble, NEXT help center). Where that happened, the claim comes from a search-engine summary of that page and is labelled **(search summary)**. Treat those as one step weaker than a direct read.
**UNVERIFIED** means I could not find a source for the claim.

---

## 1. Lead platforms: GigSalad, The Bash, Yelp

**Verdict:**
- **Yelp: Feasible with caveats** (official path via Zapier).
- **GigSalad: Feasible with caveats**, but only by email reply. Portal automation is prohibited.
- **The Bash: Not feasible to automate legitimately.** The app can only alert the owner; a human replies in the portal.

### Official paths
| Platform | Official API? | Email reply-to works? | Automation (Playwright) allowed? |
|---|---|---|---|
| GigSalad | No public vendor API found | **Yes.** "reply directly to the email notification, and it will be sent back to the client as a message, just as if you had sent it through the site." Client email addresses are never provided. | **No.** The terms forbid using "software, devices, scripts, robots, or any other means or processes (including crawlers, browser plugins...)" to scrape the platform or copy data **(search summary)** |
| The Bash | No public API found | **Not documented.** The help pages only describe clicking the link in the email and quoting in the portal (total rate, deposit, message). Reply-by-email is UNVERIFIED and probably unsupported. | **No.** Section 7 forbids harvesting or scraping "using an automated software tool (including ... robots, spiders, or similar means)". Section 27 forbids vendors from contacting a client about a Bash gig "outside of The Bash". There are also separate AI Terms banning "any automated or programmatic method to extract data". |
| Yelp | The **Leads API** exists but is "limited to Yelp advertising and listing management reseller partners" with a "minimum spend requirement". The leads data covers only "businesses that are currently advertising on Yelp". Rate limits: 5 requests/sec per endpoint, 500 requests/day by default. | **Yes.** "you can respond to the request by simply replying to the email". | ToS §7 bans "any robot, spider ... or other automated device". Business-account terms ban "automated means ... to access, query or otherwise collect Yelp data". |
| Yelp via Zapier | **Official for non-partners.** Yelp's docs say: "For those who are not reseller partners, we recommend utilizing our Zapier integration". Triggers: New Lead, New Consumer Message. Actions: **Create Message (reply to the lead)**, Mark as Replied, Mark as Read. Requirements: a Yelp Business account with Request-a-Quote enabled, plus a Zapier account. | n/a | n/a |

### Costs
- GigSalad and The Bash: membership fees only (not researched).
- Yelp Zapier: Zapier plan cost (not researched). **UNVERIFIED:** whether the Zapier integration, like the Leads API, requires active Yelp advertising. The Zapier docs do not mention it.

### Failure modes
- **ToS enforcement.** Browser automation on any of the three is a terms violation. The likely penalty is account suspension, which would cut off the lead source itself.
- **Bot detection.** I could not confirm what bot protection GigSalad or The Bash actually use (UNVERIFIED). General 2026 sources say Playwright's default Chromium has a TLS (JA3) fingerprint that matches no real Chrome release, and that Cloudflare Turnstile challenges are triggered by automation signatures. Expect logins to break at random.
- **Email-reply parsing.** Inbound parsing depends on notification email formats, which have no published spec and can change without notice. Replies also go out from the owner's mailbox, so whatever is sent counts as the owner's own message.
- **Off-platform rules.** GigSalad requires "all GigSalad leads to be booked through our platform". Deposits and contracts for GigSalad and The Bash leads may therefore have to go through the platform, not Square or the app. This needs checking against each platform's booking-fee rules (UNVERIFIED in detail).

### Sources
- https://www.gigsalad.com/terms (search summary; direct fetch 403)
- https://help.gigsalad.com/article/64-client-contact-information
- https://www.thebash.com/terms-of-use
- https://www.thebash.com/ai-terms
- https://itg.thebash.com/respond-pro
- https://docs.developer.yelp.com/docs/leads-api
- https://docs.developer.yelp.com/docs/leads-api-zapier-integration
- https://biz.yelp.com/support-center/article/How-do-I-respond-to-a-quote-request-for-my-business (search summary)
- https://terms.yelp.com/tos/en_us/20200101_en_us/
- https://alterlab.io/blog/playwright-bot-detection-what-actually-works-in-2026 (community)

---

## 2. Owner approval alerts: SMS vs. alternatives

**Verdict: Feasible.** For a single recipient (the owner), **avoid SMS entirely.** A Telegram bot or Pushover is simpler, free or nearly free, needs no carrier registration, and supports approve/reject buttons or links.

### Twilio A2P 10DLC (sole proprietor)
- **Eligibility.** For people "without a business Tax ID (EIN)" who file taxes under their own SSN. If Alex has an EIN, he must register as a standard brand instead.
- **One-time code.** A code is sent to his mobile number; "You must respond to this OTP within 24 hours".
- **Limits.**
  - One campaign, with "only ... one 10DLC phone number".
  - 1 message/second.
  - 1,000 segments/day to T-Mobile and 15 messages/min to AT&T (search summary of Twilio help).
  - The same mobile number can be used for at most 3 sole-proprietor registrations.
- **Costs** (search summary of Twilio pricing article): $4.50 brand fee (raised from $4.00 on 2025-08-01), $15 campaign vetting fee, $2/month campaign fee. Phone-number rental and per-message carrier fees come on top (amounts not verified).
- **Timeline.** Brand approval takes minutes. Campaign vetting "might take several weeks" according to the Twilio docs; a Twilio help article says "up to 5 business days" (search summary). **Plan for weeks.**
- **Failure mode.** Unregistered 10DLC traffic has been **blocked** since 2023-09-01 (error 30034). Even a text to your own phone needs registration. Toll-free numbers are an alternative: from 2026-02-17 they require a business registration number for every business type *except* sole proprietor, but sole proprietors "face additional vetting" (search summary).

### Alternatives that avoid 10DLC
| Option | Cost | Limits | Notes |
|---|---|---|---|
| **Telegram bot** | Free: "bots are able to message their users at no cost" | About 1 message/second per chat | Works from Railway (no Mac needed). Inline keyboard buttons make one-tap Approve/Reject easy (button feature from general knowledge, not fetched). Alex must install Telegram. |
| **Pushover** | $4.99 one-time per platform (iOS, Android, Desktop) | 10,000 messages/month free | Plain HTTPS POST from Railway. Supports URLs for approve links. |
| **ntfy.sh** | Free hosted tier: 250 messages/day | Burst of 60, refilling 1 every 5 s | On iOS, a self-hosted ntfy server still needs to relay through ntfy.sh's upstream for Apple push; without that, notifications "arrive late or not at all". |
| **iMessage to self from the Mac** | Free | n/a | **Least reliable option.** See section 3: silent send failures on macOS 26, the Mac must be awake and logged in, and messages to your own Apple ID may notify without sound (Apple Community thread). |
| Signal bot | Free | n/a | No official bot API; needs the unofficial signal-cli (UNVERIFIED stability). |

**Simplest and most reliable for one recipient: a Telegram bot.** It runs on Railway with no Mac dependency, is free, has an official API, and offers two-way buttons. Pushover is the runner-up if Alex does not want Telegram, but approvals would be one-way links rather than in-chat replies.

### Sources
- https://www.twilio.com/docs/messaging/compliance/a2p-10dlc/direct-sole-proprietor-registration-overview
- https://support.twilio.com/hc/en-us/articles/9550596959643-A2P-10DLC-Sole-Proprietor-Brands-FAQ (403; search summary)
- https://support.twilio.com/hc/en-us/articles/1260803965530-Pricing-and-Fees-for-A2P-10DLC-Service (403; search summary)
- https://support.twilio.com/hc/en-us/articles/1260804800549-T-Mobile-Daily-Message-Limits-for-Long-Code-Messaging-with-A2P-10DLC (search summary)
- https://help.twilio.com/articles/14910496447771-Shutdown-of-Unregistered-10DLC-Messaging-FAQ
- https://www.twilio.com/docs/api/errors/30034
- https://www.twilio.com/en-us/changelog/business-registration-numbers-required-for-toll-free-messaging-p (search summary)
- https://core.telegram.org/bots/faq
- https://pushover.net/pricing
- https://docs.ntfy.sh/faq/ and https://www.xda-developers.com/set-up-self-hosted-notification-service/ (search summary)

---

## 3. Reading and sending iMessages on macOS

**Verdict: Feasible with caveats for reading. Fragile for sending.** Do not put iMessage on the critical path.

### Official path
**There is none.** Apple publishes no API for Messages. Every approach relies on undocumented internals:
- **Reading:** query the SQLite file `~/Library/Messages/chat.db` directly.
- **Sending:** AppleScript (`tell application "Messages" ... send`) or Shortcuts.

### Permissions (TCC)
- Reading `chat.db` requires **Full Disk Access** for the *responsible process*.
- On macOS 26.2, a LaunchAgent or Login-Item-launched Node process **did not inherit** Full Disk Access. Reads failed with `authorization denied (code: 23)`.
- **Workaround from that report:** start the service from a `.command` file run by Terminal.app, which already has Full Disk Access, added as a Login Item.
- Sending via AppleScript also needs Automation permission (Terminal → Messages).

### The attributedBody problem
- Modern macOS often leaves `message.text` NULL. The real text sits in `attributedBody`, an NSAttributedString serialised in Apple's legacy "typedstream" format.
- Simple decoders guess at it: they look for "the first NSString value in the blob", which "can misfire on messages with unusual rich formatting".

### Maintained libraries
- **ReagentX/imessage-exporter** (Rust, GPL-3.0). It includes a reusable `imessage_database` crate with a real typedstream decoder. Its README lists support up to "macOS ... 27.0 (26A428)". It is the most maintained option found. GPL matters only if the app is distributed.
- Node options seen: `imessage-kit` (photon-hq) and `imsg`. Maintenance status is UNVERIFIED.

### Stability
- Every macOS update can change the `chat.db` schema or TCC behaviour. The Mac must stay logged in with Messages signed in.
- **Main failure mode (sending):** on macOS 26.2, AppleScript `send` and `imsg send` "return success signals but never actually deliver messages". The issue was closed as not planned. Sequoia 15.1 users also reported attachment sends timing out as "Not Delivered".
- **This is a gate that cannot tell success from failure.** If iMessage sending is used at all, verify each send by reading the row back from `chat.db` and checking it was delivered.

### Sources
- https://github.com/ReagentX/imessage-exporter
- https://github.com/openclaw/openclaw/issues/5116
- https://glama.ai/mcp/servers/@jonmmease/jons-mcp-imessage/blob/3af876d28c0efe9f24b18db9936155308736c4b9/docs/IMESSAGE_DATABASE_FORMAT.md (community)
- https://www.macscripter.net/t/is-sending-imessages-sms-mms-by-scripting-the-messages-program-completely-unreliable/76738 (community)
- https://www.macscripter.net/t/sequoia-messages-send-file/76468 (community)
- https://discussions.apple.com/thread/255435943 (self-message notification behaviour; community)

---

## 4. Payment detection

**Verdict:**
- **Square: Feasible.** Official API and webhooks.
- **Venmo and Zelle: Feasible with caveats.** No API exists; the only route is parsing notification emails, which is spoofable and has no published format.

### Square Invoices API
- **Deposit plus balance with separate due dates is supported.** "A deposit with the balance due later" uses one `DEPOSIT` and one `BALANCE` payment request, each with its own `due_date` (YYYY-MM-DD).
- **Invoices Plus (search summary: $20/month, 30-day trial) is required only for installments** (2–12 `INSTALLMENT` requests) and custom fields. "To use custom fields or installment payments, the seller ... must have an active (or trial) Invoices Plus subscription."
- **Conflict:** Square's *marketing* pricing page lists "Payment schedule" under Plus. The developer docs say deposit + balance does not need Plus. **Confirm in the Square sandbox before building.**
- **Webhooks:**
  - `invoice.payment_made` is "Published when a payment that is associated with an invoice is completed."
  - `invoice.scheduled_charge_failed` also exists.
  - **UNVERIFIED:** whether the deposit alone fires `invoice.payment_made`. Test it in the sandbox. The payload includes per-request `total_completed_amount_money`, which can tell the deposit and balance apart.
- **Security:** validate the `x-square-hmacsha256-signature` header (HMAC-SHA-256 over the notification URL plus the raw body) with a constant-time comparison.
- **Costs:** the API itself is free. Processing fees are per transaction (search summary: 2.9% + 30¢ online card; ACH rate not verified).
- **Failure mode:** webhook retry duration is not documented on the page read. Add a periodic reconciliation poll (Invoices `GET`) so a missed webhook cannot leave a paid deposit marked unpaid.

### Venmo
- The Developer and Payouts APIs are **closed to new businesses**: retired in Feb 2016, with only pre-2016 integrations keeping access (TechCrunch 2016; venmo.com/docs/sdks per search summary). Current Venmo acceptance runs through PayPal/Braintree checkout, which is a merchant checkout and does not detect payments sent person-to-person.
- **Business profile:** 1.9% + $0.10 per transaction (third-party summaries). Using a *personal* profile for goods and services breaks Venmo's user agreement and risks a frozen account (third-party summaries; the official user agreement was not fetched, UNVERIFIED wording).
- **Email parsing:** there is no published format spec (UNVERIFIED). Venmo says it emails only from addresses ending in "venmo.com". **Fake "payment received" emails and screenshots are a common scam**, so a parser must check DKIM/SPF/DMARC pass for venmo.com in the Gmail `Authentication-Results` header. Never treat the sender address as proof.

### Zelle
- **No merchant or developer API.** Zelle is a bank-to-bank network run by Early Warning Services. The only APIs are bank-side (BNY Mellon, J.P. Morgan treasury), aimed at institutions (search summary).
- **Notification emails come from the receiving bank** (Chase, BofA, etc.), not from Zelle. Their format differs by bank and is undocumented (UNVERIFIED). Apply the same DKIM rule, scoped to Alex's own bank's domain.

**Recommendation:** make Square the primary deposit and balance rail, detected by webhook. Treat Venmo and Zelle as "probable payment" signals from parsed emails that the owner must confirm with one tap. Never auto-advance a booking on a parsed email alone.

### Sources
- https://developer.squareup.com/docs/invoices-api/overview
- https://developer.squareup.com/docs/invoices-api/create-publish-invoices
- https://developer.squareup.com/reference/square/objects/InvoicePaymentRequest (search summary)
- https://developer.squareup.com/reference/square/invoices-api/webhooks/invoice.payment_made
- https://developer.squareup.com/docs/webhooks/step3validate
- https://squareup.com/us/en/invoices/pricing
- https://www.subscriptioninsider.com/topics/payment-processing/square-launches-invoices-plus-paid-subscriptions (search summary, $20/mo)
- https://techcrunch.com/2016/02/26/how-not-to-run-a-platform/
- https://venmo.com/docs/sdks/ (search summary)
- https://help.venmo.com/cs/articles/unexpected-emails-from-venmo-vhel219 (search summary)
- https://www.zelle.com/business
- https://ez-qr.com/blog/zelle-qr-code-complete-2026-guide (third-party; "no Zelle developer API")

---

## 5. Google Calendar API and Gmail API

**Verdict: Feasible.** The weekly re-auth problem is avoidable, as described below.

### Push vs. polling
**Gmail push:**
- Needs a Cloud Pub/Sub topic with publish rights granted to `gmail-api-push@system.gserviceaccount.com`.
- "You must call the watch method at least once every 7 days".
- Rate is "one event per second" per user; excess notifications are dropped.
- Notifications carry only a historyId, so the app then calls `history.list`.
- **UNVERIFIED:** the push docs do not say whether personal @gmail.com accounts are supported. They are widely used that way, but treat it as an assumption to test.

**Calendar push:**
- Needs a public HTTPS webhook with a valid, non-self-signed certificate. Railway provides one.
- Notifications "do not include a message body", so the app must sync with a syncToken afterwards.
- "there's no automatic way to renew a notification channel", so the app must re-create channels before they expire.

**Recommendation:** for one mailbox, **polling `history.list` every 1–2 minutes is simpler and nearly as fast.**
- Cost: 2 quota units per call, against a limit of 6,000 units per user per minute.
- It needs no Pub/Sub, has no watch-renewal job to forget, and keeps working if Railway's URL changes.
- Polling should stay as a backstop even if push is added.
- Note: Google says charges for usage over 80M units/day per project are planned "later in 2026". That is irrelevant at this scale.

### OAuth: the 7-day problem
- Official rule: an external-user-type project in **"Testing"** status "is issued a refresh token expiring in 7 days, unless the only OAuth scopes requested are ... name, email address, and user profile." Gmail and Calendar scopes are not in that exception.
- **Fix: switch the consent screen to "In production" without submitting for verification.** Google's "When is verification not needed" page says: "If the app is for your personal use (fewer than 100 users), you and your limited number of users can continue using the app without going through verification". Users "click through 'unverified app' warning screens", and a 100-user cap applies.
- Once in production, refresh tokens no longer expire on a 7-day timer.
- **Other ways a refresh token dies** (official list):
  - The user revokes access.
  - The token goes unused for 6 months.
  - **The password changes (when Gmail scopes are held).**
  - More than 100 refresh tokens exist per account per client; the oldest is invalidated "without warning".
- **Practical rules:**
  - Store one refresh token and never re-run consent in a loop.
  - Alert the owner (via the Telegram channel) on any `invalid_grant` error. That error is the "auth broke" signal and must not be swallowed as "no new mail".
- **Scope choice:**
  - `gmail.readonly`, `gmail.modify` and full `mail.google.com` are restricted scopes. Under personal use that only matters for the warning screen.
  - `gmail.send` is a sensitive scope.
  - `calendar.events` is sensitive (from general knowledge; scope classifications were not fetched individually).

### Sources
- https://developers.google.com/gmail/api/guides/push
- https://developers.google.com/workspace/calendar/api/guides/push
- https://developers.google.com/workspace/gmail/api/reference/quota
- https://developers.google.com/identity/protocols/oauth2 (Refresh token expiration section)
- https://support.google.com/cloud/answer/13464323?hl=en
- https://support.google.com/cloud/answer/7454865?hl=en (search summary)

---

## 6. E-signature without DocuSign

**Verdict: Feasible.**

### Legal basis (not legal advice)
- **ESIGN Act, 15 U.S.C. §7001(a):** a contract "may not be denied legal effect, validity, or enforceability solely because an electronic signature or electronic record was used in its formation". An e-signature is any "electronic sound, symbol, or process, attached to or logically associated with a contract ... and executed or adopted by a person with the intent to sign".
- **California UETA (Civ. Code §1633.1–1633.17):** §1633.7 gives the same rule. UETA applies only where "parties each ... agreed to conduct the transaction by electronic means". That agreement can be inferred from conduct, but stating it in the contract is safer.
- ESIGN's §7001(c) consumer-consent procedure applies to disclosures that *other law requires in writing*. That probably does not cover a private performance contract (UNVERIFIED for California consumer-contract specifics; ask a lawyer if it matters).
- **So the "pre-signed PDF, client returns a signed PDF" flow is legally valid in principle.** The weak point is *proof*: showing who signed and that the document was not altered. That is what e-sign services' audit trails provide. Practical rules:
  - Keep the original PDF's hash and the return email (headers, timestamp, sender).
  - Include an "agree to sign electronically" clause.

### Cheap e-sign APIs
| Service | Price | Notes |
|---|---|---|
| **SignWell** | Free developer account: 3 docs/month. API plan: first **25 docs/month free** with a card on file, then $0.85/doc falling to $0.20 at volume. | **Conflict:** the fetched pricing page also mentioned a "$275/month base" for "Standard API". Re-check before relying on the free 25. Webhooks are available for viewed, signed and declined events; exact event names UNVERIFIED. |
| **Dropbox Sign API** | Essentials $75/mo (50 requests), Standard $250/mo (100 requests), Premium custom. **Test mode is free.** | Too expensive for 2–10 contracts a month. |
| **Documenso** | Self-hosted **free (AGPL-3.0)**. Cloud: Free 5 docs/mo, Individual ~$25/mo, Teams ~$40/mo, Platform ~$250/mo (third-party teardown). | Needs Postgres. Self-hosting on Railway is possible (a Railway template exists). AGPL obligations apply only if the app is distributed or networked to others in a way that links Documenso code; running it for one's own use is fine (general AGPL reading; not legal advice). Webhook event names UNVERIFIED. |

### Detecting a signed return
- **Best:** an e-sign service's "completed" webhook, plus downloading the completed PDF and audit trail. This is deterministic.
- **Second best:** parsing an emailed PDF.
  - A *cryptographic* signature appears as an AcroForm field of type `/Sig` whose `/V` points to a signature dictionary holding PKCS#7 `/Contents`, with `/SigFlags` set on the AcroForm.
  - pdf-lib "does not currently provide any specialized APIs ... for reading the contents of existing digital signatures". Use a lower-level parser or node-signpdf.
  - **But most clients will not produce a cryptographic signature.** Preview, Acrobat "Fill & Sign", or a phone scan add a drawn image or annotation, or a flattened page, and there is no reliable way to detect that.
  - **So "a PDF came back" is all that can be detected.** Route it to the owner as "signed contract received?" for one-tap confirmation. Never treat it as proof of signature.

### Sources
- https://uscode.house.gov/view.xhtml?req=%28title%3A15+section%3A7001+edition%3Aprelim%29
- https://codes.findlaw.com/ca/civil-code/civ-sect-1633-7/
- https://www.law.cornell.edu/wex/electronic_signature
- https://www.signwell.com/api-pricing/
- https://sign.dropbox.com/products/dropbox-sign-api/pricing
- https://docs.documenso.com/users/licenses/community-edition
- https://dev.to/beton/documenso-pricing-teardown-2026-3ic6 (third-party)
- https://pdf-lib.js.org/docs/api/classes/pdfsignature and https://github.com/Hopding/pdf-lib/issues/39

---

## 7. Certificates of insurance (COI) for event liability

**Verdict: Feasible with caveats.** No insurer found offers a policyholder API for issuing certificates. The best automation is **an annual policy with unlimited self-serve additional insureds**: a person issues each COI in under 2 minutes, and the app reminds them and stores the PDF. Per-event policies cannot be automated without breaking ToS or using a portal bot.

| Provider | Model | Self-issue additional-insured COI? | API? |
|---|---|---|---|
| **EventHelper** | **Per-event only** (examples: $66 small wedding, ~$400 for a 2,500-person concert). Annual policies are not mentioned. | "Download or email your certificates of insurance" from the portal after purchase. | **No public API.** It has a broker partner portal and a "Venue Program" only. ToS on automation UNVERIFIED (terms not fetched). |
| **Insurance Canopy** (performers/musicians) | Annual from **$199/yr ($18.50/mo)**; event from $59 | **Yes.** "add one additional insured for $5 or an unlimited number for $10 during checkout or anytime from your online dashboard", then "download your COI immediately". | None found |
| **ERGO NEXT (NEXT Insurance)** | Annual general liability, ~$18–20/mo (third-party). Offers a "music entertainer" class (third-party). | **Yes.** The "Live Certificate" is free, with unlimited certificates and additional insureds added "with the click of a button" in the web or mobile app (search summary; help-center fetch 403). | None found |
| **Hiscox** | Annual general liability | Yes: generate a COI "with your email address and policy number"; add an additional insured via an online form (search summary). | None found. **Eligibility for musicians/entertainers is UNVERIFIED.** |
| **Thimble** | Hourly, daily or monthly; has a musician/DJ page | UNVERIFIED (page returned 403) | None found |

**Failure modes:**
- Some venues require specific wording (primary/non-contributory, waiver of subrogation) that a self-serve additional-insured option may not include. That needs a human check.
- Automating an insurer portal with Playwright has the same ToS and bot-detection risk as section 1.

### Sources
- https://www.theeventhelper.com/
- https://www.theeventhelper.com/blog-posts/partner-portal-walkthrough (search summary)
- https://www.insurancecanopy.com/entertainment-insurance/performers/musicians
- https://www.next-insurance.com/faq-category/live-certificate/ (search summary)
- https://www.nextinsurance.com/business/dj-insurance/ and https://fitsmallbusiness.com/best-dj-insurance-companies/ (search summary)
- https://www.hiscox.com/manage-your-policy and https://www.hiscox.com/small-business-insurance/contract-insurance-requirements/additional-terms (search summary)
- https://www.thimble.com/industry/event-business-insurance/musician (403)

---

## 8. Guardrails for auto-sending LLM-drafted messages

**Verdict: Feasible**, if auto-send is decided by **deterministic gates, not an LLM confidence score.**

### Published patterns
- **OWASP LLM01:2025 (prompt injection) mitigations:**
  - "use deterministic code to validate adherence to these formats"
  - "handle these functions in code rather than providing them to the model"
  - "Require human approval for high-risk actions"
  - "Segregate and identify external content"
  - adversarial testing
- **"Design Patterns for Securing LLM Agents against Prompt Injections"** (Beurer-Kellner, Tramèr et al., arXiv 2506.08837, June 2025). Its core principle: "once an LLM agent has ingested untrusted input, it must be constrained so that it is impossible for that input to trigger any consequential actions". The patterns that fit this app:
  - **Action-Selector.** The LLM picks from a fixed list of templates and actions.
  - **Plan-Then-Execute.** The plan is fixed before untrusted text is read.
  - **Dual LLM.** A quarantined model reads customer text and outputs only structured fields; a privileged layer, which never sees raw text, decides what to do.
  - **Context-Minimization.**
- **LLM-as-judge confidence is unreliable as a gate.** Research documents an "overconfidence phenomenon where predicted confidence significantly overstates actual correctness" (arXiv 2508.06225), plus self-preference bias (a judge favours its own model's output) and verbalised scores collapsing toward the same few values. A judge score alone **must not** authorise sending.

### Recommended shape (synthesis)
1. **Extract, don't converse.** A quarantined model turns the customer's message into a strict JSON schema (date, venue, hours, budget, questions), validated by code.
2. **Facts come from a source of truth, not the model.** Price, deposit percentage, availability, dates and payment terms come from the database and calendar. They are rendered into the template by code. The drafted text is then checked by code: every dollar amount, date and percentage in the draft must exactly match an allow-listed value. Any extra number blocks the send.
3. **Hard gates force human review** (any one triggers it):
   - first contact with a new client
   - any money or contract wording
   - discounts or negotiation
   - date not confirmed free
   - an extraction field missing or low-certainty
   - the customer text contains instruction-like content or links
   - complaints or cancellations
   - message length over the cap
4. **Auto-send allowlist is narrow.** Only templated, fact-checked replies of a few named types (for example "received, will confirm by X" or a reminder with database-sourced details). The LLM may adjust wording only inside slots.
5. **The judge is advisory.** An LLM check can *add* reasons to hold a message, never remove them.
6. **Owner approval via Telegram** (section 2), with a timeout that defaults to *not sending*.
7. **Log every auto-sent message** with the exact gate results, so a wrong send can be traced.

### Sources
- https://genai.owasp.org/llmrisk/llm01-prompt-injection/
- https://arxiv.org/abs/2506.08837
- https://simonwillison.net/2025/Jun/13/prompt-injection-design-patterns/
- https://arxiv.org/html/2508.06225v2
- https://arxiv.org/pdf/2412.05579 (LLM-as-judge survey)

---

## Biggest feasibility risks for this plan (ranked)

1. **Lead-platform automation is mostly prohibited.**
   - The Bash: no API, no documented email reply, and its ToS bans bots and off-platform contact.
   - GigSalad: bans scripts and bots, but allows email replies.
   - Yelp: the official route is Zapier only.
   - Building Playwright portal bots risks suspension of the accounts that *generate the leads*, which is the costliest failure in the plan.
   - Design for: email-reply where allowed (GigSalad, Yelp), Zapier for Yelp, and **owner alert plus manual reply for The Bash**.
2. **iMessage on the spare Mac fails silently.**
   - Send calls report success while delivering nothing (macOS 26.2).
   - Full Disk Access does not pass to LaunchAgent children.
   - The schema can change with any macOS update.
   - Keep it off the critical path; use Telegram or Pushover for owner alerts.
3. **Venmo and Zelle have no API.**
   - Payment detection by parsed email is spoofable and format-fragile.
   - It must be DKIM-verified and owner-confirmed.
   - Moving deposits to Square removes this risk for most bookings.
   - Platform-booked gigs (GigSalad, The Bash) may have to take payment on-platform anyway.
4. **Signed-contract detection without an e-sign service is not reliable.**
   - Client-returned PDFs rarely carry cryptographic signatures.
   - Use SignWell's free tier (re-verify pricing) or self-hosted Documenso for a deterministic "completed" event.
5. **LLM auto-send safety.**
   - A confidence-score gate gives false assurance (judges are overconfident).
   - Deterministic fact allow-lists and hard gates are required before any unattended send.
   - Prompt injection via customer text is in scope from day one.
6. **Google OAuth breaking quietly.**
   - Testing mode means 7-day tokens. Fix: publish to production unverified under personal use.
   - A password change or revocation still kills the token.
   - `invalid_grant` must raise an alert, never read as "no new mail".
7. **COIs are per-event only at EventHelper, with no API there or at any insurer found.**
   - Automation stops at "remind owner and store PDF".
   - An annual policy with unlimited self-serve additional insureds (Insurance Canopy $199/yr + $10, or NEXT Live Certificate) makes the human step about 2 minutes.
8. **SMS via Twilio is the wrong tool for owner alerts.**
   - Registration can take weeks and costs about $21.50 plus $2/month plus number and carrier fees.
   - Unregistered sends are blocked. Avoid it unless SMS to *clients* is later required, in which case register early.

### Items to verify by execution before relying on them
- Whether Square's deposit-only payment fires `invoice.payment_made`, and whether deposit + balance truly needs no Plus subscription (sandbox test).
- Whether the Yelp Zapier integration requires active Yelp advertising.
- Whether The Bash accepts email replies.
- SignWell's actual free API tier.
- Gmail push working for a personal @gmail.com account.
- Whether Hiscox and Thimble cover solo musicians.
