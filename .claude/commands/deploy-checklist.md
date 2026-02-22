---
name: deploy-checklist
description: Railway deploy verification — run through all checks before and after deploy
argument-hint: "[pre | post | full]"
---

# Deploy Checklist

<command_purpose>Step-by-step Railway deployment verification. Runs pre-deploy checks locally, then guides through post-deploy verification on the live server.</command_purpose>

## Parse the Argument

The argument is: `$ARGUMENTS`

- **`pre`** — Run local checks only (before deploying)
- **`post`** — Run live server checks only (after deploying)
- **`full`** or no argument — Run both in sequence

## Pre-Deploy Checks

Run these checks locally and report pass/fail:

### 1. TypeScript compiles
```bash
npx tsc --noEmit
```
Pass if only the pre-existing `import.meta.dirname` type issue appears.

### 2. No secrets in code
```bash
grep -r "sk-ant-\|ANTHROPIC_API_KEY=sk" src/ --include="*.ts"
```
Pass if no matches. Fail if any API keys found in source.

### 3. Environment variables documented
Read `.env.example`. Verify every variable used in `src/` has a corresponding entry. Check with:
```bash
grep -roh 'process\.env\.\w\+' src/ --include="*.ts" | sort -u
```
Compare against `.env.example` keys. Flag any missing.

### 4. Dependencies correct
Verify `tsx` is in `dependencies` (not `devDependencies`) — Railway needs it at runtime.
```bash
node -e "const p=require('./package.json'); console.log('tsx in deps:', !!p.dependencies?.tsx)"
```

### 5. Railway config exists
Read `railway.json`. Verify it has:
- `build.builder: "NIXPACKS"`
- `deploy.startCommand` pointing to `src/server.ts`
- `deploy.healthcheckPath: "/health"`

### Pre-Deploy Summary

```
Pre-Deploy Checklist
| # | Check | Status |
|---|-------|--------|
| 1 | TypeScript compiles | PASS/FAIL |
| 2 | No secrets in code | PASS/FAIL |
| 3 | Env vars documented | PASS/FAIL |
| 4 | tsx in dependencies | PASS/FAIL |
| 5 | Railway config valid | PASS/FAIL |
```

If all pass: "Ready to deploy. Push to main and Railway will auto-deploy."
If any fail: List what needs fixing before deploy.

## Post-Deploy Checks

These require the live Railway URL. Ask the user for it if not known.

### 1. Health check
```bash
curl -s https://<railway-url>/health
```
Pass if returns `{"status":"ok"}`.

### 2. Dashboard loads
```bash
curl -s -o /dev/null -w "%{http_code}" https://<railway-url>/leads
```
Pass if returns 401 (auth required) or 200.

### 3. Webhook endpoints exist
```bash
curl -s -o /dev/null -w "%{http_code}" -X POST https://<railway-url>/webhook/mailgun
curl -s -o /dev/null -w "%{http_code}" -X POST https://<railway-url>/webhook/twilio
```
Pass if returns 400 or 401 (not 404).

### 4. Environment variables set
Ask user to confirm in Railway dashboard:
- [ ] `ANTHROPIC_API_KEY` — set
- [ ] `MAILGUN_WEBHOOK_KEY` — set (webhook signing key, NOT API key)
- [ ] `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` + `TWILIO_FROM_NUMBER` — set
- [ ] `ALEX_PHONE` — set
- [ ] `BASE_URL` — matches Railway public URL exactly (no trailing slash)
- [ ] `DASHBOARD_USER` + `DASHBOARD_PASS` — set
- [ ] `DISABLE_MAILGUN_VALIDATION` — `false` (or `true` for first deploy debugging)
- [ ] `DISABLE_TWILIO_VALIDATION` — `false` (or `true` for first deploy debugging)

### 5. Volume mounted
Ask user to confirm: "Is a Railway volume mounted at the path where `leads.db` is created?"

### Post-Deploy Summary

```
Post-Deploy Checklist
| # | Check | Status |
|---|-------|--------|
| 1 | Health check | PASS/FAIL |
| 2 | Dashboard loads | PASS/FAIL |
| 3 | Webhooks exist | PASS/FAIL |
| 4 | Env vars set | PASS/FAIL |
| 5 | Volume mounted | PASS/FAIL |
```

## After Full Check

If all checks pass:
```
Deploy verified! Next steps:
1. Send a test email to your Mailgun inbound address
2. Check Railway logs for pipeline activity
3. Wait for SMS with the draft
4. Reply YES to approve, or send edit instructions

See docs/e2e-test.md for the full 9-test manual checklist.
```

## Important Rules

1. **Never deploy for the user.** This skill checks readiness — the user pushes to deploy.
2. **Don't skip post-deploy env var verification.** Wrong `MAILGUN_WEBHOOK_KEY` is the #1 deploy failure (API key vs webhook signing key confusion).
3. **Flag `BASE_URL` mismatches.** If it doesn't match the Railway URL exactly, Twilio signature validation will silently reject all inbound SMS.
