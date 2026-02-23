# Deployment Verification Agent — Review Findings

**Agent:** compound-engineering:review:deployment-verification-agent
**Branch:** main (commit range ddb515d..d5b34fe)
**Date:** 2026-02-22
**Files reviewed:** 7

## Findings

### [P1] /api/analyze has no authentication
**File:** `src/server.ts:51`
**Issue:** This endpoint calls `runPipeline()` which invokes the Anthropic API. Anyone on the internet can trigger expensive Claude API calls. The API router protects `/api/leads` and `/api/stats` with `basicAuth`, but `/api/analyze` was added directly in `server.ts` and was missed.
**Suggestion:** Add `basicAuth` middleware to the route.

---

### [P1] Root redirect changes behavior
**File:** `src/server.ts:37-39`
**Issue:** `GET /` now returns a 302 redirect to `/dashboard.html` instead of whatever it returned before. The Railway healthcheck is on `/health` so that is safe, but any external bookmarks or integrations hitting `/` will see different behavior.
**Suggestion:** Verify no external integrations rely on `GET /` returning a specific response. Document the behavior change in release notes.

---

### [P1] Approve endpoint has a race condition
**File:** `src/api.ts:99-137`
**Issue:** `POST /api/leads/:id/approve` reads the lead status, sends SMS, then updates the status — but these steps are not wrapped in a transaction. Two concurrent requests could both see `status = "received"` and send two SMS messages. The frontend disables the button, but that is not a server-side guarantee.
**Suggestion:** Use optimistic locking or a transitional status to prevent double-sends.

---

### [P2] Auth bypass if env vars are unset
**File:** `src/auth.ts:8-11`
**Issue:** The `basicAuth` middleware skips auth entirely when `DASHBOARD_USER` or `DASHBOARD_PASS` are not set. If Railway loses these env vars, the entire dashboard and API become open to the internet.
**Suggestion:** Require these vars in production and fail loudly if missing.

---

### [P2] Edit does not update compressed draft
**File:** `src/api.ts:139-166`
**Issue:** Editing `full_draft` does not re-run compression. After editing, the SMS-ready `compressed_draft` is stale. If the user then clicks "Approve & Send," the old pre-edit compressed draft gets sent via SMS.
**Suggestion:** Re-run compression after edit, or at minimum warn the user that the SMS version is stale.

---

### [P2] Static dashboard.html served without auth
**File:** `src/server.ts:22`
**Issue:** The HTML file with all frontend logic, API endpoint URLs, and field names is publicly accessible. API calls inside it require auth, but the page structure is visible to anyone.
**Suggestion:** Move static file serving behind `basicAuth`, or accept the risk since API calls themselves are protected.

---

### [P3] Google Fonts external dependency
**File:** `public/dashboard.html:7`
**Issue:** Dashboard loads fonts from Google. If unreachable, the page still works but rendering is delayed.
**Suggestion:** Consider self-hosting fonts or adding a fallback font stack.

---

### [P3] No CSRF protection
**File:** `src/api.ts:99,141`
**Issue:** POST endpoints rely on Basic Auth only. Low risk for a single-user tool but worth noting.
**Suggestion:** Document as accepted risk for internal tool.

---

## Deployment Checklist

### Pre-Deploy

- [ ] Confirm `DASHBOARD_USER` and `DASHBOARD_PASS` are set in Railway
- [ ] Confirm `ANTHROPIC_API_KEY` is set in Railway
- [ ] Record current commit SHA for rollback: `git rev-parse HEAD`
- [ ] Record baseline lead counts: `SELECT status, COUNT(*) FROM leads GROUP BY status`
- [ ] Verify no external integrations depend on `GET /` response format

### Deploy

- [ ] Deploy to Railway via `git push` or Railway CLI
- [ ] No database migrations needed (no schema changes in this range)

### Post-Deploy

- [ ] Verify `/health` endpoint returns 200
- [ ] Verify `/dashboard.html` loads and shows lead list
- [ ] Verify `/api/leads` returns JSON with auth
- [ ] Verify `/api/leads` returns 401 without auth
- [ ] Test approve flow on a test lead
- [ ] Test edit flow on a test lead
- [ ] Check Railway logs for startup errors
- [ ] Verify old `/leads` route still works (if keeping as fallback)

### Rollback

- [ ] Redeploy previous commit: `railway deploy --commit <previous-sha>`
- [ ] No database rollback needed (no schema changes)
- [ ] Verify `/health` returns 200 after rollback

### Go/No-Go

**GO** if:
1. `DASHBOARD_USER` and `DASHBOARD_PASS` confirmed set
2. P1 on `/api/analyze` auth is either fixed or explicitly accepted
3. Baseline SQL numbers recorded
4. Previous commit SHA recorded

**NO-GO** if:
1. Auth env vars are missing or empty
2. Anthropic API key is missing
