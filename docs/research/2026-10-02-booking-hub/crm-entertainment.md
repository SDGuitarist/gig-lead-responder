# Entertainment / DJ / Musician CRM tools: features to borrow for Pacific Flow

All pages accessed **2026-10-02**. Pricing and features come from vendor pages. Complaints come from review sites or competitor blogs and are labeled that way. **UNVERIFIED** means I could not confirm it on a vendor page. "Not found" means the page I read did not mention it. That does not prove the feature is missing.

**How the quotes were captured:** pages were read through a fetch tool that summarizes them. Text in quote marks was returned as verbatim, but I did not compare it character by character against the raw HTML. **Before quoting any policy line to a vendor or a platform, re-open the URL and check it yourself.**

## Pages I could not reach (not filled from memory)
- GigSalad Terms of Service (`gigsalad.com/terms`, `gigsalad.com/user-terms`): HTTP 403, blocked by a Cloudflare JavaScript challenge, through both the fetch tool and curl. The scraping and bot clauses shown in the marketplace section came **only from a search-engine snippet** and are labeled that way.
- `djeventplanner.com/pricing.htm`, `djintelligence.com/pricing`, `bandhelper.com/pricing.html` and `gigwell.com/features` returned 404. I used other vendor URLs instead (cited below).

---

## Comparison table

| Tool | Lead response | Quote → e-sign → invoice | 50% retainer + day-of balance | Off-platform payments / fees | Auto calendar + reminders | Multi-contact / staffing | Music planning | Venue / COI | Integrations | Price (vendor page) |
|---|---|---|---|---|---|---|---|---|---|---|
| **Check Cherry** | Lead forms, automated email and SMS, open/click/reply tracking. No AI drafting found. No marketplace import found | Yes: proposal → e-sign with "Deposit collected at signing" → auto invoices | Yes: deposit as a fixed amount or a percentage, plus a custom schedule | **Yes: manual methods (cash, Venmo, Zelle, check) are recorded by hand.** Cards cost 2.9% + 30¢ | Two-way Google, Outlook and Apple sync. Trigger-based reminders | Staff scheduling and accounts. Multi-contact not found | Questionnaires. Song requests are "Optional" in the portal | Not found | Zapier, Developer API, Webhooks | $29 / $59 / $139 per month |
| **DJ Intelligence** | Contact forms, availability checker, Instant Quote. Auto-responder UNVERIFIED | Yes: Instant Quote, PDF contracts, built-in ESIGN/UETA e-sign, invoices | Balance management yes. Exact % schedule UNVERIFIED | PayPal, Stripe, Square. Can pass fees on "as service charges" | Calendar sync every 1–4 h depending on plan. Automated email and text reminders | 1–100 staff logins, staff permissions | **Strong: 100k-song request library, guest requests by QR code, planning forms with lockout dates, timelines** | "Unlimited… venues" in the CRM. COI not found | Zapier, Mailchimp, Google Calendar | $15 / $25 / $35 / $45 per month (annual $150–$450). 2-month trial |
| **DJ Event Planner (DJEP)** | "Request information form", customized autoresponders, scheduled emails | E-sign in the client portal. Quote generator, invoices | UNVERIFIED | PayPal API, payment gateway. Offline payments UNVERIFIED | Hourly iCalendar updates (Advanced tier) | Access levels: Sales, DJ, Admin. Employee limit by tier | Music request manager, online music database, timeline generator | Not found | Data import tools. API and Zapier not found | $20 / $35 / $50 per month. 30-day trial |
| **Gigwell** | Embeddable booking request form, Gmail-linked contacts | Contract templates → e-sign → payment link sent automatically after signing → invoicing | Deposits yes. % schedule UNVERIFIED | Online payments. Fees UNVERIFIED | Google Calendar integration, itineraries | "Centralized Contacts", multi-artist (agency plan) | Not offered | Tour IQ venue database (capacity). Advancing templates. COI not found | API and Zapier UNVERIFIED | **Conflict:** $49/mo (annual, Artist Essentials page) vs $250/mo (pricing page). $99 setup fee on monthly billing |
| **BandHelper** | Contact log plus follow-up reminders. No lead auto-reply | Invoices with paid/unpaid tracking. Contracts are attachments only. No e-sign found | Not offered as a schedule (tracks transactions and funds) | Finance module, per-member balance report | iCal feed. Automated email/SMS reminder before an event | **Strong: availability requests (accept/decline), subs added at no cost to them, gig details on bandmates' phones** | Set lists and repertoire. Audience request form UNVERIFIED | Not found | Spreadsheet export. No API or Zapier found | Solo $16–$32/yr. 2–5 members $40–$80/yr |
| **Vibo** | Not offered (music planning only) | Not offered | Not offered | Not offered | Client notifications and deadlines | Team members $20/mo each | **Strong: Must Play / Play If Possible / Do Not Play, guest suggestions with host approval, 100+ timeline templates, PDF export, M3U export** | Not offered | Zapier (creates events from DJEP or HoneyBook bookings), Spotify, Apple Music | $179/mo, or $149/mo billed yearly |
| **Gigbuilder** (extra) | Two-way texting, live availability widget, AI email generation (Pro+) | Digital contract signing, invoices, e-payment | Deposit tracking. % schedule UNVERIFIED | UNVERIFIED | Availability management | **Multi-staff assignment with confirmation tracking** | Must-plays / do-not-plays, timelines | Not found | Developer API (Premium only) | $25 / $35 / $50 per month. 14-day trial |
| **GigSalad (vendor side)** | Saved messages and saved quotes with shortcodes such as `[date]`. Manual send only | Quote → client books and pays on-platform. Custom terms can be added to the quote | Client pays deposit and balance in one transaction at booking. Balance released 1–2 business days after the event | **All bookings must go through GigSalad.** Booking fee 2.5% (paid) / 5% (free) / 10–12.5% if you "mark as booked" | Not offered | Not offered | Not offered | Not offered | No public API found | Membership price UNVERIFIED (pricing page not fetched) |
| **The Bash (vendor side)** | Saved responses. Auto-Add leads expire in 48 h | Quote with deposit toggle → "Book Now" | **Yes: deposit amount, due date, refundable or non-refundable flag.** Vendor collects the balance | EventPay: free for the vendor, client pays a 2.95% service fee. Deposit cap $2,000, balance cap $5,000. Booking fee 5% ($20 minimum) | Calendar on The Bash | Not offered | Not offered | Not offered | No public API found | Membership price UNVERIFIED |
| **Yelp (Request a Quote)** | Reply from the app or the web. Three reply types (estimate, need more info, unable to service). **Leads API + official Zapier integration (New Lead trigger, Create Message action)** | Estimate only | n/a | n/a | n/a | n/a | n/a | n/a | Leads API, Zapier | Free to receive |

---

## Per-tool notes

### 1. Check Cherry
Sources: https://www.checkcherry.com/pricing · https://www.checkcherry.com/features · https://www.checkcherry.com/articles/88-how-event-pros-get-paid-payment-plans-auto-pay-and-more (all accessed 2026-10-02)
- **Lead response:** "Lead Forms: Embed traditional web forms directly into your website"; "Automated email and SMS workflows" that "Track opens, clicks, and replies." No AI drafting found. No GigSalad or Bash import found (a search returned nothing).
- **Flow:** "Proposals / Quotes: Craft the perfect offer, send it out with email or text for signature and deposit"; "Legally binding electronic signatures" with "Deposit collected at signing"; "Auto-generated invoices that update with every payment."
- **Payment schedule:** "Payment plans can run monthly, weekly, or split into equal installments after the deposit, and you can customize the schedule for a specific event." Auto-pay: "The client's card is saved at booking, scheduled payments run on time."
- **Off-platform:** "About a third of payments recorded on Check Cherry are still collected by hand: checks, cash, Zelle, Venmo. Every one of those payments is a person asking, waiting, and logging the money after it shows up." Fees are 2.9% + 30¢. Their advice is to raise prices about 5% rather than add a fee at checkout.
- **Calendar:** "Two-way sync with Google Calendar, Outlook, and Apple Calendar." Triggers include booking confirmed, payment reminder, planning-form reminder, event reminder, post-event review request.
- **Staff:** "Assign staff to events. They see their schedule."
- **Integrations:** Zapier, Developer API, Webhooks.
- **Price:** Standard $29/mo (30 upcoming bookings), Growth $59/mo (100), Unlimited $139/mo.
- **Complaints (Capterra, review site):** an initial learning curve, and the mobile app needs design updates. https://www.capterra.com/p/229208/Check-Cherry/reviews/
- **Borrow:** treat cash, Venmo, Zelle and check as first-class payment rows that are logged by hand, next to card payments. **Trap:** a 30-booking cap on the cheapest tier means you pay more as you grow.

### 2. DJ Intelligence
Sources: https://www.djintelligence.com/plans/ · https://www.djintelligence.com/features/
- Plans: $15 / $25 / $35 / $45 per month. E-signatures are "Not Included" on Basic, with 25, 125 and 250 per month on higher tiers. Automated emails are capped at 50–1,000 per month. Texts cost $0.04–$0.07 each. Calendar sync runs every 4 h on Basic and every hour on Enterprise. "No setup fees… Cancel anytime." 2-month free trial.
- Payments: Basic is "PayPal Only". Higher tiers allow "All Processors", with an option to pass processing fees on "as service charges."
- Music: a client playlist drawn "from a library of over 100,000 songs", guest requests by QR code with tallying, and "Planning Forms" that clients save as they go, "with lockout dates for deadline enforcement."
- Complaints (competitor blog, biased): dated UI, clients must create an account, not mobile-first. https://songboard.app/blog/dj-intelligence-review/
- **Borrow:** **planning-form lockout dates**, so the questionnaire freezes X days before the event. **Trap:** caps on e-signatures and emails per month, and a calendar sync that can lag up to 4 h.

### 3. DJ Event Planner (DJEP)
Sources: https://www.djeventplanner.com/pricing.php · https://djeventplanner.com/features.asp · https://www.djeventplanner.com/client-portal.php (seen only as a search snippet)
- Price: StandAlone $20, Premium $35, Premium Plus $50 per month. 30-day trial, no card needed. Tiers differ by employee limit (10 / 20 / 500). "Advanced features include Hourly iCalendar Updates, PayPal API, Data Import Tools."
- Features: "Request information form", "Scheduled Emails", "Music request manager", "Timeline generator", access levels "Sales, DJ, Administrator." E-sign and the portal appear in search snippets of DJEP's own pages but not on the features page I fetched.
- Complaints (competitor blog, biased): the portal "looks like it was built in 2010"; clients need a login; poor mobile. https://songboard.app/blog/dj-event-planner-review/
- **Borrow:** separate roles for sales, performer and admin. **Trap:** client portals that need a login. Every login screen lowers how many clients finish the questionnaire.

### 4. Gigwell
Sources: https://www.gigwell.com/pricing · https://www.gigwell.com/artist-essentials · https://www.gigwell.com/ (search snippet)
- **Pricing conflict:** the pricing page shows Artist Essentials at "$250/month (billed annually)". The Artist Essentials page says "$49 per month" billed annually, plus a "$99 setup fee" on monthly billing. Treat both figures as unresolved.
- Search snippet from gigwell.com: "The minute a contract is signed, Gigwell automatically sends your client a direct payment link." Also: advancing templates, itinerary builder, Google Calendar integration, and a mobile app with offline access to contracts.
- Built for touring artists and agencies, not wedding bands. No music planning.
- **Borrow:** the auto-sent payment link right after signing, so signature and deposit become one moment. Also an **itinerary or "advancing" sheet per gig** (load-in, contact on site, parking). **Trap:** agency-grade pricing and setup fees for one operator.

### 5. BandHelper
Sources: https://www.bandhelper.com/main/pricing.html · https://www.bandhelper.com/main/features.html · https://www.bandhelper.com/support/FAQ.html · https://www.bandhelper.com/main/comparison.html
- Price: solo Pro $3.75/mo or $32/yr. 2–5 users Pro $8/mo or $80/yr. 6–20 users Pro $12/mo or $120/yr.
- "Request that your bandmates accept or decline new events"; "puts the details for each gig right onto your bandmates' mobile devices"; "Configure an automated email and/or SMS reminder before an event"; "Generate invoices to send to clients and keep track of which invoices have been paid"; "Log each interaction with your contacts… Schedule future interactions with reminders"; "Feed your events to your personal iCalendar-compatible software"; "View a report showing how much of the band's current balance is due to each member."
- Subs: per a search snippet of bandhelper.com, band leaders can "add substitute players to their account without requiring that the subs purchase anything" (not seen on a fetched page).
- Export: "account administrators can use the Export buttons… to export those items to standard spreadsheet files." No API found.
- **Borrow:** **availability request to hired musicians (accept/decline) plus a per-musician payout report.** This is the closest match to Alex hiring mariachi or trio players. **Trap:** no e-sign, no client payments and no lead tools. It is a band-ops tool, not a sales CRM.

### 6. Vibo
Sources: https://vibodj.com/pricing · https://vibodj.com/ · https://help.vibodj.com/en/articles/6846521-using-zapier-with-vibo-automate-event-creation (seen as a search result) · https://www.myweddingsongs.com/reviews/vibo/ (search snippet, third-party)
- Price: $179/mo monthly, or $149/mo billed yearly. Extra DJ $20/mo. 14-day trial.
- Music planning: "Must Play", "Play If Possible", "Do Not Play" lists; guest suggestions "with final approval from the event organizer". This detail comes from a third-party review snippet and was not seen on vibodj.com. Also "+100 events timeline templates", PDF export, client notifications and deadlines.
- Integrations: Zapier, used to create a Vibo event when the CRM (DJEP or HoneyBook) confirms a booking. Spotify sync. M3U export.
- **Borrow:** **three-bucket music lists (Must / If Possible / Do Not Play)** plus a timeline template for each event type (ceremony, cocktail hour, reception). **Trap:** $149–$179/mo for a music-planning tool alone.

### 7. Gigbuilder (extra: DJs and event pros)
Source: https://www.gigbuilder.com/
- $25 / $35 / $50 per month. "AI included" on Pro, and the "developer API" only on Premium. Two-way texting. "Multi-staff assignment with confirmation tracking." Must-plays and do-not-plays. Runs as a PWA (an installable web app).
- **Borrow:** **staff confirmation tracking** (who said yes to the gig) and a PWA so it works on the phone without an app store. **Trap:** the API is only on the top tier.

### 8. GigSalad (vendor side)
Sources: https://help.gigsalad.com/article/114-top-performer-status · https://help.gigsalad.com/article/36-responding-to-gig-leads · https://help.gigsalad.com/article/140-creating-saved-messages · https://help.gigsalad.com/article/177-booking-requirements-for-all-members · https://help.gigsalad.com/article/40-collecting-payments · https://help.gigsalad.com/article/64-client-contact-information · https://help.gigsalad.com/article/173-how-gigsalad-monitors-and-removes-leads
- Saved messages and saved quotes chosen from a dropdown, with shortcodes (example: "[date]").
- **Booking requirements (last updated June 15, 2026 per the page):** "All bookings must be processed through the platform." Prohibited: "Accepting payment outside of GigSalad without marking the lead as booked", "Steering clients away from the platform to avoid booking fees", "Sending quotes to only cover a portion of the booking." Fees: 2.5% for paid members, 5% for free members, 10–12.5% when a lead is marked booked. Enforcement is three strikes, then "Permanent account removal without refund."
- Payments: "they will pay the total amount (deposit and balance) in one transaction at the time of booking"; "Payments will be sent 1-2 business days after the event."
- Contact info: "Our User Terms require all GigSalad leads to be booked through our platform. If you share contact information and discuss event details directly, you must return to the site when you're ready to secure the booking." GigSalad does "not provide client email addresses."

### 9. The Bash (vendor side)
Sources: https://itg.thebash.com/best-practices-for-responding-to-leads · https://itg.thebash.com/habits-top-100-bookers-response · https://itg.thebash.com/auto-add-gigs · https://itg.thebash.com/10-things · https://itg.thebash.com/deposits · https://itg.thebash.com/booking-gigs · https://itg.thebash.com/meet-eventpay · https://www.thebash.com/terms-of-use
- Deposit: "A deposit can be requested upon submitting a quote… enter the deposit amount." Typical deposits: "10-50% as the going rate." Vendors can make it refundable or non-refundable and choose the due date.
- Balance: "You are responsible for collecting the remaining balance."
- Booking fee is 5% ($20 minimum), taken from the client's deposit when EventPay is used. Outside bookings can be added to The Bash calendar "and receive credit," at the same 5%.
- EventPay: "free for vendors"; "Party planners are charged a 2.95% Service Fee." Caps are a $2,000 deposit and a $5,000 balance. U.S. only.

---

## Marketplace automation rules (the question asked)

### GigSalad
- **Do they allow automated or bot replies?** No explicit rule found on the pages I could reach. Help docs describe saved messages that are **picked and sent by hand**. No auto-send feature is documented: https://help.gigsalad.com/article/140-creating-saved-messages. The Terms of Service could not be read (403). A **search snippet** (not verified on the page) paraphrases the Global Terms (revised Jan 28, 2025) as prohibiting "using software, devices, scripts, robots, or any other means or processes (including crawlers, browser plugins…) to scrape the GigSalad Platform." That clause is about **scraping**. Whether it also covers **auto-replying** is UNVERIFIED. GigSalad's own blog recommends ChatGPT for drafting canned replies and says to personalize them (https://www.gigsalad.com/blog/use-chatgpt-to-get-gigs/, search snippet only). There is no public API.
  - **Practical read:** an AI-drafted reply that Alex pastes or sends himself matches GigSalad's documented workflow. A browser bot that logs in and sends replies has no documented support, may hit the scraping clause, and the full terms are unread. Do not build it until the terms are read.
- **Do they reward speed?** Yes. "Respond to at least 80% of your gig leads within 24 hours", measured over the previous 3 months, with a 4.8-star average and at least 1 booking every 3 months, earns Top Performer. "Profiles with Top Performer status will be given priority in search results within their current membership level." A decline counts as a response. https://help.gigsalad.com/article/114-top-performer-status. Also: "The first to respond often gets the gig!" https://help.gigsalad.com/article/36-responding-to-gig-leads

### The Bash
- **Do they allow automated or bot replies?** No explicit rule on auto-replies found. The Terms of Use (§7) forbid harvesting or scraping "using an automated software tool (including but not limited to use of robots, spiders, or similar means)" and (§27) "tactics… that attempt to circumvent the Services… to book events… outside of the Services… designed to avoid paying required fees." The terms also list "failing to reply to gig-alert or other e-mails in a timely fashion" as grounds for suspension. https://www.thebash.com/terms-of-use. Saved responses are supported. There is no public API.
- **Do they reward speed?** Yes. "Members receive the Rapid Responder badge on their profile if they have an average response time of 24 hours or less" (https://itg.thebash.com/habits-top-100-bookers-response). A second Bash page adds a 99%+ response-rate condition (https://itg.thebash.com/best-practices-for-responding-to-leads), so the two pages are inconsistent. "The average response by vendors on The Bash is 9 hours, while our most successful vendors respond within 6 hours." Auto-Add leads: "1 in 3 gigs goes to the vendor that responds first"; with no reply in 48 h the lead is "marked as declined… and the request will be sent to another vendor"; "Almost 50% of all bookings on The Bash are from auto-added leads!" Ranking: "Your booking dollars in the past 6 months is one of the key factors in ranking higher in search results" (https://itg.thebash.com/10-things).

### Yelp (Request a Quote / Yelp for Business messaging)
- **Do they allow automated or bot replies?** There is a **sanctioned path**: the Leads API and an official Zapier integration with a "Create Message" action, for any business owner with a Yelp Business Account and Request-a-Quote enabled (https://docs.developer.yelp.com/docs/leads-api-zapier-integration). The rules come from the **Yelp Leads Program Agreement** (last updated Sept 24, 2026), https://docs.developer.yelp.com/docs/yelp-leads-agreement:
  - §5.d: "**Auto-responders are discouraged.**"
  - §5.d: "**AI-generated responses are permitted, but they must be reviewed by human staff** to ensure authenticity and compliance with the FTC's guidelines on authentic reviews."
  - §5.d: "Avoid using templates or inauthentic language when responding… avoid mindless copy-pasting." "Word choice should vary between responses."
  - §5.c: "Responses should directly address the quote request."
  - §5.g: "**If AI is used in generating responses or reviews, this must be clearly disclosed to consumers.**"
  - §6.f: the partner "shall not use Customer Data… to train, fine-tune, or improve any artificial intelligence or machine learning models."
  - Caveat: this agreement is written for API partners. How much of it binds a business using Zapier directly is UNVERIFIED. It is still Yelp's clearest written position.
- **Do they reward speed?** Yes. "Your response time is the median time you took to respond to new messages in the last 30 days, not including After Hours (6pm-8am)." Response rate is "the percentage of new messages you responded to in the last 30 days" (https://biz.yelp.com/support-center/article/How-is-the-response-time-and-response-rate-calculated-for-messaging-my-business). "Businesses with a response time of less than a day see 4x more requests" (https://biz.yelp.com/support-center/article/How-do-I-respond-to-a-quote-request-for-my-business). Penalty: "If you go 7 days without replying to a new message and you have not responded to any message in the past 30 days, the feature will be automatically disabled" (https://biz.yelp.com/support-center/article/How-do-I-turn-messages-or-quote-requests-for-my-business-on-or-off). No direct effect on search ranking is documented.

**The design these rules point to:** draft automatically, approve from the phone, and log response time per platform. Yelp is the only one of the three with an approved programmatic reply path, and even Yelp requires a human to review AI replies and requires AI use to be disclosed.

---

## Top 10 features to borrow
1. **Draft-first replies with one-tap approval from the phone.** This is the default Yelp writes into its rules (AI allowed if a human reviews it), and it is the only automation pattern that fits all three marketplaces.
2. **A response-time clock per lead, per platform**, compared against each platform's own threshold: GigSalad 80% within 24 h over 3 months; The Bash 24 h average and a 48 h Auto-Add expiry; Yelp's median outside 6pm–8am. Alert before the deadline, not after.
3. **Yelp Leads via the official Zapier trigger** (New Lead → your app). This is the one lead source with an approved way in.
4. **Signature plus deposit in one step** (Check Cherry "Deposit collected at signing"; Gigwell's payment link sent right after signing).
5. **Manual payment rows for Venmo, Zelle, cash and check**, logged against the payment schedule, with an "expected vs received" check (Check Cherry: about a third of payments are still collected by hand).
6. **A payment schedule template:** 50% non-refundable retainer at signing, balance on the day, with the refundable/non-refundable flag stored per payment (The Bash deposit tool has this flag).
7. **Planning-form lockout dates** (DJ Intelligence). The questionnaire freezes a set number of days before the event and triggers a reminder before that.
8. **Must Play / Play If Possible / Do Not Play lists plus timeline templates per event type** (Vibo, Gigbuilder). Map these to ceremony, cocktail hour and reception for weddings.
9. **Availability requests to hired musicians with accept/decline, plus a per-musician payout report** (BandHelper, Gigbuilder confirmation tracking).
10. **A per-gig advancing sheet** (Gigwell itinerary/advancing): contacts on site, load-in, parking, power, COI status. None of these tools has a dedicated COI tracker, so this is a gap worth filling.

## Top 5 traps
1. **Leaving marketplace bookings.** GigSalad requires every booking to go through the platform, charges 10–12.5% on leads marked booked, and removes accounts without refund after repeated violations. Alex's "50% retainer by Square, Venmo or Zelle" flow **breaks GigSalad's booking rules when used on GigSalad leads** (a terms-of-service problem, not a legal one). The app needs a "marketplace-booked" state where payments are tracked as happening on the platform. The Bash allows outside bookings but charges 5% and wants them reported.
2. **Auto-send bots on marketplaces.** Yelp discourages auto-responders and requires human review and disclosure of AI. GigSalad's terms are unread (blocked). The Bash only documents saved responses. A fast canned auto-reply can earn the response-time badge and still lose the client, and it risks the account.
3. **Tier caps that bill growth:** Check Cherry limits upcoming bookings (30 on $29); DJ Intelligence caps e-signatures, emails and calendar-sync frequency per month; Gigbuilder keeps its API on the top tier only.
4. **Client portals that require a login** (DJEP and DJ Intelligence, per competitor blogs, which are biased sources). Use magic-link or no-login forms.
5. **Calendar sync that lags** (DJ Intelligence syncs every 4 h on Basic). Forgetting calendar entries is one of Alex's named pain points. Write to the calendar when the booking happens; do not rely on polling.

## Coverage notes
- About 55 searches and fetches were used.
- Not verified: GigSalad and The Bash membership prices, Gigwell API and Zapier, DJEP offline payments, any tool's COI tracking, and BandHelper's audience request form.
