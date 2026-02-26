# Deployment Verification Agent -- Review Findings

**Agent:** deployment-verification-agent
**Branch:** fix/batch-d-quick-wins
**Date:** 2026-02-25
**Files reviewed:** 4 (`package.json`, `package-lock.json`, `src/server.ts`, `src/api.ts`)
**Deployment platform:** Railway (Nixpacks build, `npx tsx src/server.ts`)

## Summary of Changes

Three commits, all security-hardening:

1. **`d821f2e` -- Helmet middleware** adds `helmet@8.1.0` with CSP override (`scriptSrc: ['self', 'unsafe-inline']`). This sets 12+ security headers on every response.
2. **`7cdfb0e` -- Sanitize SMS error responses** replaces raw `err.message` in the `/api/leads/:id/approve` 500 response with a generic `"SMS delivery failed"` string. Logs the real error server-side.
3. **`94a4552` -- Sanitize analyze error responses** same pattern for `/api/analyze` SSE error events: generic message to client, real error to `console.error`.

---

## Findings

### [P2] Helmet CSP `script-src-attr 'none'` may block inline event handlers
**File:** `src/server.ts:22-30` and `public/dashboard.html:941`, `public/index.html:149`
**Issue:** Helmet v8 default CSP includes `script-src-attr 'none'`, which blocks inline event handler attributes like `onclick="..."`. The dashboard uses `onclick="loadStats(); loadLeads();"` (dashboard.html:941) and `onclick="analyze()"` (index.html:149). While Chrome currently only warns (does not block) for `script-src-attr` when `script-src` includes `'unsafe-inline'`, Firefox and future browser versions may enforce this strictly. If enforced, clicking Refresh and Analyze buttons would silently fail.
**Suggestion:** Test both buttons in the deployed environment across Chrome and Firefox. If blocked, add `scriptSrcAttr: ["'unsafe-inline'"]` to the Helmet config, or migrate `onclick` attributes to `addEventListener` calls in the script block. This is a **Go/No-Go verification item** -- see checklist below.

### [P3] Error messages still leaked via SMS in twilio-webhook.ts
**File:** `src/twilio-webhook.ts:197,210,219`
**Issue:** The branch sanitized error responses in `api.ts` (HTTP endpoints), but `twilio-webhook.ts` still sends raw `err.message` content via SMS to the user's phone (e.g., `"Error approving: Connection refused to Twilio API..."`). This is a lower-severity leak because SMS goes to the app owner (not an attacker), but it is inconsistent with the sanitization pattern introduced in this branch.
**Suggestion:** Not a blocker for this deployment. Track as follow-up: sanitize SMS error messages to generic strings and log details server-side, matching the pattern in `api.ts`.

### [P3] postPipelineError stores raw error in database
**File:** `src/post-pipeline.ts:64`
**Issue:** `postPipelineError` stores `err.message` in the `error_message` database column and sends a truncated version via SMS. The `error_message` field is returned to the dashboard via `shapeLead()` (api.ts:56). This means internal error details (API keys in error messages, stack traces, internal URLs) could appear in the dashboard JSON response.
**Suggestion:** Not a blocker (dashboard is behind Basic Auth). Track as follow-up: consider sanitizing `error_message` before storage or before API serialization.

---

## Deployment Checklist: fix/batch-d-quick-wins

### Data Invariants

These changes are **code-only** (no database migrations, no data transformations). The invariants are behavioral:

- [ ] All existing leads remain accessible via `/api/leads`
- [ ] SMS approval flow (`/api/leads/:id/approve`) still works end-to-end
- [ ] Analyze pipeline (`/api/analyze`) still streams SSE events correctly
- [ ] Dashboard HTML renders correctly (no CSP-blocked resources)
- [ ] Google Fonts loads on dashboard and mockup pages
- [ ] Health check endpoint returns 200

---

### PRE-DEPLOY (Required)

#### 1. Verify staging/local build compiles

```bash
npx tsc --noEmit
```

**Expected:** No errors. Helmet types are included in `@types/express` scope.

#### 2. Verify Helmet is installed

```bash
ls node_modules/helmet/index.mjs
```

**Expected:** File exists. If not, run `npm install`.

#### 3. Record current response headers (baseline)

```bash
# Against the currently deployed Railway app
curl -sI https://<your-app>.up.railway.app/health | grep -iE "x-powered-by|content-security-policy|x-frame-options|strict-transport"
```

**Expected (before deploy):** No `Content-Security-Policy` header. Likely shows `X-Powered-By: Express`.

#### 4. Test dashboard locally

```bash
npx tsx src/server.ts
```

Then open `http://localhost:3000/dashboard.html` in both Chrome and Firefox:

- [ ] Page loads without console errors
- [ ] Google Fonts (Playfair Display) renders
- [ ] "Refresh" button works (click it, check no CSP errors in DevTools console)
- [ ] Analyze form works (submit a test lead, check SSE stream)

**This is the critical gate.** If `onclick` handlers are blocked by CSP, STOP deployment.

#### 5. Verify error sanitization locally

```bash
# Trigger an SMS error (with Twilio credentials missing or invalid)
curl -X POST http://localhost:3000/api/leads/1/approve \
  -H "Authorization: Basic $(echo -n 'user:pass' | base64)" \
  -H "Content-Type: application/json"
```

**Expected response body:**
```json
{"error": "SMS delivery failed"}
```

**Must NOT contain:** Twilio error details, API URLs, credentials, or stack traces.

---

### DEPLOY STEPS

| Step | Command | Runtime | Rollback |
|------|---------|---------|----------|
| 1. Push branch | `git push origin fix/batch-d-quick-wins` | < 30s | N/A |
| 2. Merge PR | Merge via GitHub | Instant | Revert merge commit |
| 3. Railway auto-deploy | Triggered by merge to main | ~2-3 min | Rollback to previous deployment in Railway dashboard |

**No database migration.** No data backfill. No feature flags. This is a pure code deploy.

---

### POST-DEPLOY (Within 5 Minutes)

#### 1. Health check

```bash
curl -s https://<your-app>.up.railway.app/health
```

**Expected:** `{"status":"ok"}`

If health check fails, Railway will auto-restart (up to 3 retries per `railway.json`). If all retries fail, the deployment fails and Railway keeps the previous version running.

#### 2. Verify security headers

```bash
curl -sI https://<your-app>.up.railway.app/health
```

**Expected new headers (all of these must appear):**

| Header | Expected Value |
|--------|---------------|
| `content-security-policy` | Contains `script-src 'self' 'unsafe-inline'` and `default-src 'self'` |
| `x-content-type-options` | `nosniff` |
| `x-frame-options` | `SAMEORIGIN` |
| `strict-transport-security` | `max-age=31536000; includeSubDomains` |
| `x-xss-protection` | `0` |
| `referrer-policy` | `no-referrer` |
| `cross-origin-opener-policy` | `same-origin` |

**Must NOT appear:** `X-Powered-By: Express` (Helmet removes it by default).

#### 3. Verify dashboard loads

- [ ] Open `https://<your-app>.up.railway.app/dashboard.html`
- [ ] Authenticate with Basic Auth credentials
- [ ] Check browser DevTools Console for CSP violation errors
- [ ] Verify Google Fonts (Playfair Display) is rendering
- [ ] Click "Refresh" button -- confirm it works (no silent CSP block)
- [ ] Open a lead detail -- confirm all data displays

#### 4. Verify error sanitization in production

Check Railway logs after deploy:

```bash
railway logs --tail 50
```

**Expected:** `console.error` messages appear in logs for any errors. No raw error messages in API responses.

#### 5. Verify SMS flow (if a test lead is available)

- [ ] Approve a test lead via dashboard
- [ ] If SMS fails, confirm the response says `"SMS delivery failed"` (not a raw error)
- [ ] Check Railway logs for the detailed error

---

### ROLLBACK PLAN

**Can we roll back?**
- [x] Yes -- pure code change, no data migration, no schema change.

**Rollback is safe because:**
- No database columns were added or removed
- No data was transformed or backfilled
- The only changes are middleware (Helmet) and error message formatting
- Rolling back simply removes security headers and restores verbose error messages

**Rollback Steps:**

| Step | Action | Time |
|------|--------|------|
| 1 | Railway Dashboard > Deployments > click previous deployment > "Rollback" | < 1 min |
| 2 | Verify `/health` returns 200 | < 30s |
| 3 | Verify `X-Powered-By: Express` is back (confirms old code is running) | < 30s |

**Alternative rollback (if Railway dashboard is unavailable):**

```bash
git revert <merge-commit-sha>
git push origin main
```

Railway auto-deploys from main, so the revert triggers a new deploy (~2-3 min).

---

### MONITORING (First 24 Hours)

| What to Watch | How to Check | Alert Condition |
|---------------|--------------|-----------------|
| Railway deploy status | Railway dashboard | Deploy failed or health check timeout |
| Application errors | `railway logs` | Any `console.error` entries not seen before |
| CSP violations | Browser DevTools Console on dashboard | Any `Refused to execute` or `Refused to load` messages |
| SMS delivery | Railway logs + phone | SMS approve flow returns 500 or SMS not received |
| Dashboard functionality | Manual check | Any button or feature not working |

**Check schedule:**
- [ ] +5 min: Run all post-deploy checks above
- [ ] +1 hour: Open dashboard, click through leads, verify no CSP issues
- [ ] +4 hours: Check Railway logs for any new error patterns
- [ ] +24 hours: Confirm no user-reported issues; close deployment

**Console verification (run in browser DevTools on dashboard page):**

```javascript
// Check for CSP violations (paste in Console)
document.addEventListener('securitypolicyviolation', (e) => {
  console.warn('CSP violation:', e.violatedDirective, e.blockedURI);
});
// Then click around the dashboard -- any violations will log here
```

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| CSP blocks inline `onclick` handlers | Low (Chrome/Firefox tolerate when `script-src` has `unsafe-inline`) | High (buttons silently stop working) | Pre-deploy local testing in Step 4 |
| Google Fonts blocked by CSP | Very Low (Helmet defaults allow `font-src https:` and `style-src https:`) | Medium (visual degradation, fallback fonts render) | Verified via actual Helmet output |
| Helmet import fails at startup | Very Low (TypeScript compiled, dependency in lockfile) | High (server won't start, Railway health check fails) | Railway auto-rollback after 3 failed health checks |
| Error sanitization hides debugging info | N/A (intentional) | Low (details still in Railway logs via `console.error`) | Verify logs contain detailed errors |

**Overall risk level: LOW.** This is a code-only deploy with no data changes. Railway's health check and auto-rollback provide a safety net.
