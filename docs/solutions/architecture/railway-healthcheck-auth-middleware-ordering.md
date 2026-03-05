# Railway Healthcheck: Auth Middleware Ordering

**Date:** 2026-03-04
**Category:** Architecture / Deployment
**Root Cause:** `/health` route registered after Express routers that apply `sessionAuth`
**Time to Fix:** ~90 minutes (6 deploy attempts)

## Problem

Lead Responder deployed to Railway but healthcheck failed on every attempt. The app started correctly — logs showed "Gig Lead Responder running at http://localhost:8080" — but Railway's healthcheck probe got "service unavailable" for all attempts, preventing the deploy from going active.

## Investigation Timeline (Trial and Error)

### Attempt 1: IPv6 binding (wrong)
**Hypothesis:** Railway routes healthcheck probes over IPv6, but Express defaults to IPv4.
**Fix tried:** Changed `app.listen(PORT)` to `app.listen(PORT, "::")`.
**Result:** Still failed. The app was already reachable — this wasn't the issue.
**Lesson:** Don't trust web search results as gospel. The IPv6 binding issue is real for some Railway users, but it wasn't our problem.

### Attempt 2: Increase healthcheck timeout (wrong)
**Hypothesis:** tsx cold start takes longer than 120s.
**Fix tried:** Bumped `healthcheckTimeout` from 120 to 300 in `railway.json`.
**Result:** Still failed. The app starts in ~3 seconds — timing was never the issue.
**Lesson:** The deploy logs showed the app starting at 20:10:18 and healthcheck #1 failing at 20:10:18 — same second. Should have noticed this immediately ruled out cold start.

### Attempt 3: Remove healthcheck entirely (diagnostic breakthrough)
**Hypothesis:** Let the deploy succeed without healthcheck to see if the app is reachable at all.
**Fix tried:** Removed `healthcheckPath` and `healthcheckTimeout` from `railway.json`.
**Result:** Deploy succeeded! Curl to `/health` returned **HTTP 401** — not 200.
**Lesson:** This was the key diagnostic. The app was running and reachable, but returning 401 (unauthorized) to the healthcheck probe. The problem was auth, not networking.

### Attempt 4: Move /health before routers (correct fix, bad cherry-pick)
**Hypothesis:** `sessionAuth` in `apiRouter` blocks `/health`.
**Fix tried:** Moved `/health` before all `app.use(router)` calls.
**Result:** Deploy crashed — `Cannot find package 'cookie-parser'`.
**Lesson:** When cherry-picking a file from a feature branch to main, you get ALL the feature branch changes to that file, not just your edit. The cherry-picked `server.ts` imported `cookie-parser` and `follow-up-api` which don't exist on main.

### Attempt 5: Add missing cookie-parser dependency (incomplete)
**Hypothesis:** Just need to add the missing package.
**Fix tried:** `npm install cookie-parser` on main.
**Result:** Deploy crashed — `Cannot find module '/app/src/follow-up-api.js'`.
**Lesson:** Fixing one missing import reveals the next. The real fix is to not cherry-pick the whole file.

### Attempt 6: Revert server.ts to main-compatible + apply minimal fixes (correct)
**Hypothesis:** Restore the clean main server.ts, apply only 2 line changes.
**Fix tried:** Restored `server.ts` from pre-cherry-pick commit (`8d8c6dc`), then added `/health` before routers and `::` binding.
**Result:** Deploy succeeded. Healthcheck passed. App online.

## Root Cause

Express routers mounted with `app.use(router)` (no path prefix) run their middleware on **all incoming requests**, not just routes defined in that router. When `apiRouter` has `router.use(sessionAuth)`, the middleware runs for every request entering the router — including requests destined for `/health` defined later on the main app.

```
Request → /health
  → express.static (no match, pass through)
  → webhookRouter (no match, but middleware runs... passes through)
  → apiRouter → router.use(sessionAuth) → 401 STOP ← never reaches /health
```

The fix: register `/health` **before** any router that applies auth middleware.

```
Request → /health
  → app.get("/health") → 200 {"status":"ok"} ← responds immediately
```

## Contributing Factors

| Factor | Impact | How Discovered |
|--------|--------|----------------|
| "Wait for CI" enabled, no GitHub Actions | Blocked first deploy | Dashboard inspection |
| Cherry-picking whole file from feature branch | Brought incompatible imports | Deploy crash logs |
| Stale package-lock.json on main | `npm ci` didn't install cherry-picked deps | Deploy crash logs |
| IPv6 binding (red herring) | No impact — app was reachable | Removing healthcheck proved networking worked |
| Healthcheck timeout (red herring) | No impact — app starts in 3s | Deploy logs showed same-second failure |

## Prevention

1. **Always register healthcheck routes before auth middleware.** This is an Express ordering rule, not a Railway-specific issue.
2. **Never cherry-pick entire files across branches with different dependency sets.** Instead, make the minimal edit directly on the target branch.
3. **When debugging deploy failures, remove the healthcheck first** to isolate whether the problem is the app or the probe. A 401/403 from a health endpoint is immediately diagnostic.
4. **Read deploy logs before theorizing.** The same-second failure (app starts at X, healthcheck fails at X) ruled out cold start instantly — we should have caught that before trying timeout fixes.

## Key Files

- `src/server.ts` — `/health` route position (line 37 on main)
- `railway.json` — healthcheck config
- `src/api.ts:11` — `router.use(sessionAuth)` that blocks unauthenticated requests
- `src/auth.ts:114` — `sessionAuth` function that returns 401

## Risk Resolution

**Flagged risk (from previous session):** "The Lead Responder deploy blocker. The app code is fine — it starts and logs correctly. Something at the Railway platform level is blocking the healthcheck."

**What actually happened:** It wasn't a platform issue at all. The app's own auth middleware was returning 401 to Railway's healthcheck probe. The "platform-level" framing led us to try IPv6 and timeout fixes first, wasting ~45 minutes.

**Lesson learned:** When an app starts fine but healthcheck fails, test the healthcheck endpoint manually (remove healthcheck, curl it) before assuming platform issues. The HTTP status code tells you everything.
