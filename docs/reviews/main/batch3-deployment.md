# Deployment Verification Agent -- Review Findings

**Agent:** deployment-verification-agent
**Branch:** main
**Date:** 2026-02-20
**Files reviewed:** 5 (.claude/skills/review-batched/SKILL.md, .env.example, docs/HANDOFF.md, docs/deployment.md, src/webhook.ts) + 6 supporting files (src/twilio-webhook.ts, src/server.ts, src/leads.ts, src/sms.ts, src/post-pipeline.ts, railway.json)

---

## Findings

### [P1] DISABLE_MAILGUN_VALIDATION bypasses security with no automatic re-enable
**File:** `src/webhook.ts:63`
**Issue:** When `DISABLE_MAILGUN_VALIDATION=true`, any HTTP client can POST to `/webhook/mailgun` with fabricated email data and it will be accepted, parsed, and fed into the pipeline. This creates a lead record, runs an Anthropic API call (costing money), and sends an SMS to Alex's phone. There is no timer, request counter, or automatic mechanism to re-enable validation. If the engineer sets it to `true` for debugging and forgets to set it back, the webhook remains open indefinitely. The same pattern exists in `src/twilio-webhook.ts:36` for `DISABLE_TWILIO_VALIDATION`.
**Suggestion:** Add a startup log warning in `src/server.ts` that fires on every boot when either escape hatch is `true`. Something like: `console.warn("WARNING: MAILGUN validation disabled. Set DISABLE_MAILGUN_VALIDATION=false after debugging.")`. This does not fix the root issue (the flag is still manual) but makes the open state visible in every deploy log. Long-term, consider a time-limited bypass (e.g., bypass for 15 minutes after deploy, then auto-reject).

---

### [P2] No stuck-lead recovery implemented
**File:** `src/webhook.ts:124` / `src/leads.ts` (entire file)
**Issue:** The HANDOFF.md (line 211) documents a design decision: "Stuck recovery: `received` > 5 min -> `failed` via `setInterval`." This is listed as a decided behavior, but there is no `setInterval` or any background task in `src/server.ts`, `src/leads.ts`, or anywhere else that transitions `received` leads to `failed`. If the pipeline hangs, crashes, or the process restarts mid-pipeline, leads remain in `received` status permanently with no alert sent. The fire-and-forget pattern in `webhook.ts:124` means the HTTP response already returned 200, so there is no retry from Mailgun either.
**Suggestion:** Before first production deploy, either (a) implement the `setInterval` described in the plan, or (b) document that stuck lead detection is deferred and add a manual recovery procedure to the e2e test checklist (e.g., "check for `received` leads older than 5 minutes on the dashboard daily").

---

### [P2] No rate-limit or abuse protection on webhook endpoints
**File:** `src/webhook.ts:49` / `src/twilio-webhook.ts:170`
**Issue:** Both webhook endpoints accept unlimited requests. When validation is enabled, only signed requests are processed, which provides some protection. However, an attacker replaying a valid signed Mailgun payload (timestamp + token + signature) could trigger duplicate pipeline runs and SMS sends. The dedup check (`isEmailProcessed`) uses `external_id` from the parsed email, not the Mailgun signature token, so the exact same POST body would be deduped. But crafted payloads with different `external_id` values but valid signatures (if the attacker obtains a valid signing key) would not be stopped. This is low-probability but worth noting for a production system that spends API credits and sends SMS on each request.
**Suggestion:** Add basic rate limiting (e.g., `express-rate-limit` with 10 req/min on `/webhook/mailgun` and 20 req/min on `/webhook/twilio`). This is a P2 rather than P1 because the HMAC validation is the primary gate, and this is a single-user system.

---

### [P2] Pipeline errors during fire-and-forget do not propagate to the HTTP caller
**File:** `src/webhook.ts:124-133`
**Issue:** The webhook returns `200 { status: "accepted" }` immediately, then runs the pipeline asynchronously. If `runPipeline()` throws, `postPipelineError()` handles it (marks lead as `failed`, sends alert SMS). But if `postPipelineError()` also throws (double fault -- e.g., Twilio is down AND the DB write fails), the error is only logged to console. There is no retry queue, no dead-letter mechanism, and no way to discover these double-fault leads except by reading Railway logs. The lead would remain in `received` status forever (ties into the stuck-lead finding above).
**Suggestion:** This is acceptable for first deploy given the single-user nature, but document the double-fault scenario in the runbook. The stuck-lead recovery (when implemented) would catch these cases.

---

### [P3] Mailgun webhook route-level middleware is a no-op
**File:** `src/webhook.ts:11-18`
**Issue:** The middleware at lines 11-18 checks `req.is("application/x-www-form-urlencoded")` but does nothing with the result -- it calls `next()` in both the true and (implicit) false branches. This appears to be a leftover from when route-specific body parsing was planned. The actual URL-encoded parsing happens at the app level in `src/server.ts:20` (`app.use(express.urlencoded(...))`), so this middleware is dead code.
**Suggestion:** Remove lines 11-18 to reduce confusion. It has no functional impact.

---

### [P3] .env.example documents DISABLE flags as "false" but Railway variables default to empty
**File:** `.env.example:36,44`
**Issue:** The `.env.example` shows `DISABLE_TWILIO_VALIDATION=false` and `DISABLE_MAILGUN_VALIDATION=false`. However, the code checks `=== "true"` (strict string equality). If the Railway variable is not set at all, `process.env.DISABLE_MAILGUN_VALIDATION` is `undefined`, which does not equal `"true"`, so validation is correctly enabled by default. The `.env.example` suggests setting them to `false` explicitly, but this is unnecessary and could confuse engineers who think they need to set the variable. No functional impact.
**Suggestion:** Optionally add a comment in `.env.example`: "These variables do not need to be set in production. Only set to 'true' temporarily for debugging."

---

## Deployment Checklist: gig-lead-responder to Railway

This is the first production deployment. The system accepts inbound emails via Mailgun, runs an AI pipeline (Anthropic Claude), stores results in SQLite, and communicates via Twilio SMS.

---

### Pre-Deploy (Required)

All items must be completed before deploying.

#### Environment Variables

Verify each variable is set in Railway's Variables tab. Missing any required variable will cause silent failures (not crashes, except `ANTHROPIC_API_KEY`).

| Variable | Required | Validation | Failure Mode |
|----------|----------|------------|--------------|
| `ANTHROPIC_API_KEY` | Yes | Starts with `sk-ant-` | Server exits on startup (hard fail) |
| `TWILIO_ACCOUNT_SID` | Yes | Starts with `AC` | SMS send throws -- lead stuck in `received` |
| `TWILIO_AUTH_TOKEN` | Yes | Non-empty | SMS send throws + Twilio sig validation fails |
| `TWILIO_FROM_NUMBER` | Yes | Format: `+1XXXXXXXXXX` | SMS send throws |
| `ALEX_PHONE` | Yes | Format: `+1XXXXXXXXXX` | All inbound SMS rejected silently |
| `MAILGUN_WEBHOOK_KEY` | Yes | Non-empty (hex string) | All webhooks return 401 |
| `DATABASE_PATH` | Yes | Must be `/data/leads.db` | Data lost on every redeploy |
| `BASE_URL` | Yes | `https://...` no trailing slash | Twilio sig validation fails |
| `DASHBOARD_USER` | Yes (prod) | Non-empty | Dashboard has no auth |
| `DASHBOARD_PASS` | Yes (prod) | Strong password | Dashboard has no auth |
| `DISABLE_TWILIO_VALIDATION` | No | Omit or `false` | If `true`, Twilio webhook is open |
| `DISABLE_MAILGUN_VALIDATION` | No | Omit or `false` | If `true`, Mailgun webhook is open |
| `PORT` | No | Do NOT set | Railway injects automatically |

#### Infrastructure

- [ ] Railway project created and connected to GitHub repo
- [ ] Volume mounted at `/data` (Settings > Volume > Mount Path = `/data`)
- [ ] Verify volume exists: after first deploy, check Railway logs for `Gig Lead Responder running at http://localhost:PORT` (no SQLite errors)
- [ ] `DATABASE_PATH` set to `/data/leads.db` (matches volume mount)

#### Dependencies / Build

- [ ] `tsx` is in `dependencies` (not `devDependencies`) -- verified in current `package.json`
- [ ] `better-sqlite3` native build succeeds on Railway (nixpacks) -- verify in build logs
- [ ] No `npm run build` step needed (`npx tsx` runs TypeScript directly)

#### External Service Configuration

- [ ] Mailgun inbound route created, pointing to `https://<app>.up.railway.app/webhook/mailgun`
- [ ] Mailgun webhook signing key (NOT API key, NOT domain key) copied to `MAILGUN_WEBHOOK_KEY`
- [ ] Twilio phone number webhook set to `https://<app>.up.railway.app/webhook/twilio` (HTTP POST)
- [ ] `BASE_URL` matches Railway public URL exactly (copy from Railway dashboard, no trailing slash)

---

### Deploy Steps

1. [ ] Push to `main` branch (Railway auto-deploys from GitHub)
2. [ ] Watch Railway build logs -- confirm `better-sqlite3` compiles, no npm errors
3. [ ] Watch Railway deploy logs -- confirm `Gig Lead Responder running at http://localhost:PORT`
4. [ ] Confirm healthcheck passes: Railway shows green status (healthcheck hits `/health`)

---

### Post-Deploy Verification (Within 5 Minutes)

These are smoke tests. Run them in order -- each builds on the previous.

#### Test 0: Health and Dashboard

- [ ] `curl https://<app>.up.railway.app/health` returns `{"status":"ok"}`
- [ ] `https://<app>.up.railway.app/leads` prompts for Basic Auth
- [ ] After login, shows empty leads table

#### Test 1: Mailgun Webhook (Direct)

- [ ] Send test email to Mailgun inbound address with The Bash format
- [ ] Railway logs show webhook received within 30 seconds
- [ ] Railway logs show pipeline started (classify, price, context, generate, verify stages)
- [ ] SMS received on Alex's phone with compressed draft
- [ ] Dashboard shows lead with status `sent`

#### Test 2: Twilio Inbound (SMS Reply)

- [ ] Reply `YES` to the SMS from Test 1
- [ ] Confirmation SMS received within 10 seconds
- [ ] Dashboard shows lead with status `done`, `done_reason: approved`

#### Test 3: Dedup Check

- [ ] Re-send the same test email from Test 1
- [ ] Railway logs show "already processed" skip
- [ ] Dashboard still shows only one lead

---

### Database Verification Queries

Run these via Railway's shell or by connecting to the SQLite database file.

```sql
-- Pre-deploy baseline (should be empty on first deploy)
SELECT COUNT(*) as total_leads FROM leads;
SELECT status, COUNT(*) as count FROM leads GROUP BY status;

-- Post-deploy after Test 1
SELECT id, status, source_platform, event_type, confidence_score,
       gate_passed, edit_round, created_at
FROM leads ORDER BY id DESC LIMIT 5;
-- Expected: 1 row, status='sent', gate_passed=1, edit_round=0

-- Post-deploy after Test 2 (YES reply)
SELECT id, status, done_reason FROM leads WHERE id = 1;
-- Expected: status='done', done_reason='approved'

-- Check for stuck leads (run anytime)
SELECT id, status, created_at,
       (julianday('now') - julianday(created_at)) * 24 * 60 as minutes_old
FROM leads
WHERE status = 'received'
  AND (julianday('now') - julianday(created_at)) * 24 * 60 > 5;
-- Expected: 0 rows (any rows here are stuck leads needing manual intervention)

-- Check dedup table
SELECT * FROM processed_emails ORDER BY received_at DESC LIMIT 10;

-- Check for data integrity issues
SELECT id FROM leads WHERE raw_email IS NULL;
-- Expected: 0 rows (raw_email is NOT NULL constraint)

SELECT id FROM leads WHERE status = 'sent' AND compressed_draft IS NULL;
-- Expected: 0 rows (sent leads should always have a draft)
```

---

### Rollback Plan

**Can we roll back?**

- [x] Yes -- this is a first deploy. Rolling back means removing the Railway service.
- [x] No database migration rollback needed -- SQLite tables are created fresh on first run.
- [x] No data to preserve -- first deploy has no production data.

**If the deploy itself fails (build error, crash loop):**

1. Check Railway build/deploy logs for the specific error
2. Fix the code, push to `main`, Railway auto-redeploys
3. If stuck, use `railway down` or delete the service and recreate

**If the deploy succeeds but webhooks fail (401 errors):**

1. Set `DISABLE_MAILGUN_VALIDATION=true` and/or `DISABLE_TWILIO_VALIDATION=true`
2. Confirm webhooks work with validation disabled (check logs)
3. Fix the root cause:
   - Mailgun 401: Wrong signing key. Go to Mailgun > Settings > Webhooks, copy the correct key
   - Twilio 401: `BASE_URL` mismatch. Copy exact URL from Railway dashboard
4. Update the correct env var in Railway
5. Set `DISABLE_*_VALIDATION=false` immediately
6. Re-test

**If the pipeline produces bad output (wrong drafts, wrong pricing):**

1. This is a content quality issue, not a deployment issue
2. Check the lead on the dashboard (`/leads/{id}`) for `classification_json` and `pricing_json`
3. The lead can be manually marked as `failed` in the DB
4. Pipeline logic changes require a code fix + redeploy

**If SMS is not received:**

1. Check Railway logs for Twilio errors
2. Verify `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, `ALEX_PHONE` are correct
3. Check Twilio console for message delivery status
4. Twilio trial accounts can only send to verified numbers -- verify `ALEX_PHONE` is verified in Twilio

---

### Post-Deploy Monitoring (First 24 Hours)

This is a single-user system with no dashboards or automated alerting beyond SMS. Monitoring is manual.

| What to Check | How | Alert Condition | Frequency |
|---------------|-----|-----------------|-----------|
| Server alive | `curl /health` or Railway dashboard | Non-200 response | After deploy, then hourly for first 4 hours |
| Leads table | Dashboard at `/leads` | Any lead stuck in `received` > 5 min | After each test, then every few hours |
| Railway logs | Railway dashboard > Deployments > Logs | Any `Error:` or stack trace lines | After each test |
| SMS delivery | Phone | No SMS within 2 min of webhook log entry | After each test |
| Escape hatches | Railway Variables tab | Either `DISABLE_*` still set to `true` | Once after debugging complete |
| API costs | Anthropic dashboard | Unexpected spike (each lead = ~1 API call) | Daily |
| Twilio costs | Twilio console | Unexpected SMS volume | Daily |
| Disk usage | Railway Volume metrics | Approaching volume limit | Weekly |

#### Manual Console Checks (Run at +1h, +4h, +24h)

Connect to Railway shell or inspect the SQLite DB:

```sql
-- Are there any stuck leads?
SELECT COUNT(*) FROM leads WHERE status = 'received'
  AND (julianday('now') - julianday(created_at)) * 24 * 60 > 5;

-- Are there any failed leads needing attention?
SELECT id, error_message, created_at FROM leads WHERE status = 'failed' ORDER BY created_at DESC;

-- Overall status distribution
SELECT status, COUNT(*) FROM leads GROUP BY status;

-- Are escape hatches still on? (check env vars in Railway dashboard)
-- DISABLE_TWILIO_VALIDATION should be false or unset
-- DISABLE_MAILGUN_VALIDATION should be false or unset
```

---

### Go/No-Go Decision Matrix

| Condition | Decision |
|-----------|----------|
| All required env vars set and validated | GO |
| Volume mounted at `/data` and `DATABASE_PATH=/data/leads.db` | GO |
| Healthcheck returns 200 | GO |
| Mailgun inbound route active and signing key correct | GO |
| Twilio webhook URL set and `BASE_URL` matches | GO |
| `better-sqlite3` builds successfully on Railway | GO |
| Any required env var missing | NO-GO |
| Volume not mounted (data loss on redeploy) | NO-GO |
| `DISABLE_*_VALIDATION` left as `true` in production | NO-GO (fix first) |
| Build fails on `better-sqlite3` native compile | NO-GO (check Node version) |
| `tsx` not in `dependencies` | NO-GO (fix package.json) |
