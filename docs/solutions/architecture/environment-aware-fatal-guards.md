---
title: "Environment-Aware Fatal Guards"
category: architecture
tags: [auth, env-vars, production, fail-closed, security, railway]
module: auth
symptoms:
  - Auth middleware silently skipped when env vars missing
  - Production deploy accidentally runs without authentication
  - Developer friction from requiring auth credentials for local development
  - Missing config only discovered when a user reports unauthorized access
date_documented: 2026-02-22
---

# Environment-Aware Fatal Guards

## Problem

The Basic Auth middleware checked for `DASHBOARD_USER` and `DASHBOARD_PASS`
env vars. When both were missing, it called `next()` — skipping auth entirely.
This was a deliberate convenience for local development (no dummy creds needed),
but it meant a production deployment that lost its env vars would silently serve
the entire dashboard and all API endpoints without authentication.

## Root Cause

The auth middleware treated "no credentials configured" the same in all
environments. A single code path handled both "developer on localhost who
doesn't want to type a password" and "production server that forgot its
secrets." The convenience path was the unsafe path.

## Solution

Branch on environment — fail-closed in production, fail-open in development:

```ts
// src/auth.ts
const user = process.env.DASHBOARD_USER;
const pass = process.env.DASHBOARD_PASS;

if (!user || !pass) {
  if (process.env.NODE_ENV === "production" || process.env.RAILWAY_ENVIRONMENT) {
    console.error("FATAL: DASHBOARD_USER and DASHBOARD_PASS must be set in production");
    process.exit(1);
  }
  console.warn("WARNING: Auth disabled — DASHBOARD_USER/DASHBOARD_PASS not set");
  next();
  return;
}
```

### How it works by environment

| Environment | Missing auth vars? | Behavior |
|-------------|-------------------|----------|
| Production (Railway) | Yes | `process.exit(1)` — deploy fails visibly |
| Production (Railway) | No | Normal auth enforcement |
| Development | Yes | Auth skipped, console warning on each request |
| Development | No | Normal auth enforcement |

### Key design decisions

1. **`process.exit(1)` not `throw`** — A server without auth should not serve
   ANY requests in production, including health checks. Railway sees the exit
   as a deploy failure and surfaces it in the dashboard. A thrown error would
   only crash the middleware, potentially leaving other routes accessible.

2. **Check `RAILWAY_ENVIRONMENT` in addition to `NODE_ENV`** — Railway sets
   `RAILWAY_ENVIRONMENT` automatically. Checking both means the guard works
   even if the deploy config doesn't explicitly set `NODE_ENV=production`.

3. **Warning, not silence, in dev** — `console.warn` on every request makes
   it obvious that auth is skipped. Developers know they're in an unprotected
   state, and the warning shows up in logs if someone accidentally runs the
   dev config against a public URL.

4. **Matches the existing `ANTHROPIC_API_KEY` pattern** — `server.ts:11-13`
   already does `process.exit(1)` on missing API key. Using the same pattern
   for auth credentials keeps the codebase consistent.

## What Was Rejected

- **`throw` instead of `process.exit(1)`** — Would allow health checks to
  still pass, but a server without auth shouldn't be reported as healthy.
  The exit makes the failure visible in Railway's deploy dashboard immediately.
- **Logging the warning only once (static flag)** — The per-request warning is
  slightly noisy but costs nothing in dev and ensures the warning is visible
  even if the developer missed the startup log. Not worth the complexity of
  a static flag for a dev-only message.
- **`NODE_ENV` only** — Some platforms don't set `NODE_ENV`. Railway's
  `RAILWAY_ENVIRONMENT` is a reliable signal that you're in a hosted environment
  even if `NODE_ENV` wasn't configured.

## Prevention

- **Every "skip-if-missing" convenience must have an environment gate.** If a
  feature is skipped when config is missing, ask: "What happens if config is
  missing in production?" If the answer is "bad," add an environment check.
- **Fail-closed is the default.** Start with `process.exit(1)` on missing
  critical config. Only add the dev convenience path after confirming the
  production guard works.
- **Use platform-specific env vars as detection signals.** `RAILWAY_ENVIRONMENT`,
  `FLY_APP_NAME`, `HEROKU_APP_NAME`, `AWS_LAMBDA_FUNCTION_NAME` — these are
  set automatically and reliably indicate a hosted environment.

## Related

- `docs/solutions/architecture/silent-failure-escape-hatches.md` — related pattern for `DISABLE_*_VALIDATION` env vars (same environment-awareness principle, different use case)
