# Deployment Verification Agent — Review Findings

**Agent:** compound-engineering:review:deployment-verification-agent
**Branch:** feat/follow-up-v2-dashboard
**Date:** 2026-03-02
**Files reviewed:** 14

## Findings

### [P1] COOKIE_SECRET env var missing causes immediate crash in production
**File:** `src/auth.ts:13-15`
**Issue:** The new `getCookieSecret()` function calls `process.exit(1)` when `COOKIE_SECRET` is unset and `NODE_ENV=production` or `RAILWAY_ENVIRONMENT` is set. Deploying to Railway **without first setting `COOKIE_SECRET` will crash the server on the first authenticated request**.
**Suggestion:** Add `COOKIE_SECRET` to Railway environment variables BEFORE deploying. Generate with `openssl rand -hex 32`. Also add to `.env.example`.

---

### [P1] SQLite table rebuild migration is destructive — requires backup
**File:** `src/leads.ts:96-146`
**Issue:** The migration runs `DROP TABLE leads` inside a transaction after copying data to `leads_new`. While wrapped in a transaction (safe for small tables), this is a destructive operation. If the process crashes mid-migration, data could be lost. The migration also hardcodes all column names, meaning any future column additions that happen before this migration runs would be silently dropped.
**Suggestion:** Back up the production database (`cp /data/leads.db /data/leads.db.bak`) BEFORE deploying. Verify the table has fewer than 100 rows.

---

### [P1] Indexes dropped during table rebuild must be verified post-deploy
**File:** `src/leads.ts:148-152`
**Issue:** `DROP TABLE leads` also drops all indexes. The code recreates them with `CREATE INDEX IF NOT EXISTS` after the migration block. However, if the server crashes after the table rebuild but before index creation, queries will work but be slow.
**Suggestion:** Verify post-deploy that indexes exist by running the verification query in the post-deploy checklist.

---

### [P2] BASE_URL now used in scheduler SMS notification
**File:** `src/follow-up-scheduler.ts:13`
**Issue:** The scheduler now sends SMS with `${baseUrl()}/dashboard.html#follow-ups`. If `BASE_URL` is unset or wrong, the SMS will contain an empty or broken link. Previously the scheduler sent full draft text, so `BASE_URL` was not needed by the scheduler.
**Suggestion:** Verify `BASE_URL` is set correctly in Railway, includes `https://`, and matches the actual Railway domain.

---

### [P2] `skipFollowUp` and `markClientReplied` not wrapped in `runTransaction`
**File:** `src/leads.ts:424-476`
**Issue:** `approveFollowUp` uses `runTransaction` because it does multiple operations. `skipFollowUp` and `markClientReplied` each do a single atomic UPDATE followed by a `getLead` read. The read is not protected by a transaction, so a concurrent write could change the lead between the UPDATE and the getLead.
**Suggestion:** Acceptable for single-user scenario. If moving to multi-user or PostgreSQL, wrap in transactions.

---

### [P2] `getLeadsDueForFollowUp` does not filter on `snoozed_until`
**File:** `src/leads.ts:338-344`
**Issue:** The query does not filter on `snoozed_until`, but `claimFollowUpForSending` does check it. Snoozed leads will be fetched by the scheduler but then rejected by the claim function — harmless but wasteful.
**Suggestion:** If you see many `claim failed` log lines in production, add the `snoozed_until` filter to `getLeadsDueForFollowUp`.

---

### [P2] CSRF guard skips check for Basic Auth header without verifying credentials
**File:** `src/auth.ts:149-153`
**Issue:** The `csrfGuard` middleware skips the X-Requested-With check if `req.headers.authorization` starts with `"Basic "`. An attacker could send `Authorization: Basic garbage` to bypass CSRF checks. Mitigated because `sessionAuth` runs first and rejects invalid credentials.
**Suggestion:** Acceptable due to middleware ordering. Document this ordering dependency with a comment.

---

### [P3] `.env.example` does not include COOKIE_SECRET
**File:** `.env.example`
**Issue:** The new `COOKIE_SECRET` env var is required in production but not documented.
**Suggestion:** Add `COOKIE_SECRET=` to `.env.example` with a generation comment.

---

### [P3] Security headers use `unsafe-inline` for scripts
**File:** `src/server.ts:40-42`
**Issue:** CSP includes `script-src 'self' 'unsafe-inline'` and `style-src 'self' 'unsafe-inline'`. Required because `dashboard.html` uses inline `<script>` and `<style>` blocks, but weakens XSS protection.
**Suggestion:** Acceptable for single-user dashboard. Move to external files if dashboard becomes multi-user.

---

### [P3] 90-day cookie expiry with no logout/revocation mechanism
**File:** `src/auth.ts:5`
**Issue:** `COOKIE_MAX_AGE_S = 90 * 24 * 60 * 60` (90 days). If a device is lost, the session remains valid. No logout endpoint exists.
**Suggestion:** Acceptable for single-user internal tool. Rotate `COOKIE_SECRET` in Railway to invalidate all sessions if needed.

---

## Go/No-Go Checklist

### Pre-Deploy (Required)

#### Environment Variables
- [ ] **Set `COOKIE_SECRET` in Railway** — generate with `openssl rand -hex 32`
- [ ] Verify `BASE_URL` is set and correct (includes `https://`, matches Railway domain, no trailing slash)
- [ ] Verify `DASHBOARD_USER` and `DASHBOARD_PASS` are set
- [ ] Verify all existing env vars are still present

#### Database Backup
- [ ] Database backup created at `/data/leads.db.bak`
- [ ] Verify backup is valid: `sqlite3 /data/leads.db.bak "SELECT COUNT(*) FROM leads;"`

#### Pre-Deploy Verification Queries
```sql
SELECT COUNT(*) AS total_leads FROM leads;
SELECT follow_up_status, COUNT(*) FROM leads GROUP BY follow_up_status;
SELECT sql FROM sqlite_master WHERE type='table' AND name='leads';
SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='leads' AND name LIKE 'idx_%';
```

#### Dependency Check
- [ ] `npm install` runs without errors
- [ ] `cookie-parser@^1.4.7` installs cleanly
- [ ] `package-lock.json` is committed

### Deploy
- [ ] COOKIE_SECRET set in Railway
- [ ] Deploy triggered
- [ ] Server started successfully (check Railway logs)
- [ ] Look for: `Migration: rebuilding leads table to add 'replied'...`
- [ ] Look for: `Migration complete: follow_up_status CHECK now includes 'replied'.`
- [ ] No errors in startup logs

### Post-Deploy (Within 5 Minutes)
- [ ] Dashboard loads at production URL
- [ ] Auth prompt appears on first visit, cookie set after login
- [ ] `GET /api/leads` returns expected lead list
- [ ] `GET /api/leads?follow_up=active` returns correct filtered leads
- [ ] Follow-Ups tab loads in dashboard
- [ ] POST without `X-Requested-With` header returns 403
- [ ] Row count matches pre-deploy baseline
- [ ] All indexes exist post-rebuild

### Post-Deploy Verification Queries
```sql
SELECT COUNT(*) AS total_leads FROM leads;
SELECT follow_up_status, COUNT(*) FROM leads GROUP BY follow_up_status;
SELECT sql FROM sqlite_master WHERE type='table' AND name='leads';
SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='leads' AND name LIKE 'idx_%';
SELECT COUNT(*) FROM leads WHERE snoozed_until IS NOT NULL;
```

### Rollback Plan
1. Redeploy `main` branch from Railway
2. Remove `COOKIE_SECRET` (optional — reverts to pure Basic Auth)
3. Verify old dashboard works

**If data corruption detected:**
1. Stop server (pause Railway deployment)
2. Restore from backup: `cp /data/leads.db.bak /data/leads.db`
3. Redeploy `main` branch
4. Verify restoration with pre-deploy queries

### Go/No-Go Decision Points

| Check | Go | No-Go |
|-------|-----|--------|
| COOKIE_SECRET set | Present in Railway env | Missing — server will crash |
| BASE_URL correct | Matches Railway domain | Wrong or missing — SMS links broken |
| Database backup | Created and verified | Not created — risk of data loss |
| Pre-deploy row count | Recorded | Not recorded — cannot verify integrity |
| npm install clean | No errors | Dependency resolution failures |
| Staging test | Dashboard loads, Follow-Ups tab works | Any 500 errors or crashes |

**Minimum requirement to deploy: COOKIE_SECRET set, database backed up, pre-deploy counts recorded.**
