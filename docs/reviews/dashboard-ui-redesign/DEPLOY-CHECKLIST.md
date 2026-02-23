# Deployment Checklist: Dashboard UI Redesign (ddb515d..d5b34fe)

**Branch:** main
**Commits:** 8 commits (b918790 through d5b34fe)
**Deploy target:** Railway (Nixpacks, `npx tsx src/server.ts`)
**Risk level:** MEDIUM -- new API endpoints with write operations (approve sends SMS, edit mutates drafts), auth refactor, route changes

---

## Findings

### [P1] /api/analyze endpoint has no authentication

**File:** `/Users/alejandroguillen/Projects/gig-lead-responder/src/server.ts:51`
**Issue:** The `/api/analyze` POST endpoint is defined directly in `server.ts` without any `basicAuth` middleware. It calls `runPipeline()` which invokes the Anthropic API, meaning anyone on the internet can trigger expensive Claude API calls by posting to this endpoint. The API router protects `/api/leads` and `/api/stats` with `basicAuth`, but `/api/analyze` was added separately in `server.ts` and was missed.
**Suggestion:** Add `basicAuth` middleware to the `/api/analyze` route:
```typescript
import { basicAuth } from "./auth.js";
// ...
app.post("/api/analyze", basicAuth, async (req, res) => {
```

### [P1] Root redirect breaks existing bookmarks and webhook confirmations

**File:** `/Users/alejandroguillen/Projects/gig-lead-responder/src/server.ts:37-39`
**Issue:** A new `app.get("/")` route redirects to `/dashboard.html`. However, `express.static` is registered before this route (line 22) and serves files from `public/`. If there were previously an `index.html` in `public/`, the static middleware would serve it before the redirect fires. More critically, if any external service (Mailgun verification, Railway health dashboards, browser bookmarks) hits `/`, they now get a 302 redirect instead of content. The redirect itself is to an unauthenticated static file -- the `dashboard.html` frontend then makes authenticated API calls. This is fine for the dashboard, but the redirect changes the root behavior.
**Suggestion:** Verify no external service depends on `/` returning a 200. The healthcheck is on `/health` (confirmed in `railway.json`), so Railway itself is safe. Document this behavioral change.

### [P1] Approve endpoint sends real SMS with no confirmation gate

**File:** `/Users/alejandroguillen/Projects/gig-lead-responder/src/api.ts:99-137`
**Issue:** `POST /api/leads/:id/approve` immediately calls `sendSms()` and marks the lead as `done` with `done_reason: "approved_dashboard"`. There is no "are you sure?" server-side confirmation, no rate limiting, and no idempotency check. If the button is double-clicked before the first request completes, two SMS messages could be sent (the second would fail on the status check since status becomes "done", but there is a race window). The frontend disables the button, but that is not a server-side guarantee.
**Suggestion:** Consider adding a database-level check using a transaction: read the lead status inside the same transaction that updates it, so concurrent requests cannot both see `status = "received"`. The current code reads then writes without a transaction wrapper.

### [P2] Auth bypass in local development leaks to production if env vars are unset

**File:** `/Users/alejandroguillen/Projects/gig-lead-responder/src/auth.ts:8-11`
**Issue:** The `basicAuth` middleware skips authentication entirely when `DASHBOARD_USER` or `DASHBOARD_PASS` are not set. This is documented as "local dev convenience," but if the Railway deployment ever loses these env vars (misconfiguration, variable deletion, service recreation), the dashboard and all API endpoints become completely open to the internet. This includes the approve endpoint which sends real SMS.
**Suggestion:** Add a startup check in `server.ts` that warns loudly (or exits) if `DASHBOARD_USER`/`DASHBOARD_PASS` are unset in production. Check for `NODE_ENV=production` or `RAILWAY_ENVIRONMENT` being set:
```typescript
if (process.env.RAILWAY_ENVIRONMENT && (!process.env.DASHBOARD_USER || !process.env.DASHBOARD_PASS)) {
  console.error("CRITICAL: DASHBOARD_USER/DASHBOARD_PASS not set in production!");
  process.exit(1);
}
```

### [P2] Edit endpoint does not recompress the draft

**File:** `/Users/alejandroguillen/Projects/gig-lead-responder/src/api.ts:139-166`
**Issue:** `POST /api/leads/:id/edit` updates `full_draft` and increments `edit_round`, but does not update `compressed_draft`. After editing a draft, the compressed (SMS-ready) version still contains the old text. If the user then clicks "Approve & Send," the SMS will contain the pre-edit compressed draft, not the edited version.
**Suggestion:** Either (a) re-run the compression step after edit, (b) clear `compressed_draft` to null so approve is blocked until recompression, or (c) document this clearly in the UI so users know the SMS draft is stale after editing.

### [P2] Static file dashboard.html is served without authentication

**File:** `/Users/alejandroguillen/Projects/gig-lead-responder/src/server.ts:22`
**Issue:** `express.static` serves `public/dashboard.html` directly without any auth middleware. The HTML file itself contains the full UI structure and JavaScript. While the API calls inside it require Basic Auth, the page structure, business logic, endpoint URLs, and field names are all visible to unauthenticated visitors. This is a minor information leak -- it reveals the existence and shape of the API.
**Suggestion:** Move `dashboard.html` out of `public/` and serve it through an authenticated route, or accept this as a known tradeoff (the API calls themselves are protected).

### [P2] Password stored in prompt() and btoa() is visible in browser history/devtools

**File:** `/Users/alejandroguillen/Projects/gig-lead-responder/public/dashboard.html:981-985`
**Issue:** The frontend uses `prompt()` for username/password entry and stores the result in a JavaScript variable (`authHeader`). The password is visible in browser developer tools, is not cleared on page navigation, and `prompt()` input is not masked (the password is visible as plaintext while typing).
**Suggestion:** For a single-user dashboard this is acceptable risk. If hardening later, switch to a login form with a password input type, or use HTTP-level Basic Auth (browser's native prompt masks the password field).

### [P3] Google Fonts external dependency for dashboard

**File:** `/Users/alejandroguillen/Projects/gig-lead-responder/public/dashboard.html:7`
**Issue:** The dashboard loads `Playfair Display` from `fonts.googleapis.com`. If Google Fonts is unreachable (corporate firewalls, Google outage), the dashboard will still work but text rendering will be delayed while the browser times out on the font request.
**Suggestion:** Add `font-display: swap` to the Google Fonts URL parameter (`&display=swap` -- already present in the URL). Confirm this is acceptable for your use case.

### [P3] No CSRF protection on POST endpoints

**File:** `/Users/alejandroguillen/Projects/gig-lead-responder/src/api.ts:99,141`
**Issue:** The POST endpoints (`/api/leads/:id/approve` and `/api/leads/:id/edit`) rely solely on Basic Auth. There is no CSRF token. If an attacker knows the user is logged in, they could craft a page that submits requests to these endpoints (the browser would include the Basic Auth credentials automatically for same-origin requests).
**Suggestion:** For a single-user tool this is low risk. If hardening later, add a CSRF token or switch to token-based auth (Bearer tokens are not sent automatically by browsers).

---

## Pre-Deploy (Required)

### Environment Variables

- [ ] Confirm `DASHBOARD_USER` is set in Railway environment variables
- [ ] Confirm `DASHBOARD_PASS` is set in Railway environment variables (and is NOT "change-me")
- [ ] Confirm `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, `ALEX_PHONE` are set (the approve endpoint will call `sendSms`)
- [ ] Confirm `ANTHROPIC_API_KEY` is set (the analyze endpoint calls `runPipeline`)
- [ ] No new environment variables are required by this deploy

### Database Verification

No schema changes in this deploy. The existing `leads` table and `processed_emails` table are unchanged. The `initDb()` function handles additive column migrations automatically (confidence_score, error_message, pipeline_completed_at, sms_sent_at).

Run these read-only queries against the production database BEFORE deploying:

```sql
-- Baseline: count leads by status (save these numbers)
SELECT status, COUNT(*) FROM leads GROUP BY status;

-- Baseline: count of leads with drafts (approve depends on compressed_draft)
SELECT
  COUNT(*) AS total_leads,
  SUM(CASE WHEN full_draft IS NOT NULL THEN 1 ELSE 0 END) AS has_full_draft,
  SUM(CASE WHEN compressed_draft IS NOT NULL THEN 1 ELSE 0 END) AS has_compressed_draft
FROM leads;

-- Baseline: count of done leads by done_reason (new reason "approved_dashboard" will appear)
SELECT done_reason, COUNT(*) FROM leads WHERE status = 'done' GROUP BY done_reason;

-- Check: no leads stuck in unexpected state
SELECT id, status, created_at FROM leads
WHERE status NOT IN ('received', 'sent', 'done', 'failed')
ORDER BY id;
-- Expected: 0 rows
```

**Save these baseline numbers. You will compare them after deploy.**

### Pre-Deploy Functional Checks

- [ ] Run `npx tsx src/server.ts` locally and confirm the server starts without errors
- [ ] Open `http://localhost:3000/` and confirm it redirects to `/dashboard.html`
- [ ] Open `http://localhost:3000/dashboard.html` and confirm the page loads (stats, table)
- [ ] Open `http://localhost:3000/leads` and confirm the old dashboard still works
- [ ] Confirm `http://localhost:3000/health` returns `{"status":"ok"}`
- [ ] Click a lead row in the new dashboard and confirm the detail panel expands
- [ ] If test leads exist, confirm the Approve & Send button appears for "received" status leads

### Rollback Readiness

- [ ] Note the current deployed commit SHA: ____________
- [ ] Confirm you can redeploy previous commit via Railway dashboard or `git revert`

---

## Deploy Steps

| Step | Action | Est. Time | Rollback |
|------|--------|-----------|----------|
| 1 | Push commit d5b34fe to main (or trigger Railway deploy) | ~2 min build | Redeploy prior commit |
| 2 | Railway auto-restarts with `npx tsx src/server.ts` | ~10 sec | N/A (auto) |
| 3 | Healthcheck passes at `/health` | ~30 sec | Railway auto-rolls back after 3 failures |

1. [ ] Trigger deploy (push to main or manual Railway deploy)
2. [ ] Watch Railway build logs for compilation errors
3. [ ] Confirm Railway healthcheck passes (green status in dashboard)

---

## Post-Deploy Verification (Within 5 Minutes)

### Route Verification

- [ ] `GET /health` returns `{"status":"ok"}` -- confirms server is running
- [ ] `GET /` redirects to `/dashboard.html` (302 response)
- [ ] `GET /dashboard.html` loads the new dashboard UI
- [ ] `GET /leads` loads the old server-rendered dashboard (still works)
- [ ] `GET /api/leads` returns JSON array of leads (requires auth)
- [ ] `GET /api/stats` returns JSON with pending/sent/avg_score/this_month (requires auth)
- [ ] `GET /api/leads` without auth returns 401 (if DASHBOARD_USER/PASS are set)
- [ ] `GET /api/stats` without auth returns 401 (if DASHBOARD_USER/PASS are set)

Test with curl:
```bash
# Health check (no auth)
curl -s https://YOUR-APP.up.railway.app/health

# Root redirect
curl -s -o /dev/null -w "%{http_code}" https://YOUR-APP.up.railway.app/

# API without auth (should be 401)
curl -s -o /dev/null -w "%{http_code}" https://YOUR-APP.up.railway.app/api/leads

# API with auth
curl -s -u "USER:PASS" https://YOUR-APP.up.railway.app/api/leads | head -c 200

# Stats with auth
curl -s -u "USER:PASS" https://YOUR-APP.up.railway.app/api/stats
```

### Database Integrity (Within 5 Minutes)

```sql
-- Compare with pre-deploy baseline: counts should be identical
SELECT status, COUNT(*) FROM leads GROUP BY status;

-- Confirm no leads were modified during deploy
SELECT id, status, updated_at FROM leads
ORDER BY updated_at DESC
LIMIT 5;
-- Expected: no updated_at timestamps during the deploy window
```

### Dashboard Functional Test

- [ ] Open the new dashboard in a browser
- [ ] Confirm stats cards show correct numbers matching the SQL baseline
- [ ] Confirm filter pills work (All, Pending, Sent, Done, Failed)
- [ ] Confirm sort dropdown works (Newest, Event Date, Score, Event Type)
- [ ] Click a lead row and confirm detail panel expands with gut checks, draft, pricing
- [ ] Confirm the "Analyze" tab loads and shows the text input area
- [ ] **DO NOT** click "Approve & Send" unless you intend to send a real SMS

---

## Rollback Plan

**Can we roll back?** YES -- this deploy adds new endpoints and a new static file. Rolling back removes them cleanly. No database schema changes to reverse. No data migrations to undo.

### Rollback Trigger Conditions

Roll back if ANY of these occur:
- Healthcheck fails after deploy
- `/api/leads` returns 500 errors
- Existing webhook endpoints (`/webhook`, `/twilio-webhook`) stop working
- SMS messages are sent unintentionally
- The old dashboard at `/leads` stops working

### Rollback Steps

1. [ ] In Railway dashboard, click "Rollback" to the previous deployment
   - OR: `git revert d5b34fe` and push to main
2. [ ] Confirm healthcheck passes on the rolled-back version
3. [ ] Confirm `/leads` (old dashboard) still works
4. [ ] Confirm webhook endpoints still accept inbound emails/SMS

### Post-Rollback Database Check

```sql
-- Check if any leads were approved via dashboard during the deploy window
SELECT id, status, done_reason, sms_sent_at
FROM leads
WHERE done_reason = 'approved_dashboard'
ORDER BY updated_at DESC;

-- If any exist and were unintentional, you cannot un-send the SMS,
-- but you can revert the status:
-- UPDATE leads SET status = 'received', done_reason = NULL, sms_sent_at = NULL
-- WHERE id = <ID> AND done_reason = 'approved_dashboard';
```

---

## Monitoring (First 24 Hours)

### What to Watch

| What | How to Check | Alert Condition |
|------|-------------|-----------------|
| Server uptime | Railway healthcheck at `/health` | Auto-restarts after 3 failures |
| API errors | Railway deploy logs | Any 500 error in logs |
| Unexpected SMS | Check Twilio console for outbound messages | Any SMS sent outside your approve action |
| Auth bypass | Check Railway logs for requests to `/api/leads` | 200 responses without auth headers when env vars should be set |
| Anthropic API costs | Anthropic dashboard | Unexpected spike (could indicate unauthenticated `/api/analyze` abuse) |
| Database growth | Railway volume usage | Unusual growth pattern |

### Manual Checks

**At +1 hour:**
- [ ] Check Railway logs for any errors or warnings
- [ ] Check Twilio console -- no unexpected outbound SMS
- [ ] Open dashboard and confirm it still loads

**At +4 hours:**
- [ ] If any new leads have arrived via webhook, confirm they appear in both old (`/leads`) and new (`/dashboard.html`) dashboards
- [ ] Check Anthropic API usage dashboard for unexpected spikes

**At +24 hours:**
- [ ] Run the baseline SQL queries again and compare with pre-deploy numbers
- [ ] Confirm any new leads processed correctly through the pipeline
- [ ] Check error rate in Railway logs
- [ ] Close this deployment checklist

```sql
-- 24-hour check: any new approved_dashboard leads?
SELECT id, status, done_reason, sms_sent_at, updated_at
FROM leads
WHERE done_reason = 'approved_dashboard'
ORDER BY updated_at DESC;

-- 24-hour check: any errors since deploy?
SELECT id, status, error_message, updated_at
FROM leads
WHERE error_message IS NOT NULL
ORDER BY updated_at DESC
LIMIT 10;
```

---

## Go/No-Go Criteria

### MUST PASS (deploy blocked if any fail)

- [ ] `DASHBOARD_USER` and `DASHBOARD_PASS` are set in Railway
- [ ] Local smoke test: server starts, healthcheck passes, dashboard loads
- [ ] Twilio credentials are set (approve endpoint will fail hard without them)
- [ ] Pre-deploy baseline SQL numbers are recorded
- [ ] Previous commit SHA is recorded for rollback

### SHOULD PASS (deploy with caution if any fail)

- [ ] P1 finding on `/api/analyze` auth is acknowledged (accept risk or fix first)
- [ ] P1 finding on approve race condition is acknowledged
- [ ] P2 finding on edit/compress mismatch is documented for users
- [ ] All local functional tests pass

### NICE TO HAVE (not blocking)

- [ ] P2 auth-bypass production guard is added
- [ ] P3 CSRF protection is added
- [ ] Dashboard served behind auth instead of as static file

---

## Summary of Changes in This Deploy

1. **New file: `src/auth.ts`** -- Basic Auth middleware extracted from `dashboard.ts` into a shared module. Both the old dashboard (`/leads`) and new API routes use it.

2. **New file: `src/api.ts`** -- JSON API router with 4 endpoints:
   - `GET /api/leads` -- list leads with optional status filter and sort
   - `GET /api/stats` -- aggregate stats (pending count, sent count, avg score, this month)
   - `POST /api/leads/:id/approve` -- approve a lead and send SMS via Twilio
   - `POST /api/leads/:id/edit` -- edit a lead's full_draft text

3. **New file: `public/dashboard.html`** -- 1558-line single-page dashboard with:
   - Stats cards, filterable/sortable lead table, expandable detail panels
   - Approve & Send button (sends real SMS)
   - Edit Draft functionality
   - Analyze tab with SSE streaming pipeline
   - Mobile-responsive layout

4. **Modified: `src/dashboard.ts`** -- Auth middleware moved to `auth.ts` (import changed, no logic change).

5. **Modified: `src/server.ts`** -- Mounts `apiRouter`, adds root redirect to `/dashboard.html`, adds `/api/analyze` SSE endpoint.

6. **Modified: `src/leads.ts`** -- Added `listLeadsFiltered()` and `getLeadStats()` query functions for the new API. No schema changes.

7. **No database migration required.** No new tables or columns.

8. **No new environment variables required.** Existing `DASHBOARD_USER`/`DASHBOARD_PASS` are reused for the API auth.
