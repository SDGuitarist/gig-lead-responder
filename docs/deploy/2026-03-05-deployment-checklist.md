# Deployment Checklist: Cycle 12 Fixes + leads.ts Split + Cycle 13 Security Fixes

**Date:** 2026-03-05
**Branch:** `main` (commit `44ca4b3`)
**Deploying to:** Railway (Node.js/TypeScript + SQLite)
**Estimated risk:** MEDIUM -- structural refactor (module split) + security fixes + schema migration

## Changes Summary

This deployment covers three batches of work merged into main:

1. **Cycle 12 P1/P2 fixes** (8 commits): CSP nonce regex, POST-only logout, replay protection, LLM validator guards, dynamic SQL fix, dead code cleanup
2. **leads.ts structural split** (2 commits): 751-line God Module split into `src/db/migrate.ts`, `src/db/leads.ts`, `src/db/follow-ups.ts`, `src/db/queries.ts`, `src/db/index.ts` barrel
3. **Cycle 13 security fixes** (7 commits): ReDoS regex fix, prompt injection wrap, unsafe `as string` casts replaced, empty Message-Id fix, 200K input limits, urlencoded body limit, token URL validation, DEV_WEBHOOK_KEY guard

---

## Findings

### [P1] Table rebuild migration runs on deploy with existing DB

**File:** `src/db/migrate.ts:88-148`
**Issue:** The `initDb()` function includes a table rebuild migration that adds `'replied'` to the `follow_up_status` CHECK constraint. This runs automatically on app startup. If the production DB already has `'replied'` in its schema (from a prior deploy), it safely skips. But if deploying against a DB that predates this migration, it will: (1) create `leads_new`, (2) copy all data, (3) DROP `leads`, (4) rename `leads_new` to `leads`. This is destructive and runs inside a transaction, but a crash mid-migration could leave the DB in an inconsistent state. With SQLite on Railway's ephemeral filesystem, a volume must be attached.
**Suggestion:** Verify the production DB already has `'replied'` in its schema BEFORE deploying. If not, back up the DB file first. Confirm Railway volume is mounted at the `DATABASE_PATH` location.

### [P1] Import path change from `../leads.js` to `../db/index.js` across 8 consumers

**File:** `src/api.ts:2`, `src/webhook.ts:4`, `src/twilio-webhook.ts:4`, `src/follow-up-api.ts:3`, `src/follow-up-scheduler.ts:1`, `src/post-pipeline.ts:1`, `src/run-pipeline.ts:9`, `src/server.ts:7`
**Issue:** The structural split changed every import path. If any consumer was missed or the barrel file (`src/db/index.ts`) doesn't re-export a needed symbol, the app will crash on startup. TypeScript compilation (`tsc --noEmit`) passes clean locally, which is a strong signal, but the Railway build environment may differ (node version, dependency resolution).
**Suggestion:** Verify `tsc --noEmit` passes in CI/staging before production deploy. The old `src/leads.ts` file is deleted -- there is no fallback if a symbol is missing.

### [P2] No automated tests exist

**File:** General
**Issue:** `npm test` runs `node --import tsx --test src/*.test.ts` but no test files were found in the glob. The structural split and security fixes have zero automated test coverage. All verification is manual (`tsc --noEmit` + grep checks).
**Suggestion:** Accept this risk for now but add smoke tests before the next deploy cycle. Manual verification steps below compensate.

### [P2] DEV_WEBHOOK_KEY is a new env var requirement for dev mode

**File:** `src/webhook.ts:56-59`
**Issue:** When `DISABLE_MAILGUN_VALIDATION=true`, the webhook now requires `DEV_WEBHOOK_KEY` in the environment and a matching `dev_key` field in the request body. This is dev-only (blocked in production), but developers testing locally will get 401 errors if they don't set this variable.
**Suggestion:** Document in README. No production impact -- the startup guard at `src/server.ts:21` kills the process if `DISABLE_MAILGUN_VALIDATION` is set in production.

### [P3] `stmt()` cache duplicated across 3 modules

**File:** `src/db/leads.ts:10-24`, `src/db/follow-ups.ts:9-24`, `src/db/queries.ts:9-24`
**Issue:** Each DB module has its own `stmt()` with a `cachedDb` guard. This is intentional (per HANDOFF.md), but if `initDb()` ever returns a different DB instance mid-process, all three caches clear independently. No immediate risk, just a maintenance note.
**Suggestion:** No action needed. The db-reference guard handles this correctly.

---

## Pre-Deploy Checklist (Required)

### Environment Variables Audit

Verify ALL required env vars are set in Railway dashboard. No new env vars are required for production by this deploy, but confirm existing ones:

| Variable | Required | Purpose | New? |
|----------|----------|---------|------|
| `ANTHROPIC_API_KEY` | YES | LLM calls | No |
| `DASHBOARD_USER` | YES (prod) | Dashboard auth | No |
| `DASHBOARD_PASS` | YES (prod) | Dashboard auth | No |
| `COOKIE_SECRET` | YES (prod) | Session signing | No |
| `MAILGUN_WEBHOOK_KEY` | YES | Webhook HMAC validation | No |
| `TWILIO_ACCOUNT_SID` | YES | SMS sending | No |
| `TWILIO_AUTH_TOKEN` | YES | SMS + webhook validation | No |
| `TWILIO_FROM_NUMBER` | YES | SMS sender number | No |
| `ALEX_PHONE` | YES | SMS recipient number | No |
| `BASE_URL` | YES | Follow-up dashboard links | No |
| `PORT` | No (default 3000) | Railway sets this | No |
| `DATABASE_PATH` | No (default `./data/leads.db`) | SQLite file location | No |
| `PF_INTEL_API_URL` | Optional | Venue lookup integration | No |
| `PF_INTEL_SERVER_API_KEY` | Optional | Venue lookup auth | No |
| `DEV_WEBHOOK_KEY` | Dev only | Required when `DISABLE_MAILGUN_VALIDATION=true` | YES |

**Env vars that MUST NOT be set in production:**
- `DISABLE_TWILIO_VALIDATION` -- server.ts startup guard exits if set
- `DISABLE_MAILGUN_VALIDATION` -- server.ts startup guard exits if set

### Pre-Deploy Verification Steps

- [ ] `npx tsc --noEmit` passes with zero errors (run locally)
- [ ] Confirm `src/leads.ts` does NOT exist (deleted in refactor)
- [ ] Confirm `src/db/index.ts` exports all 27 symbols (barrel file)
- [ ] Verify Railway volume is mounted for SQLite persistence
- [ ] Verify Railway env vars are set (see table above)
- [ ] Check current production DB: does the `leads` table schema already include `'replied'` in follow_up_status CHECK? (If yes, migration will skip. If no, migration will run -- back up DB first.)
- [ ] Review Railway deploy logs from last successful deploy for comparison baseline
- [ ] Confirm no `DISABLE_*` env vars are set in production

### Database Baseline (save these values)

Connect to the production SQLite DB before deploying and record:

```sql
-- Total lead count (baseline)
SELECT COUNT(*) AS total_leads FROM leads;

-- Status distribution
SELECT status, COUNT(*) FROM leads GROUP BY status;

-- Follow-up status distribution
SELECT follow_up_status, COUNT(*) FROM leads
WHERE follow_up_status IS NOT NULL GROUP BY follow_up_status;

-- Outcome distribution
SELECT outcome, COUNT(*) FROM leads
WHERE outcome IS NOT NULL GROUP BY outcome;

-- Check current schema for 'replied' in CHECK constraint
SELECT sql FROM sqlite_master WHERE type='table' AND name='leads';
-- Look for: follow_up_status TEXT CHECK(follow_up_status IN (...'replied'...))

-- Count of records in processed_emails (idempotency table)
SELECT COUNT(*) FROM processed_emails;

-- Count of venue_misses
SELECT COUNT(*) FROM venue_misses;
```

**Record all values. Any post-deploy deviation = STOP and investigate.**

---

## Deploy Steps (in order)

Railway auto-deploys on push to main. The deploy process is:

1. [ ] **Verify main is clean:** `git status` shows no uncommitted changes
2. [ ] **Push to origin/main** (if not already pushed): `git push origin main`
3. [ ] **Monitor Railway build logs** -- watch for:
   - Nixpacks build completing successfully
   - `npx tsx src/server.ts` startup command executing
   - `initDb()` migration log messages (if table rebuild runs, you'll see: "Migration: rebuilding leads table to add 'replied' to follow_up_status CHECK...")
   - "Gig Lead Responder running at http://localhost:PORT"
   - "[scheduler] started -- checking every 15 minutes"
4. [ ] **Health check passes:** Railway healthcheck hits `/health` endpoint (300s timeout configured in `railway.json`)

**Expected startup behavior:**
- If DB already has `'replied'`: no migration log, clean startup
- If DB needs migration: "Migration: rebuilding leads table..." then "Migration complete: follow_up_status CHECK now includes 'replied'."
- Startup guards kill the process if: `ANTHROPIC_API_KEY` missing, `DISABLE_*` vars set in prod, `DASHBOARD_USER`/`DASHBOARD_PASS` missing in prod

**If build fails:** Railway keeps the previous deployment running. No data risk.

---

## Post-Deploy Verification (within 5 minutes)

### Health Check

```bash
# Basic health
curl -s https://YOUR_RAILWAY_URL/health
# Expected: {"status":"ok"}
```

### Dashboard Auth Check

```bash
# Should return 401 with WWW-Authenticate header (not 500)
curl -s -o /dev/null -w "%{http_code}" https://YOUR_RAILWAY_URL/dashboard.html
# Expected: 401

# With valid credentials
curl -s -u "$DASHBOARD_USER:$DASHBOARD_PASS" https://YOUR_RAILWAY_URL/api/stats
# Expected: JSON with {pending, sent, avg_score, this_month}
```

### API Smoke Tests

```bash
# List leads (requires auth)
curl -s -u "$DASHBOARD_USER:$DASHBOARD_PASS" https://YOUR_RAILWAY_URL/api/leads | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Leads returned: {len(d)}')"

# Analytics endpoint
curl -s -u "$DASHBOARD_USER:$DASHBOARD_PASS" https://YOUR_RAILWAY_URL/api/analytics | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Total leads: {d[\"total_leads\"]}, Booked: {d[\"booked\"]}')"

# Follow-up leads
curl -s -u "$DASHBOARD_USER:$DASHBOARD_PASS" "https://YOUR_RAILWAY_URL/api/leads?follow_up=active" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Active follow-ups: {len(d)}')"
```

### Database Integrity Check

Connect to the production DB and compare with pre-deploy baseline:

```sql
-- Verify total lead count unchanged
SELECT COUNT(*) AS total_leads FROM leads;
-- Must match pre-deploy baseline exactly

-- Verify status distribution unchanged
SELECT status, COUNT(*) FROM leads GROUP BY status;
-- Must match pre-deploy baseline

-- Verify follow-up status distribution unchanged
SELECT follow_up_status, COUNT(*) FROM leads
WHERE follow_up_status IS NOT NULL GROUP BY follow_up_status;

-- Verify no NULLs in required columns
SELECT COUNT(*) FROM leads WHERE raw_email IS NULL;
-- Expected: 0

SELECT COUNT(*) FROM leads WHERE status IS NULL;
-- Expected: 0

SELECT COUNT(*) FROM leads WHERE created_at IS NULL OR updated_at IS NULL;
-- Expected: 0

-- Verify schema has 'replied' in CHECK constraint
SELECT sql FROM sqlite_master WHERE type='table' AND name='leads';
-- Must include: 'replied' in follow_up_status CHECK

-- Verify indexes exist (may have been dropped/recreated by migration)
SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='leads';
-- Expected: idx_leads_status, idx_leads_event_date, idx_leads_confidence,
--           idx_leads_outcome, idx_leads_source_platform, idx_leads_follow_up_due
```

### Security Fix Verification

```bash
# CSP nonce injection -- check that script tags have nonce attribute
curl -s -u "$DASHBOARD_USER:$DASHBOARD_PASS" https://YOUR_RAILWAY_URL/dashboard.html | grep -o 'nonce="[^"]*"' | head -3
# Expected: nonce="<base64-string>" (different per request)

# Logout is POST-only (GET should fail)
curl -s -o /dev/null -w "%{http_code}" -u "$DASHBOARD_USER:$DASHBOARD_PASS" https://YOUR_RAILWAY_URL/logout
# Expected: 404 (GET not matched) or redirect -- NOT 200

# URL-encoded body limit in place (server.ts:42 sets 100kb)
# No direct test needed -- just verify server starts without error
```

### Webhook Endpoint Verification

```bash
# Mailgun webhook without signature fields returns 401
curl -s -X POST -H "Content-Type: application/json" -d '{}' https://YOUR_RAILWAY_URL/webhook/mailgun
# Expected: {"error":"Missing signature fields"}

# Twilio webhook without signature returns 401
curl -s -X POST -H "Content-Type: application/x-www-form-urlencoded" -d 'Body=test' https://YOUR_RAILWAY_URL/webhook/twilio
# Expected: {"error":"Invalid Twilio signature"}
```

---

## Rollback Plan

### Can we roll back?

- [x] YES -- Railway supports instant rollback to previous deployment
- [x] YES -- no destructive data migrations (table rebuild preserves all data, just changes CHECK constraint)
- [ ] PARTIAL -- if the `follow_up_status` CHECK migration ran, rolling back code won't undo the schema change. But the new schema (`'replied'` added) is backward-compatible with old code since old code never writes `'replied'`.

### Rollback Steps

1. **In Railway dashboard:** Click "Rollback" on the previous successful deployment
   - This instantly reverts the running code
   - The DB schema change (if it ran) persists but is backward-compatible

2. **If DB corruption detected** (unlikely but possible during table rebuild):
   - Stop the Railway service
   - Restore SQLite DB from pre-deploy backup
   - Rollback the deployment
   - Restart service

3. **If import path errors cause crash loop:**
   - Railway's restart policy (`ON_FAILURE`, max 3 retries) will stop retrying
   - Rollback to previous deployment in Railway dashboard
   - The health check timeout (300s) will mark the deploy as failed if `/health` never responds

4. **Post-rollback verification:**
   ```bash
   curl -s https://YOUR_RAILWAY_URL/health
   # Expected: {"status":"ok"}

   curl -s -u "$DASHBOARD_USER:$DASHBOARD_PASS" https://YOUR_RAILWAY_URL/api/stats
   # Expected: valid JSON response
   ```

### What cannot be rolled back

- The `'replied'` CHECK constraint addition stays in the DB even after code rollback. This is safe because:
  - Old code never writes `follow_up_status = 'replied'`
  - The broader CHECK constraint is a superset, not a conflict
  - SQLite CHECK constraints only validate on INSERT/UPDATE, not on SELECT

---

## Monitoring Plan (first 24 hours)

### First 15 Minutes

| What to Watch | How | Alert Condition |
|---------------|-----|-----------------|
| Railway deploy status | Railway dashboard | Build failed or health check timeout |
| App startup logs | Railway logs | Any `FATAL:` log, `process.exit(1)`, or unhandled exception |
| Health endpoint | `curl /health` | Non-200 response |
| Dashboard loads | Browser visit | Auth prompt not showing, or 500 error |
| Scheduler started | Railway logs | Missing "[scheduler] started" message |

### First Hour

| What to Watch | How | Alert Condition |
|---------------|-----|-----------------|
| Webhook processing | Railway logs for "Webhook received:" | Webhooks returning 500 instead of 200 |
| Pipeline execution | Railway logs for "Pipeline timeout" or "Pipeline error" | New errors not seen before deploy |
| SMS delivery | Check phone for test notification | Follow-up scheduler SMS not arriving |
| Follow-up scheduler | Railway logs for "[scheduler]" | Error logs or missing scheduler ticks |
| Memory usage | Railway metrics dashboard | Spike above normal baseline |

### First 24 Hours

| What to Watch | How | Alert Condition |
|---------------|-----|-----------------|
| Lead count growth | `SELECT COUNT(*) FROM leads` vs baseline | Count decreased (data loss) |
| Error rate | Railway logs, filter for "error" | New error patterns |
| Webhook dedup | Logs for "dedup" messages | Excessive duplicates (idempotency broken) |
| Follow-up state machine | `SELECT follow_up_status, COUNT(*) FROM leads WHERE follow_up_status IS NOT NULL GROUP BY follow_up_status` | Unexpected status values or stuck leads |

### Console Spot Checks (run at +1h, +4h, +24h)

```sql
-- Check no leads stuck in 'sending' status (should be transient)
SELECT id, status, updated_at FROM leads WHERE status = 'sending';
-- Expected: 0 rows (or very brief window)

-- Check no leads with broken JSON
SELECT id FROM leads WHERE classification_json IS NOT NULL
AND json_valid(classification_json) = 0;
-- Expected: 0 rows

-- Verify follow-up scheduler is advancing
SELECT id, follow_up_status, follow_up_due_at, follow_up_count
FROM leads WHERE follow_up_status IN ('pending', 'sent')
ORDER BY follow_up_due_at ASC;
-- Verify due_at values are reasonable (not in distant past)

-- Check for recent pipeline completions (proves end-to-end works)
SELECT id, status, pipeline_completed_at, confidence_score
FROM leads ORDER BY created_at DESC LIMIT 5;
```

---

## Summary

| Category | Status |
|----------|--------|
| P1 findings | 2 (migration risk, import path change) |
| P2 findings | 2 (no tests, new dev env var) |
| P3 findings | 1 (stmt cache duplication) |
| New env vars (production) | 0 |
| New env vars (dev only) | 1 (`DEV_WEBHOOK_KEY`) |
| Schema migrations | 1 (conditional -- adds `'replied'` to CHECK, skips if already present) |
| Build verification | `tsc --noEmit` passes clean |
| Rollback possible | YES -- Railway instant rollback, schema change is backward-compatible |
