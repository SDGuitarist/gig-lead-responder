# Deployment Verification Agent — Review Findings

**Agent:** deployment-verification-agent
**Branch:** main (full codebase audit)
**Date:** 2026-04-07
**Files reviewed:** 63

## Pre-Deploy Checklist

### Environment Variables

| Variable | Required | Guard | Notes |
|----------|----------|-------|-------|
| `ANTHROPIC_API_KEY` | Yes | FATAL (server.ts:7-9) | process.exit(1) if missing |
| `DASHBOARD_USER` | Yes (prod) | FATAL (server.ts:17-20) | Basic auth username |
| `DASHBOARD_PASS` | Yes (prod) | FATAL (server.ts:17-20) | Basic auth password |
| `COOKIE_SECRET` | Yes (prod) | FATAL (auth.ts:13-16) | `openssl rand -hex 32` |
| `MAILGUN_WEBHOOK_KEY` | Yes | Soft (returns 401) | Webhook signing key |
| `TWILIO_ACCOUNT_SID` | Yes | Soft (SMS fails silently) | |
| `TWILIO_AUTH_TOKEN` | Yes | Soft | |
| `TWILIO_FROM_NUMBER` | Yes | Soft | |
| `ALEX_PHONE` | Yes | Soft | |
| `BASE_URL` | Yes | Soft | Must match Railway domain exactly |
| `DATABASE_PATH` | Yes | Default `./data/leads.db` | Must point to persistent volume |
| `PF_INTEL_API_URL` | Recommended | Soft | Must use public URL (not .railway.internal) |
| `PF_INTEL_SERVER_API_KEY` | Recommended | Soft | |
| `GMAIL_CREDENTIALS_JSON` | For Gmail | Soft (poller disables) | Full JSON content |
| `GMAIL_TOKEN_JSON` | For Gmail | Soft (poller disables) | Full JSON content |
| `DRY_RUN` | Recommended | Default `true` | Set `"false"` for live sends |

### Volume & Networking

- [ ] Persistent volume mounted for SQLite database
- [ ] `DATABASE_PATH` points to volume mount path
- [ ] Gmail dedup file (`data/processed-ids.json`) on volume
- [ ] Networking port matches app binding (`::`on PORT)
- [ ] Healthcheck path set to `/health`
- [ ] Public domain active in Railway settings

## Post-Deploy Verification (Within 5 Minutes)

### Healthcheck
```bash
curl -s https://YOUR-DOMAIN.up.railway.app/health
# Expected: {"status":"ok"}
```

### Dashboard Access
```bash
curl -s -u admin:YOUR_PASS https://YOUR-DOMAIN.up.railway.app/dashboard.html -o /dev/null -w "%{http_code}"
# Expected: 200
```

### Webhook Validation
```bash
# Mailgun (should reject unsigned)
curl -s -X POST https://YOUR-DOMAIN.up.railway.app/webhook/mailgun \
  -H "Content-Type: application/json" -d '{"test": true}' -w "\n%{http_code}"
# Expected: 401

# Twilio (should reject unsigned)
curl -s -X POST https://YOUR-DOMAIN.up.railway.app/webhook/twilio \
  -H "Content-Type: application/json" -d '{"Body": "test"}' -w "\n%{http_code}"
# Expected: 403
```

### Deploy Log Patterns

| Pattern | Meaning | Action |
|---------|---------|--------|
| `FATAL:` | Startup guard failed | Check env vars |
| `[gmail-poller] Gmail auth token expired` | OAuth token invalid | Re-auth + update env var |
| `[scheduler] started` | Follow-up scheduler running | Good |
| `Pipeline timeout after 2 minutes` | Claude API slow | Check Anthropic status |
| `postPipelineError failed:` | Double fault | Leads stuck in received |

## Findings

### [P2] Gmail leads not visible in dashboard post-deploy
**File:** `src/automation/orchestrator.ts`
**Issue:** Gmail-polled leads are processed but NOT stored in SQLite. After deploy, any Gmail leads are invisible in dashboard, excluded from analytics, and cannot be managed.
**Suggestion:** Verify this is understood before going live with Gmail automation.

---

### [P2] Webhook rate limiters not mounted
**File:** `src/webhook.ts`, `src/twilio-webhook.ts`
**Issue:** Rate limiters defined in `rate-limit.ts` but not applied to webhook routes. Malicious actor could flood pipeline.
**Suggestion:** Mount rate limiters before deploy.

---

### [P2] Dashboard HTML publicly accessible without auth
**File:** `src/app.ts:56-59`
**Issue:** `/dashboard.html` served before sessionAuth middleware. UI structure exposed.
**Suggestion:** Add sessionAuth to dashboard route.

---

### [P2] SSE heartbeat missing — proxy may drop long connections
**File:** `src/api.ts:240-258`
**Issue:** `/api/analyze` SSE has no keepalive. Railway proxy may close idle connections during 30-120s pipeline runs.
**Suggestion:** Add 15s heartbeat interval.

---

### [P3] PF-Intel URL must be public (cross-project)
**File:** `.env.example:52`
**Issue:** Example shows `.railway.internal` URL but PF-Intel is in different Railway project. Private networking only works within same project.
**Suggestion:** Update example to show public URL pattern.

---

### [P3] DRY_RUN default behavior is non-obvious
**File:** `src/automation/config.ts:36`
**Issue:** `DRY_RUN !== "false"` means `DRY_RUN=0` or `DRY_RUN=no` keeps dry run ON. Only exact string `"false"` disables it.
**Suggestion:** Document in .env.example.

---

## Rollback Plan

1. In Railway dashboard, click previous successful deploy and select "Rollback"
2. Verify healthcheck: `curl https://YOUR-DOMAIN.up.railway.app/health`
3. Verify deploy logs show no migration errors
4. SQLite database on persistent volume is unaffected by code rollback
5. Schema migrations are additive — rollback is safe

**Manual backup before risky deploys:**
```bash
railway shell
cp /data/leads.db /data/leads.db.backup
```

## Monitoring Schedule (First 24 Hours)

| Time | Check |
|------|-------|
| +5 min | Healthcheck returns 200 |
| +5 min | Deploy logs — no FATAL or crash errors |
| +15 min | First scheduler cycle (`[scheduler] 0 lead(s) due`) |
| +1 hour | Gmail poller — no repeated errors |
| +4 hours | No leads stuck in `received` status > 30 min |
| +24 hours | Database file size stable |
| +24 hours | `processed-ids.json` not growing excessively |

## GO/NO-GO Decision Points

| # | Question |
|---|----------|
| 1 | All FATAL env vars set? |
| 2 | Validation bypass flags NOT set to "true"? |
| 3 | BASE_URL matches Railway domain? |
| 4 | DATABASE_PATH on persistent volume? |
| 5 | Volume mounted in Railway settings? |
| 6 | Port matches app binding? |
| 7 | Healthcheck path = /health? |
| 8 | PF-Intel URL is public (not .railway.internal)? |
| 9 | Aware Gmail leads don't persist to SQLite? |
| 10 | Aware webhooks have no rate limiting? |
