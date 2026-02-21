# System Architecture Handoff — Automated Lead Response

**Date:** 2026-02-20
**Version:** v9
**Status:** Chunk 6 complete. Chunk 7 (Gmail forward filter + e2e test) next.
**Previous plan invalidated:** `docs/plans/2026-02-20-feat-production-automation-loop-plan.md` (Mailgun email parsing — emails have no lead data)

---

## Vision

Fully automated lead response across 4 channels. The pipeline already works (classify → price → context → generate → verify). This system wraps it in delivery infrastructure that responds to leads within minutes — automatically when confidence is high, with Alex's approval when it's not.

**End state:** Lead arrives → pipeline runs → draft auto-sends (high confidence) or waits for Alex's YES (low confidence) → response delivered to client on platform.

---

## Platform Intelligence

### The Bash
- **Sender:** `info@thebash.com`
- **Subject format:** `Gig Alert: {TYPE} Lead! (Gig ID #{ID})`
- **Key feature:** Gig ID in subject line (clean dedup key)
- **Token link:** Time-limited "VIEW NOW" link to lead page
- **CC behavior:** Sends to both `alex.guillen.music@gmail.com` and `alex@alexguillenmusic.com`
- **Email lifecycle:** Initial notification → follow-up reminders
- **Response window:** Shows "40 hours left to respond" countdown
- **Lead page:** Full structured data behind authenticated login
- **Quote submission:** Requires Playwright to fill form on platform
- **Bot approach:** Follow token link from email within 2-3 min of arrival

### GigSalad
- **Sender:** `leads@gigsalad.com`
- **Subject format:** `New lead ({date} in {city}, {state})`
- **Key feature:** No Gig ID in subject (dedup harder)
- **Token link:** "View the details & reply" link in body
- **Dedup challenge:** 3+ emails per lead (initial + reminders like "Last reminder", "waiting to hear from you")
- **Dedup key:** Client name + event date extracted from email body
- **Lead page:** Full structured data behind authenticated login
- **Quote submission:** Requires Playwright to fill form on platform
- **Ranking:** "Top Performer" status based on responsiveness
- **Bot priority:** Second after The Bash (more complex dedup)

### GigSalad In-App Lead Format
```
Event info
[Client Name]
[Phone number or "Phone number not provided by client"]
[X members responded] [X members sent quotes] [X quotes are active]
[Day, Month DD, YYYY]
[Start time – End time (X hours)]
[City, State] OR [Full address]
Event type: [type]
Requested: [genre/format]
Planning stage: [researching/planning to book soon/ready to book]
Number of guests: [X guests]
Budget range: $X – $X (sometimes absent)
Details: [free text]
Group size preferred: [X person] (sometimes present)
Equipment needed: [text]
Age range of audience: [ranges]
Performance location: Indoor/Outdoor
Expenses covered: [text]
Performance area size: [dimensions] (sometimes present)
```

### GigSalad Email Notification (nearly useless for parsing)
```
Alex, you got a new lead!
[Client first name] would like a quote for a [Event Type] on [Month DD, YYYY].
View the details & reply
[Generic tips]
```

### Yelp
- **Status:** TBD — screenshots still pending
- **Reply mechanism:** `reply+{token}@messaging.yelp.com` — may allow Gmail API reply directly into Yelp conversation thread
- **Research needed:** Token expiry, reply routing confirmation

### Squarespace (alexguillenmusic.com)
- **Sender:** `form-submission@squarespace.info`
- **Two form variants:**
  - Simple: Name, Email, Subject, Message
  - Detailed: Name, Email, Phone, Services, Preferred Date, Budget, How did you hear about us, Message
- **Fields are customizable** — can add venue, guest count as structured fields
- **Response method:** Gmail API sends reply from `alex.guillen.music@gmail.com`
- **Key advantage:** Direct leads, highest conversion rate, zero bot risk

---

## Architecture Decisions

### Build Order (Phased)

| Phase | Channel | Risk Level | Mechanism |
|---|---|---|---|
| 1 | Squarespace direct leads | Zero | Form webhook or Gmail watch → pipeline → Gmail API reply |
| 1 | Yelp (if reply-by-email confirmed) | Zero | Gmail watch → pipeline → Gmail API reply to token address |
| 2 | The Bash | Medium | Gmail watch → Playwright follows token link → scrapes lead → pipeline → Playwright submits quote |
| 3 | GigSalad | Medium | Gmail watch → dedup → Playwright follows token link → scrapes lead → pipeline → Playwright submits quote |

**Decision:** Phase 1 ships first with zero risk. Bot research runs in parallel. Bot decision made after Agent 1 returns detection risk findings.

### Auto-Send Timer
- **Platform leads (GigSalad, The Bash):** 5 minutes
- **Direct leads (Squarespace, Yelp):** 30 minutes
- **Timer only applies to high-confidence drafts**

### Confidence Gate (Auto-Send Safety)

**High confidence → auto-send after timer:**
- All 9 gut checks pass on first attempt
- Event type unambiguous
- No cultural complexity flags
- No budget mismatch
- Venue classified cleanly

**Low confidence → hold for human review (no timer):**
- Verification gate required rewrite loop
- Cultural context active but signals ambiguous
- Budget mismatch detected
- Vague request with missing key fields
- Any gut check failing after 2 retry attempts

**Low confidence SMS:** "Draft ready but flagged for review — reply YES to send or EDIT to adjust."

**Audit plan:** Log every auto-sent response with confidence score. After 30 days, audit low-confidence holds vs auto-sends to validate threshold calibration.

### Deduplication Strategy
- **The Bash:** Gig ID from email subject (clean, unique)
- **GigSalad:** Client name + event date from email body (required before bot launch)
- **Squarespace:** Form submission dedup TBD (likely email address + timestamp)
- **Yelp:** TBD

### Gmail Configuration
- **Two addresses:** `alex.guillen.music@gmail.com` (primary) and `alex@alexguillenmusic.com` (CC on Bash)
- **Gmail watch** (Pub/Sub push notifications) triggers on specific senders:
  - `form-submission@squarespace.info` (direct leads)
  - `messaging.yelp.com` domain (Yelp leads + replies)
  - `info@thebash.com` (The Bash leads)
  - `leads@gigsalad.com` (GigSalad leads)
- **Gmail API scopes needed:** Send on behalf of user, read inbox

---

## Quality Bar

### Reference Responses
The pipeline output must match the quality of these benchmark responses before auto-send is permitted:
- **Stephanie** — Mission San Juan Capistrano fundraiser (cinematic scene, named fear, validated client, single confident price)
- **Debora** — Brazilian/Mexican wedding (cultural context, genre correction, gift-giver frame)

### Current Pipeline Performance
- 8/9 gut checks passing
- **The 1/9 failure mode must be identified before auto-send ships**
- Genre correction working (mariachi not flamenco for quinceañera)
- Stealth premium override working (venue signals override stated budget)
- Verification gate catches weak drafts and triggers rewrites

---

## Five Research Agents (Run in Parallel)

### Agent 1 — Bot Detection & Playwright Strategy
**Goal:** Determine detection risk level for The Bash and GigSalad
- Bot detection systems in use (Cloudflare, PerimeterX, DataDome, CAPTCHA)
- Playwright stealth configurations (stealth plugin, delays, proxies, fingerprinting)
- Session duration before re-login required
- Documented vendor account suspensions for automation
- Platform ToS on automated access (exact sections)

### Agent 2 — Token Link Behavior & Session Architecture
**Goal:** Ensure token link following works within 2-3 min window
- Token expiry windows for The Bash and GigSalad
- Expired token fallback behavior (redirect vs error)
- Credential storage for Railway (env vars vs encrypted secrets)
- "Remember this device" prompt handling
- Yelp reply token expiry
- Gmail watch latency and renewal (watches expire every 7 days)

### Agent 3 — Squarespace Webhook + Gmail API Architecture
**Goal:** Ship Phase 1 (direct leads + Yelp) fast
- Squarespace native webhook support (payload format, auth, reliability)
- Squarespace API for form submission retrieval
- Gmail API OAuth scopes for send-on-behalf
- Persistent refresh tokens on Railway
- Gmail API daily sending limits
- Automated send spam risk mitigations
- Gmail reply threading (reply to Squarespace notification as thread)
- Yelp email reply routing confirmation
- Gmail watch multi-sender filter approach

### Agent 4 — Pipeline Quality Gate & Confidence Scoring
**Goal:** Make auto-send safe for 80%+ of leads
- Structured confidence score (0-100) from existing verify stage
- Score threshold for auto-send vs hold
- Claude self-scoring prompt design (avoid inflation)
- Below-threshold behavior (hold vs opener + full draft vs flagged SMS)
- Two-message strategy analysis (opener + full draft timing)
- Failure mode analysis by lead type (minimal data, cultural complexity, budget mismatch, missing venue)

### Agent 5 — Competitive Response Timing & Platform Ranking
**Goal:** Confirm 5-minute timer target
- The Bash: 40-hour countdown ranking impact, response rate penalties, first responder advantage
- GigSalad: Top Performer criteria, response rate ranking impact, response time visibility to clients
- General: Response time vs conversion rate research, client selection criteria, speed threshold effects

---

## Still Pending (Action Items)

- [ ] Yelp screenshots (notification email + in-app lead format)
- [ ] GigSalad notification email body (confirm token link behavior)
- [ ] Squarespace form field additions (venue, guest count as structured fields)
- [ ] 2FA status on GigSalad and The Bash
- [ ] Identify the 1/9 gut check failure mode
- [ ] Sample real pipeline outputs for Stephanie and Debora benchmarks

---

## Existing Codebase Reference

- **Pipeline entry:** `src/server.ts:24` — POST `/api/analyze` takes `{ text: string }`
- **Pipeline stages:** `src/pipeline/classify.ts`, `price.ts`, `context.ts`, `generate.ts`, `verify.ts`
- **Types:** `src/types.ts` (Classification, PricingResult, Drafts, GateResult, PipelineOutput, LeadRecord, LeadStatus)
- **Claude helper:** `src/claude.ts` (callClaude<T>, callClaudeText)
- **Lead store:** `src/leads.ts` (SQLite CRUD, Phase 1 complete)
- **SMS sender:** `src/twilio.ts` (outbound only, Phase 2 complete)
- **Business docs:** 12 `.md` files in `docs/` (rate cards, protocols, cultural frameworks, venue intel)

---

## What's Already Built (From Previous Plan)

| Component | Status | File |
|---|---|---|
| SQLite lead store + CRUD | Done | `src/leads.ts` |
| LeadRecord + LeadStatus types | Done | `src/types.ts` |
| Twilio outbound SMS | Done | `src/twilio.ts` |
| Twilio reply webhook + YES/edit | Done | `src/twilio-webhook.ts` |
| Dashboard with Basic Auth | Done | `src/dashboard.ts` |
| Railway deployment config | Done | `railway.json`, `docs/deployment.md` |
| Healthcheck endpoint | Done | `src/server.ts` GET `/health` |
| Twilio validation escape hatch | Done | `src/twilio-webhook.ts` `DISABLE_TWILIO_VALIDATION` |
| Mailgun webhook | **Invalidated** | Not built |
| runPipeline extraction | Done | `src/run-pipeline.ts` |
| Gmail forward filter + e2e test | **Not started** | Chunk 7 |

**Keep from previous work:** SQLite store, Twilio SMS, lead types. These are channel-agnostic and work for the new architecture.
**Invalidated:** Mailgun webhook (emails have no lead data). Do not revisit.

---

## Chunk History

| Chunk | Description | Status |
|---|---|---|
| 1 | SQLite lead store + CRUD | Done |
| 2 | Twilio outbound SMS | Done |
| 3 | runPipeline extraction | Done |
| 4 | Twilio reply webhook + YES/edit handler | Done |
| 5 | Dashboard with Basic Auth | Done |
| 6 | Railway deployment config | Done |
| 7 | Gmail forward filter + e2e test | **Next** |

---

## How to Start Next Session

### Chunk 7 — Gmail forward filter + e2e test
```
Read docs/SYSTEM_ARCHITECTURE_HANDOFF.md and docs/deployment.md.
Implement Chunk 7: Gmail forward filter setup verification + end-to-end test
from email arrival → pipeline → SMS notification → YES reply → done.
```

### For Planning (after research completes):
```
Read docs/SYSTEM_ARCHITECTURE_HANDOFF.md. Run /workflows:plan for Phase 1:
Squarespace form webhook → pipeline → Gmail API auto-reply.
```

### For Research (run 5 agents in parallel):
```
Read docs/SYSTEM_ARCHITECTURE_HANDOFF.md section "Five Research Agents."
Launch all 5 research agents in parallel. Write results to docs/research/.
```
