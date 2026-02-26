# Deployment Verification Agent — Review Findings

**Agent:** deployment-verification-agent
**Branch:** fix/batch-d-quick-wins
**Date:** 2026-02-25
**Files reviewed:** 4 (`package.json`, `package-lock.json`, `src/server.ts`, `src/api.ts`)
**Deployment platform:** Railway (Nixpacks build, `npx tsx src/server.ts`)

## Summary of Changes

Three commits, all security-hardening:

1. **`d821f2e` — Helmet middleware** adds `helmet@8.1.0` with CSP override (`scriptSrc: ['self', 'unsafe-inline']`). Sets 12+ security headers on every response.
2. **`7cdfb0e` — Sanitize SMS error responses** replaces raw `err.message` in `/api/leads/:id/approve` with generic `"SMS delivery failed"`. Logs real error server-side.
3. **`94a4552` — Sanitize analyze error responses** same pattern for `/api/analyze` SSE error events.

## Findings

### [P2] Helmet CSP `script-src-attr 'none'` may block inline event handlers
**File:** `src/server.ts:22-30` and `public/dashboard.html:941`, `public/index.html:149`
**Issue:** Helmet v8 default CSP includes `script-src-attr 'none'`, which blocks inline event handler attributes like `onclick="..."`. The dashboard uses `onclick="loadStats(); loadLeads();"` (dashboard.html:941) and `onclick="analyze()"` (index.html:149). While Chrome currently only warns (does not block) for `script-src-attr` when `script-src` includes `'unsafe-inline'`, Firefox and future browser versions may enforce this strictly. If enforced, clicking Refresh and Analyze buttons would silently fail.
**Suggestion:** Test both buttons in the deployed environment across Chrome and Firefox. If blocked, add `scriptSrcAttr: ["'unsafe-inline'"]` to the Helmet config, or migrate `onclick` attributes to `addEventListener` calls. This is a **Go/No-Go verification item**.

---

### [P3] Error messages still leaked via SMS in twilio-webhook.ts
**File:** `src/twilio-webhook.ts:197,210,219`
**Issue:** The branch sanitized error responses in `api.ts` (HTTP endpoints), but `twilio-webhook.ts` still sends raw `err.message` content via SMS to the user's phone. Lower-severity because SMS goes to the app owner, but inconsistent with the sanitization pattern.
**Suggestion:** Not a deploy blocker. Track as follow-up.

---

### [P3] postPipelineError stores raw error in database
**File:** `src/post-pipeline.ts:64`
**Issue:** `postPipelineError` stores `err.message` in the `error_message` DB column, which is returned to the dashboard via `shapeLead()` (api.ts:56). Internal error details could appear in the dashboard JSON response.
**Suggestion:** Not a deploy blocker (dashboard is behind Basic Auth). Track as follow-up.

---

## Deployment Checklist

### PRE-DEPLOY (Required)

- [ ] **Build compiles:** `npx tsc --noEmit` — no errors
- [ ] **Helmet installed:** `node_modules/helmet/index.mjs` exists
- [ ] **Baseline headers recorded:** `curl -sI` against current prod, save output
- [ ] **Local dashboard test (Chrome):** page loads, Refresh button works, Analyze works, no CSP console errors
- [ ] **Local dashboard test (Firefox):** same checks — this is the critical gate for the `script-src-attr` finding
- [ ] **Error sanitization verified:** POST to `/api/leads/1/approve` with bad credentials returns `{"error":"SMS delivery failed"}`, not raw error details

### DEPLOY STEPS

| Step | Action | Runtime | Rollback |
|------|--------|---------|----------|
| 1 | Push branch, merge PR | < 1 min | Revert merge commit |
| 2 | Railway auto-deploys from main | ~2-3 min | Railway dashboard rollback |

No database migration. No data backfill. No feature flags.

### POST-DEPLOY (Within 5 Minutes)

- [ ] **Health check:** `curl -s https://<app>.up.railway.app/health` returns `{"status":"ok"}`
- [ ] **Security headers present:** `content-security-policy`, `x-content-type-options: nosniff`, `strict-transport-security`, `referrer-policy: no-referrer` all appear. `X-Powered-By` must NOT appear.
- [ ] **Dashboard loads:** no CSP violations in DevTools console
- [ ] **Google Fonts renders:** Playfair Display visible on dashboard
- [ ] **Refresh button works:** click it, data reloads
- [ ] **Error sanitization in prod:** check that any 500 responses contain only generic messages
- [ ] **Railway logs:** `console.error` messages appear with full details for any errors

### ROLLBACK (If Needed)

**Can we roll back?** Yes — pure code change, zero data impact.

| Step | Action | Time |
|------|--------|------|
| 1 | Railway Dashboard > Deployments > previous deployment > "Rollback" | < 1 min |
| 2 | Verify `/health` returns 200 | < 30s |
| 3 | Verify `X-Powered-By: Express` header is back (confirms old code) | < 30s |

### MONITORING (24 Hours)

| What to Watch | How | Alert If |
|---------------|-----|----------|
| Deploy status | Railway dashboard | Failed or health check timeout |
| CSP violations | Browser DevTools on dashboard | Any `Refused to execute/load` messages |
| Application errors | `railway logs` | New `console.error` patterns |
| SMS flow | Railway logs + phone | Approve returns 500 or SMS not received |

**Check at:** +5 min, +1 hour, +4 hours, +24 hours.

---

**Overall risk: LOW.** Code-only deploy, no data changes. Railway health checks provide automatic rollback safety net. The one item to watch is the P2 `script-src-attr` finding — verify `onclick` handlers work in the browser before merging.
