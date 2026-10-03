# Service-Business / Creative CRMs: what to borrow for the Pacific Flow app

Research date and access date for every URL: **2026-10-02**. Read-only, about 60 searches and fetches.

## How to read the sources

- **[V]** means I fetched the vendor page directly and read it.
- **[V-s]** means the text came from a web-search excerpt of a vendor help page. I did not open the page itself. The excerpt is probably right, but check it before you rely on it.
- **[3P]** means a third-party blog. I used these only where the vendor page was blocked, and I say so each time.
- **[U]** means user complaints from G2, Capterra, Trustpilot, Reddit or review blogs. These are labeled as complaints, not as facts about the product.
- **UNVERIFIED** means I did not find the fact, or the page was blocked. It does **not** mean the feature is missing.

**Blocked or broken pages:** G2 (403), the VSCO plans page (403, and curl returned a 5.5 KB bot wall), workspace.vsco.co/pricing (404), and the Capterra HoneyBook URL (it led to a different product). The Studio Ninja pricing page was cut off in WebFetch, so I read it with curl.

**No tool here showed evidence of importing leads from GigSalad, The Bash, Thumbtack or Yelp.** I searched for this directly for HoneyBook and in a general entertainer-CRM search. HoneyBook's import help page names no sources. Treat this as "not found", not as "proven absent".

---

## Comparison table

| # | Item | HoneyBook | Dubsado | 17hats | Bonsai | VSCO Workspace (ex-Táve) | Studio Ninja | Check Cherry (extra: musicians/DJs) |
|---|---|---|---|---|---|---|---|---|
| 1 | Lead response | AI-drafted reply for each new inquiry; you review and send, also from the phone app. Needs at least 20 earlier inquiries through its form. "Priority lead" push alerts. No auto-send mentioned [V]. Automations can auto-respond on Essentials and up [V]. Marketplace import: none found | Lead forms (1 on Starter, unlimited on Premier); workflows can auto-respond on Premier only [V]. No AI drafting found. Marketplace import: none found | Lead management on all levels [V]. AI: UNVERIFIED. Marketplace import: none found | CRM and forms on all tiers [V]. AI: UNVERIFIED | Lead tracking, two-way SMS (US and Canada), automated workflows [V] | Lead sources and lead management on all tiers; contact forms 1 / 3 / unlimited [V] | Lead management, email automation, SMS (needs Twilio) [V]. Marketplace import: UNVERIFIED |
| 2 | Quote → contract → invoice in one flow | Yes. The "smart file" puts proposal, contract and invoice together [V-s] | Yes. Proposals, contracts, invoices; public proposals on Premier only [V] | Quotes, contracts, invoices (document caps: 20 / 35 / unlimited per month) [V] | Proposals, contracts, invoices; online invoices on Essentials and up [V] | Quotes, contracts, invoices; payment schedule flows into the contract [V-s] | Quotes, contracts, invoices on all tiers [V] | Online booking: the client picks a package, signs and pays the deposit in one session [V] |
| 3 | 50% retainer + balance on event day | Two-payment schedule is possible. The example given is "retainer at booking, balance 30 days out". **Whether "due on the event date" can be set relative to the event is UNVERIFIED** [V-s] | **Yes, and the clearest of all.** Percentage installments, with due dates relative to "before/after project start", "after contract signed", and others, in days, weeks or months [V-s] | Yes on Level 2 and up. Due dates can be relative to "document received, the project date, the final due date, or a custom date" [V-s] | Deposit on proposals/contracts **works only with Bonsai Payments** and auto-creates a deposit invoice [V-s]. Due date for the balance: UNVERIFIED | Payment schedules exist and have tokens such as `{{payment_schedule.retainer}}` and `final_date` [V-s]. Relative rules: UNVERIFIED | Yes. Deposit, then balance "a set number of days before the session date" [V-s] | Deposit plus custom schedules, with reminders before each payment [3P/V-s] |
| 4 | Logging off-platform payments; card fees | **Mark as Paid** with method and date (cash, check, Venmo, PayPal). Only works on **preset** payment plans, not "client selects plan", and not on recurring payments [V-s]. Card fees "start at 2.7% + 10¢"; ACH 1.5% [V] (a third-party site says 2.9% + $0.25 [3P]; the vendor figure wins) | "Log a payment": Cash, Check, Credit, E-transfer, Other. Venmo and Zelle are logged by hand only, and there are "no plans" to integrate them [V-s]. Card 2.9% + $0.30; ACH 0.8%, capped at $5; instant payout 1% [V] | "Record Payment" for cash or check, with a reference note [V-s]. Processors: Stripe and Square [V]. Fees UNVERIFIED | "Receive Payment": mark fully paid or record a partial payment [V-s]. Card 2.9% + $0.30; ACH 1%; **an extra 1% platform fee if you use Stripe or PayPal instead of Bonsai Payments** [V-s] | Record Payment (amount, method, who paid, memo), and it can split a payment across orders or gratuity [V-s]. Rails: Stripe and Square [3P]. Fees UNVERIFIED | Record Payment for transfer, cheque or cash [V-s]. Stripe integration [V]. Fees UNVERIFIED | Card 2.9% + 30¢ [V]. Off-platform logging UNVERIFIED |
| 5 | Calendar on booking; reminders | Payment reminders 7 days before, on the day, and 2 days after the due date (each can be switched on or off) [V]. Auto calendar entry: UNVERIFIED | Workflows (Premier) [V]. Calendar: UNVERIFIED | Document reminders and scheduled emails on Level 2 and up [V] | Automations on all tiers [V] | Automated invoice reminders; session reminders [V] | Payment reminders on all tiers; Google Calendar integration [V] | Calendar sync with Google, iCal and Outlook; automatic reminders [V] |
| 6 | Several contacts per project; templates by client type | Yes. "+ Add participant" as Contact, Collaborator or Team; "related workspaces" keep some files private [V-s] | UNVERIFIED | UNVERIFIED | UNVERIFIED | Job Types exist (help article title) [V-s] | "Job Type Customisation" [V] | Packages per event type [V] |
| 7 | Questionnaires / portal / call scheduling | Portal on all plans; Scheduler on Essentials and up [V] | Portal on both plans; Scheduler on Premier only [V] | Portal and advanced workflows on Level 3 only; scheduling is a $5–10/month add-on [V] | Portal on all tiers; scheduling on Essentials and up (1 event type on Basic) [V] | Portal; online scheduling [V] | Questionnaires, portal and appointment booking on all tiers [V] | Questionnaires (song requests, must-play and do-not-play lists, timeline); portal [V] |
| 8 | Document tracking per venue (COI, licenses) | Not found | Not found | Not found | Not found | Not found | Not found | Not found |
| 9 | API / webhooks / Zapier / MCP / export | Zapier with an account API key; triggers include New Inquiry, Project Booked, Stage Changed, Meeting Scheduled [V-s]. **Official MCP launched 2026-08-19** (read and write pipeline, projects, invoices, contracts; builds files from templates; approval for each resource) [V]. ChatGPT app 2026-09-09 (everything arrives as a draft) [V]. No public developer API program [3P] | No public developer API; in-account inbound and outbound webhooks; Zapier on Premier only (lead created, project created, contract signed, status changed) [3P + V] | Zapier on Level 3 only [V]; reported to sync contacts only, with no public API [3P] | Zapier on Premium and up; data exports on all tiers [V]. Public API: UNVERIFIED | **Public REST API v2** with self-made read/write or read-only keys [V]. Outbound "Web Request" automation [V-s]. No native webhooks [3P] | Integrations listed: Gmail, Google Calendar, Xero, QuickBooks, Stripe, gallery tools [V]. **No Zapier or API listed**; UNVERIFIED | Zapier ("2,000+ apps") [V]. API is "mentioned" on the band page [V]. Details UNVERIFIED |
| 10 | Price today; setup | Starter $36/month or $29 billed yearly; Essentials $59 or $49; Premium $129 or $109 [V for yearly and list prices; monthly from 3P]. Starter has **no automations and no scheduler** [V]. First template about 2–3 hours [U] | Starter $335/year, Premier $525/year [V]. Monthly about $35 / $55 [3P]. Setup **15–25 hours** [U] | Pricing page shows "$60/month, $600/year" without a clear tier mapping. **Level prices UNVERIFIED.** Add-ons from $5/month [V] | Basic $15/user/month ($9 yearly), Essentials $25 ($19), Premium $39 ($29), Elite $59 ($49, at least 3 users) [V] | Included in **VSCO One at $499.99/year** [V]. Standalone tiers (Solo $24.99, Boutique $34.99, Studio $49.99) [3P only, UNVERIFIED] | Starter $16/month ($160/year, **5 active jobs, no automations**), Pro $27 ($270), Master $40 ($400) USD [V] | Standard $29/month ($348/year), Growth $59, Unlimited $139 [V]. The band landing page says "from $39" [V], so the vendor contradicts itself |
| 11 | Borrow / avoid | See per-tool notes | | | | | | |

---

## Per-tool notes

### HoneyBook (the baseline Alex left)
- **Cost today.** Yearly billing: $29, $49 or $109 per month. List prices: $36 (from a third party), $59 and $129 per month. Source: honeybook.com/pricing [V]. Third parties say prices were restructured in February 2025 (Starter went from $19 to $36 per month, up 89%), and that the 20% loyalty discount ended February 2026 ([agencyhandy](https://www.agencyhandy.com/honeybook-pricing/), [weddingsaas](https://www.weddingsaas.com/blog/honeybook-price-hike-legacy-tax)) [3P]. **The cheapest plan has no automations and no scheduler.** That is exactly the "manual work" Alex described.
- **Lead response.** AI email drafts for new inquiries. You can change the tone, then review, edit and send, from desktop or the mobile app. Priority-lead alerts need **at least 20 earlier inquiries** through HoneyBook's own contact form. Source: [honeybook.com/blog/honeybook-ai-features](https://www.honeybook.com/blog/honeybook-ai-features) [V]. The AI only learns from leads that came through its own form, so leads arriving by GigSalad email or by text don't feed it.
- **Payments.** "Mark as Paid" exists for cash, check, Venmo and PayPal, but **only on preset payment plans**. It is blocked on "client selects plan" and on recurring payments ([help 2209075](https://help.honeybook.com/en/articles/2209075-marking-payment-as-paid-client-paid-outside-of-honeybook)) [V-s]. Reminders go out 7 days before, on the day, and 2 days after the due date ([payment-reminders](https://www.honeybook.com/product/payment-reminders)) [V].
- **Integrations.** Zapier, using an API key from settings ([product/integrations/zapier](https://www.honeybook.com/product/integrations/zapier)) [V]. **The HoneyBook MCP launched 2026-08-19.** It can create and update projects and clients, build a proposal, invoice or contract from your templates, publish it, and request a payment. "Permission is granted resource by resource" ([blog](https://www.honeybook.com/blog/introducing-the-honeybook-mcp-ask-claude-about-your-pipeline-invoices-and-contracts); setup: [help 16381018](https://help.honeybook.com/en/articles/16381018-set-up-the-honeybook-connector)) [V]. The ChatGPT app launched 2026-09-09: "Nothing is sent, changed or issued without that approval" ([GlobeNewswire](https://www.globenewswire.com/news-release/2026/09/09/3358831/0/en/honeybook-launches-on-chatgpt-as-part-of-openai-s-new-small-business-collection.html)) [V].
- **Complaints [U].** Trustpilot: 4.0 out of 5 from 735 reviews. Quotes: "the software has legitimately handled less and less of what we needed it for"; "so many quirks and is so slow"; "Crazy you can't pull a report on outstanding balances"; "Not a great way to track communication unless you send an email that's tracked" ([trustpilot](https://www.trustpilot.com/review/honeybook.com)). Review blogs say the automations "can feel like a lot of work to set up" and templates "feel rigid" ([goodbrandpartners](https://www.goodbrandpartners.com/blog/honeybook-automations), [assembly](https://assembly.com/blog/honeybook-reviews)). A Reddit photographer complained it keeps "adding tons and tons of shit I don't need or use" (quoted via [prospeo](https://prospeo.io/s/honeybook-alternatives)).
- **Borrow:** the one-tap "review the AI draft, then send" from the phone.
- **Avoid:** the core workflow (automations and scheduling) is locked behind a paid tier, and "outstanding balances" can't be reported.

### Dubsado
- **Price.** $335 or $525 per year ([dubsado.com/pricing](https://www.dubsado.com/pricing)) [V]. Third parties say monthly billing became about $35 / $55 on 2025-12-01 with Dubsado 3.0 ([raoura](https://www.raoura.com/blog/dubsado-pricing)) [3P]. **Workflows, the scheduler and Zapier are Premier only** [V].
- **Payment plans are the model to copy.** Percentage, fixed or equal splits, and the installments must add up to 100%. Due dates are relative to before or after project start or end, "after contract signed", or "after payment plan applied", in days, weeks or months ([help 467089](https://help.dubsado.com/en/articles/467089-payment-plans-in-2-0)) [V-s]. "50% at signing, 50% zero days after project start" fits Alex's terms exactly.
- **Off-platform payments.** "Log a payment" with methods Cash, Check, Credit, E-transfer, Other. Dubsado has "no plans" to integrate Venmo or Zelle ([help 15920709](https://help.dubsado.com/en/articles/15920709-managing-manual-payments)) [V-s]. Fees: 2.9% + $0.30; ACH 0.8%, capped at $5 ([help 8901346](https://help.dubsado.com/en/articles/8901346-dubsado-payments-processing-fees)) [V].
- **Integrations.** No public API. In-account webhooks plus Zapier ([supergood](https://supergood.ai/docs/dubsado-api)) [3P].
- **Complaints [U].** "15 to 25 hours" to set up; users spend their trial "configuring their first Flow"; workflows "confusing and scary", with fear of automated emails going out at the wrong time; "don't even try to use it without watching tutorials" ([agiled](https://agiled.app/blog/dubsado-review), [taskip](https://taskip.net/dubsado-reviews/)).
- **Borrow:** payment rules based on relative dates.
- **Avoid:** a general-purpose workflow builder that the user has to design.

### 17hats
- **Price.** The pricing page shows "$60/month, $600/year, $800 for 2 years" and a Cyber Monday banner, which looks stale on 2026-10-02. **The price for each level is UNVERIFIED** ([17hats.com/pricing](https://17hats.com/pricing)) [V]. Payment schedules need Level 2. Portal, advanced workflows and Zapier need Level 3. Scheduling is a $5–10/month add-on.
- **Payments.** "Record Payment" with cash, check and a reference note ([help 924616](https://help.17hats.com/en/articles/924616-how-do-i-record-a-payment-manually)) [V-s]. Due dates can be relative to the project date ([release note](https://17hats.releasenotes.io/release/izJ6W-custom-due-dates-on-payment-schedules)) [V-s].
- **Complaints [U].** Contract and questionnaire editor described as "ancient"; need to "refresh 2-3 times"; clients receiving duplicate invoices; Zapier syncs contacts only ([agencyhandy](https://www.agencyhandy.com/17hats-reviews/), [supergood](https://supergood.ai/api-report-card/17hats)).
- **Borrow:** a payment-schedule anchor based on the project date (same idea as Dubsado).
- **Avoid:** basic features (payment schedules, portal) split across tiers and paid add-ons.

### Bonsai
- **Price.** Per user per month: $15/$9, $25/$19, $39/$29, $59/$49 ([hellobonsai.com/pricing](https://www.hellobonsai.com/pricing)) [V]. Billed per seat. Online invoicing starts at Essentials. Zapier starts at Premium.
- **Payments.** Deposits **only through Bonsai Payments**. The deposit invoice is created automatically and titled "Project Name Deposit" ([help 8021691](https://help.hellobonsai.com/en/articles/8021691-taking-upfront-payments-deposits-with-proposals)) [V-s]. "Receive Payment" lets you mark an invoice fully paid or record a partial payment ([help 2899880](https://help.hellobonsai.com/en/articles/2899880-how-to-manually-mark-invoices-as-paid)) [V-s]. There is an **extra 1% platform fee** if you use Stripe or PayPal ([help 452273](https://help.hellobonsai.com/en/articles/452273-understanding-online-payment-methods-and-fees-at-bonsai)) [V-s]. Built for freelancers (time tracking, projects) rather than events.
- **Complaints [U].** Payouts held 7–10 business days; "double billing"; support waits of 9+ days ([assembly](https://assembly.com/blog/hello-bonsai-review), [trustpilot](https://www.trustpilot.com/review/hellobonsai.com)).
- **Borrow:** the deposit invoice that creates itself when a proposal is accepted.
- **Avoid:** tying deposits to the vendor's own payment processor.

### VSCO Workspace (formerly Táve)
- **Price.** The vendor page lists only **VSCO One at $499.99/year** (about $41.67/month), which includes Workspace ([vsco.co/workspace](https://www.vsco.co/workspace)) [V]. Standalone tiers come from third parties only. **UNVERIFIED**, because the vendor plans page returned 403.
- **The strongest API in this group.** Public REST API v2 with read/write or read-only keys you create yourself; "Not all data will be available" yet ([help 13259288](https://help.workspace.vsco.co/en/articles/13259288-public-api)) [V]. Outbound "Web Request" automations ([help 13259282](https://help.workspace.vsco.co/en/articles/13259282-using-zapier-webhooks-with-vsco-workspace-web-request-automation)) [V-s].
- **Record Payment** captures amount, method, payer and memo, and can **split one payment across orders or gratuity** ([help 13259728](https://help.workspace.vsco.co/en/articles/13259728-payments-expenses)) [V-s]. Two-way SMS. Free migration from HoneyBook within about 48 business hours [V].
- **Borrow:** "who paid" on each payment record (useful when the planner pays the deposit and the couple pays the balance), plus gratuity tracking.
- **Complaints:** not researched (budget). UNVERIFIED.

### Studio Ninja
- **Price (USD).** Starter $16/month ($160/year), with 5 active jobs, **no automations and no booking forms**. Pro $27/month ($270/year). Master $40/month ($400/year) ([studioninja.co/pricing](https://www.studioninja.co/pricing/), read with curl) [V]. Questionnaires, portal, payment schedules and reminders are included on all tiers. **Zapier and API are not in the integrations list**, so I mark them UNVERIFIED.
- The balance can be due "a set number of days before the session date" ([help 429286](https://help.studioninja.co/en/articles/429286-invoice-payment-settings)) [V-s]. Record Payment covers cash, cheque and bank transfer ([help 697099](https://help.studioninja.co/en/articles/697099-how-do-i-record-a-payment-that-i-have-manually-received)) [V-s]. Built for photographers.
- **Borrow:** free one-on-one onboarding and data migration on every tier [V].
- **Complaints:** not researched (budget).

### Check Cherry (extra: real use by bands and DJs)
- **Price.** Standard $29/month ($348/year), Growth $59, Unlimited $139, with tiers set by bookings per year. Card fee 2.9% + 30¢ ([checkcherry.com/pricing](https://www.checkcherry.com/pricing)) [V]. The band page says "from $39" ([live-band-crm](https://www.checkcherry.com/live-band-crm)) [V], so the vendor's own pages disagree.
- **Built for musicians.** Clients book online and pay the deposit themselves. Packages (acoustic set, full band). **Questionnaires for must-play and do-not-play lists and the timeline.** Assigning band members to gigs. Zapier. Google, iCal and Outlook sync [V]. A "dynamic pricing engine" adds travel fees, peak-date surcharges and overtime automatically ([3P agiled](https://agiled.app/blog/best-tools-for-djs)).
- **Borrow:** pricing rules (travel, peak date, overtime) that turn a lead into a quote with no hand math.

### PerformerDesk (extra, only lightly checked)
- Says it is "the CRM built for entertainers": one inbox for inquiries, "Deposit and balance pay links that reconcile automatically", Google Calendar sync, timed follow-up sequences ([performerdesk.com/for/entertainers](https://performerdesk.com/for/entertainers)) [V]. **Price, user base and marketplace import are UNVERIFIED.** Not enough evidence of real use to rate it.

---

## Top 10 features to borrow

1. **AI-drafted first reply that you approve with one tap on your phone, never auto-sent** (HoneyBook drafts, the MCP and the ChatGPT app all end in "nothing is sent without that approval"). Unlike HoneyBook, train it on leads from **every** channel, not only your own web form.
2. **Payment rules based on relative dates, stored on the template** (Dubsado): "50% when the contract is signed; 50% zero days after the event start." Set it once and every booking inherits it. This encodes Alex's terms exactly.
3. **One "Record payment" button with a method dropdown** (Square, Venmo, Zelle, cash, check) **plus a "who paid" field** (VSCO). Off-platform payments are first-class records, not exceptions.
4. **Gratuity as its own field on a payment** (VSCO split, 17hats tipping). Day-of balances often include a tip.
5. **Fixed reminders around each due date:** 7 days before, on the day, 2 days after, each one on or off (HoneyBook). This is a short list of toggles, not a workflow builder.
6. **Deposit invoice created automatically when the proposal is accepted** (Bonsai). Do it without tying it to one payment processor.
7. **Participants on a booking with roles** (client, planner, venue) and a private side thread (HoneyBook participants and related workspaces).
8. **Questionnaires for each event type:** must-play, do-not-play, timeline, ceremony cues (Check Cherry). Send them automatically a set number of days before the event.
9. **Package plus pricing rules** (travel fee by distance, peak-date surcharge, overtime rate) so a quote prices itself (Check Cherry).
10. **A narrow trigger surface for agents:** New Inquiry, Booked, Stage Changed, Payment Recorded (HoneyBook and Dubsado Zapier triggers, VSCO "Payment Created"). This is also what an MCP layer needs, with approval for each resource as HoneyBook's MCP does.

## Top 5 traps (what made these tools too manual or too complicated)

1. **Core features locked behind a tier.** HoneyBook Starter ($36/month) has no automations or scheduler. Dubsado Starter has no workflows. 17hats needs Level 2 for payment schedules and Level 3 for the portal. Studio Ninja Starter allows 5 jobs and no automations. Users pay more and still do the work by hand.
2. **A general workflow builder in place of a few fixed, opinionated rules.** Dubsado takes 15–25 hours to set up; workflows are "confusing and scary"; HoneyBook automations are "a lot of work to set up" [U]. For 5–15 leads a week, ten hard-coded rules beat a builder.
3. **Off-platform payments handled as second-class.** HoneyBook's Mark as Paid is blocked on client-chosen and recurring plans. Bonsai deposits only work through Bonsai Payments, plus a 1% fee on other processors. Venmo and Zelle are never integrated, only typed in by hand. For a business paid by Square, Venmo and Zelle, this is the entire workflow.
4. **Leads outside the tool are invisible.** None of these import from GigSalad, The Bash, Thumbtack or Yelp (none found), and HoneyBook's AI lead scoring needs 20+ inquiries through **its own form**. Every marketplace lead becomes copy-paste.
5. **No reporting on the money question.** "Crazy you can't pull a report on outstanding balances" (HoneyBook, Trustpilot [U]). For deposits and day-of balances, the one screen that matters is "who owes what, by event date". Add to that feature creep ("adding tons and tons of shit I don't need") and price increases of 51–89% that bought nothing users wanted.

---

## Gaps and caveats

- Nothing verified for **COI or venue-document tracking** in any tool. This looks like a gap in the market, but that is only "not found".
- **HoneyBook "balance due on the event date"** as a relative rule is UNVERIFIED. The community example only shows "30 days out".
- **VSCO standalone pricing, 17hats price per level, Studio Ninja's Zapier or API, Bonsai's public API, and Check Cherry's off-platform payment logging and marketplace import are all UNVERIFIED.**
- I did not research complaints for VSCO, Studio Ninja or Check Cherry because of the budget.
- Many [V-s] facts are model-summarized search excerpts of vendor help pages. Re-fetch any of them before it drives a design decision.
