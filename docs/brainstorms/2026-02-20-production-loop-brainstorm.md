# Production Loop Brainstorm

**Date:** 2026-02-20
**Status:** Brainstorm complete — ready for planning
**Scope:** Take the existing CLI + web UI pipeline to a fully automated production loop

---

## What We're Building

An automated lead ingestion and response system that:

1. **Receives** gig lead emails from GigSalad/The Bash via Gmail → Mailgun forwarding
2. **Processes** them through the existing 5-stage AI pipeline (unchanged)
3. **Delivers** compressed draft to Alex's phone via Twilio SMS
4. **Accepts** approval ("YES") or edit instructions via SMS reply
5. **Returns** the full formatted draft for Alex to copy-paste into the platform

The final copy-paste step is unavoidable — neither GigSalad nor The Bash has a public API for sending responses.

---

## Why This Approach

- **Speed wins gigs.** The current manual flow (check email → open app → paste lead → wait → copy response) takes 5-10 minutes. The automated loop delivers a ready draft to Alex's phone in under 60 seconds.
- **Pipeline is proven.** The 5-stage classify → price → context → generate → verify pipeline already works. We're wrapping it in delivery infrastructure, not rewriting it.
- **Low cost.** Mailgun free tier + Twilio (~$1/month) + Railway (~$5/month) = ~$6-7/month total.

---

## Key Decisions

### 1. SMS Length: Accept Multipart Splitting
Compressed drafts at 80-100 words will be ~500-600 chars (4-5 SMS segments). Twilio handles multipart transparently — Alex sees one continuous message. Cost is ~$0.04-0.05 per lead instead of $0.01. No code complexity, no truncation trade-offs.

### 2. Multiple Simultaneous Leads: Lead ID in Reply Instructions
SMS will include a short lead ID: "Reply YES-abc123 to approve." System parses the ID from the reply. If Alex forgets the ID and just replies "YES", fall back to the most recent pending lead. No queuing delays, no extra Twilio numbers.

### 3. Edit Loop: 3 Rounds Max
After 3 revision replies, system sends "[MAX REVISIONS] Check dashboard for full history." Prevents infinite loops while giving enough room for real tweaks. The gate already retries 2x internally before the draft ever reaches Alex.

### 4. Dashboard Auth: Basic Auth via .env
`DASHBOARD_USER` and `DASHBOARD_PASS` in `.env`. Express middleware checks credentials on `/leads` routes. Simple, standard, sufficient for a single-user internal tool. Lead data includes client names and pricing — needs protection.

### 5. Deployment: Railway
Beginner-friendly, persistent disk for SQLite, easy GitHub deploys, good env var management. ~$5/month on the paid tier. Render's free tier sleeps (bad for webhooks); Fly.io is overkill.

### 6. Email Parse Monitoring: Dashboard Flag
When regex extraction fails and the system falls back to raw text, mark the lead as `parse_fallback` in the store. Dashboard shows a yellow warning. This is how you'll know if GigSalad/The Bash changes their email template — no extra SMS noise.

### 7. Webhook Security: Validate Both
Twilio inbound: `twilio.webhook()` Express middleware (validates `X-Twilio-Signature`). Mailgun inbound: HMAC signature validation using `MAILGUN_SIGNING_KEY`. Both are one-line integrations. Non-negotiable for production.

### 8. SQLite WAL Mode: Enabled from Day One
`db.pragma('journal_mode = WAL')` on database init. Allows concurrent reads during pipeline writes. Prevents "database is locked" errors. Standard best practice, no downside.

### 9. Pipeline Queue: Not Needed
At 5-10 leads/day, you're well under Anthropic's Tier 1 limit (50 RPM). Even 3 simultaneous leads (12-15 API calls) is safe. Add a queue later if volume grows significantly. YAGNI.

### 10. Mailgun Retry Window: Sufficient
Mailgun retries failed webhooks 7 times over ~8 hours. Railway deploys take seconds. No leads will be lost during deploys. No extra polling or safety net needed.

---

## Production Gotchas (From Research)

- **Railway filesystem is ephemeral.** SQLite file MUST live on a Railway Volume (persistent disk), not the default filesystem. Data will be lost on every redeploy without a volume.
- **Twilio URL matching is exact.** The webhook URL configured in Twilio must match exactly (scheme, port, path) or signature validation fails. Use the Railway production URL, not localhost.
- **Mailgun webhooks are not replayable.** If all 7 retries fail (8+ hour outage), those webhook events are permanently lost. The emails still exist in Mailgun but the notifications are gone.
- **WAL mode + Railway Volumes = compatible.** Railway Volumes use NVMe SSDs (not network filesystems), so WAL works correctly. Single writer at a time is fine for this workload.

---

## New Components (Additive Only)

| Component | File | Purpose |
|---|---|---|
| Mailgun webhook | `src/inbound/mailgun.ts` | Parse forwarded lead emails, extract fields, trigger pipeline |
| Twilio SMS handler | `src/sms/twilio.ts` | Send drafts, receive YES/edit replies |
| Lead store | `src/store/leads.ts` | SQLite persistence for lead state across SMS loop |
| Server routes | `src/server.ts` | Add webhook + dashboard endpoints to existing Express app |
| Setup docs | `docs/setup/*.md` | Gmail filter, Mailgun, Twilio setup instructions |

**Nothing existing changes.** Pipeline, prompts, rate cards, web UI — all untouched.

---

## Services

| Service | Purpose | Cost |
|---|---|---|
| Mailgun | Inbound email parsing | Free (100 emails/day) |
| Twilio | SMS send + receive | ~$1/month + $0.01/SMS |
| Railway | Always-on Node.js hosting | ~$5/month |
| Gmail | Auto-forward filter | Free |

---

## Error Handling Strategy

| Scenario | Response |
|---|---|
| Non-lead email forwarded | Parser returns null, log as `ignored`, no SMS |
| Pipeline API error | SMS: "Pipeline error on [lead summary] — check dashboard" |
| Gate fails after 2 retries | SMS with `[REVIEW NEEDED]` prefix |
| No reply within 24hrs | Lead auto-expires to `expired` status |
| Reply to old/wrong SMS | Look up by lead ID; fall back to most recent pending |
| 3+ edit rounds | SMS: "[MAX REVISIONS] Check dashboard" |
| Twilio delivery failure | Log error, no fallback (Alex checks dashboard) |

---

## Build Phases

1. SQLite store + LeadRecord model
2. Twilio SMS sender (outbound only, hardcoded test lead)
3. Mailgun webhook + email parser
4. Wire Mailgun → pipeline → Twilio (end-to-end)
5. Twilio reply webhook + YES/edit handler
6. Internal leads dashboard (`GET /leads`)
7. Railway deployment + env config
8. Gmail forward filter setup + end-to-end test

---

## Open Questions (None — All Resolved)

All 5 original open questions were resolved during brainstorming. See Key Decisions above.

---

## Next Step

Run `/workflows:plan` to produce an implementation plan from this brainstorm.
