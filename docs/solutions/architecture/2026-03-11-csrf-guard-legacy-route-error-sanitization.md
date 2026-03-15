---
title: "Security Follow-up: CSRF Hardening, Error Sanitization, Legacy Route Retirement, and CLI Diagnostics"
date: "2026-03-12"
category: security-issues
problem_type: security_issue
components:
  - src/auth.ts
  - src/app.ts
  - src/claude.ts
  - src/api.ts
  - src/index.ts
  - src/utils/cli-error.ts
symptoms:
  - CSRF guard could be bypassed on authenticated POSTs via Basic Auth alone (no X-Requested-With required)
  - Internal error details (stack traces, provider messages) leaked to API and CLI callers
  - Legacy entry points (/ and /index.html) served stale UI instead of redirecting to dashboard
  - CLI --verbose flag lost actionable diagnostics after error output was generified
  - Stale API documentation showed POST examples missing required X-Requested-With header
root_cause: "CSRF bypass and information disclosure introduced by incomplete hardening — auth middleware allowed Basic Auth to skip the CSRF header check, and error handlers propagated raw internal messages to callers"
severity: P1-P2
status: resolved
tags:
  - csrf
  - information-disclosure
  - error-sanitization
  - legacy-routes
  - cli-diagnostics
  - express
  - typescript
  - security-hardening
feed_forward_risk: "Any external script or curl flow that posts with Basic Auth but without X-Requested-With: dashboard will now get a 403 and needs that header added explicitly."
risk_resolution: "Accepted as a rollout risk rather than a code bug — dashboard client already sends the header on all POST requests; the stricter CSRF rule is internally consistent. No external Basic Auth POST clients were available to verify locally, so this remains an open deployment verification item."
---

## Prior Phase Risk

> "Any external script or `curl` flow that posts with Basic Auth but without
> `X-Requested-With: dashboard` will now get a 403 and needs that header added
> explicitly."

Accepted as a rollout risk, not a code bug. The dashboard client already sends
the header. One stale doc example was found and fixed. External scripts outside
this repo remain unverifiable from local inspection.

## Problem

Four related security gaps existed in the gig-lead-responder Express API:

1. **CSRF bypass via Basic Auth header.** The `csrfGuard` middleware contained
   a branch that skipped the CSRF token check entirely whenever the request
   carried an `Authorization: Basic ...` header. Any script that knew the Basic
   Auth credentials could forge state-changing POST requests without the
   `X-Requested-With: dashboard` header, defeating the entire CSRF defence.

2. **Legacy routes still served static files.** The root path `/` redirected
   to `/dashboard.html`, but `/index.html` did not. Both paths were reachable
   through the `express.static` middleware, meaning the retired analyzer entry
   point remained accessible.

3. **Internal error details leaked to clients and logs.** When Claude returned
   non-JSON, the retry error message included raw model response content.
   SMS and pipeline errors were logged with `err` or `err.message` directly.
   The CLI path printed verbose stack traces even without `--verbose`.

4. **Stale deployment doc omitted the required CSRF header.** A curl `POST`
   example in `docs/reviews/feat-lead-conversion-tracking/batch3-deployment.md`
   was missing `-H "X-Requested-With: dashboard"`.

## Investigation

Reviewed `src/auth.ts` (CSRF and session middleware), `src/app.ts` (route
registration order), `src/api.ts` (SMS and pipeline error handlers),
`src/claude.ts` (JSON parse/retry failure path), `src/index.ts` (CLI catch
block), and deployment docs for stale POST examples.

The CSRF bypass was found by reading `csrfGuard`: the comment said "not
auto-attached by browsers" but the guard accepted any request carrying Basic
Auth, including programmatic attacks. The information-leakage issues were
found by tracing every `catch` block that referenced `err` directly.

## Root Cause

The CSRF bypass was introduced as a convenience for curl-based local testing
("Basic Auth isn't auto-sent by browsers, so it's safe to skip"). The
reasoning conflated "cannot be sent by a passive cross-site form" with "cannot
be sent by an attacker." Any script with credentials — XSS payload, malicious
browser extension, server-side SSRF — can attach a `Basic` header.

The error leakage was a first-draft pattern: log the full error for debugging
convenience, never revisited when hardening for production.

The legacy `/index.html` route gap was an oversight: only `/` was converted to
a redirect; `/index.html` was left to `express.static`.

## Solution

### Fix 1 — Remove Basic Auth bypass from csrfGuard

The bypass block was deleted. The guard now checks `X-Requested-With: dashboard`
unconditionally for all POST/PUT/DELETE requests.

```typescript
// src/auth.ts — bypass block removed; guard is now unconditional
export function csrfGuard(req: Request, res: Response, next: NextFunction): void {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
    next();
    return;
  }
  if (req.headers["x-requested-with"] === "dashboard") {
    next();
    return;
  }
  res.status(403).json({ error: "CSRF check failed — missing X-Requested-With header" });
}
```

### Fix 2 — Retire `/index.html` with a redirect before static serving

```typescript
// src/app.ts — registered BEFORE express.static
app.get(["/", "/index.html"], (_req, res) => {
  res.redirect("/dashboard.html");
});

app.use(express.static(join(import.meta.dirname, "..", "public"), { maxAge: "1h" }));
```

Order is critical: the redirect must be registered before `express.static`,
otherwise the static middleware serves `index.html` first.

### Fix 3 — Sanitize error output; restore details under --verbose

**claude.ts — generic message, no raw content:**
```typescript
throw new Error("Failed to parse Claude JSON response after retry.");
```

**api.ts — fixed-string logs, void the error object:**
```typescript
void err;
console.error("SMS delivery failed");
```

**CLI — new `src/utils/cli-error.ts`:**
```typescript
export function logCliPipelineError(
  err: unknown,
  verbose: boolean,
  logger: ErrorLogger = console.error,
): void {
  if (!verbose) {
    logger("Pipeline error");
    return;
  }
  if (err instanceof Error) {
    logger(`Pipeline error: ${err.message}`);
    if (err.stack) logger(err.stack);
    return;
  }
  logger(`Pipeline error: ${String(err)}`);
}
```

### Fix 4 — Add missing header to stale curl example

```diff
 curl -s -X POST -u "$DASHBOARD_USER:$DASHBOARD_PASS" \
   -H "Content-Type: application/json" \
+  -H "X-Requested-With: dashboard" \
   -d '{"outcome":"invalid"}' \
   https://YOUR-APP.railway.app/api/leads/1/outcome
```

## Verification

- **75 automated tests, 0 failures** — new tests in `src/auth.test.ts` assert
  that POST with Basic Auth and no `X-Requested-With` returns 403.
- **Codex-first review** — Codex reviewed independently, Claude Code applied
  findings (CLI `--verbose` regression), then ran second review pass.
- **TypeScript compiler passes clean** — `void err` pattern satisfies the
  unused-variable linter.

## Prevention Strategies

### CSRF bypass prevention

- CSRF guards must apply unconditionally to all state-changing methods
  regardless of authentication method. Authentication proves identity; CSRF
  proves intent. They are orthogonal.
- **Trigger rule:** If you add a new authentication method (API key, OAuth,
  anything), open `src/auth.ts` `csrfGuard` and confirm it still fires.
- Every POST client (curl scripts, integrations, README examples) must include
  `X-Requested-With: dashboard`.

### Route retirement

- When a UI entry point is renamed or replaced, retiring the old route is part
  of the same commit. Not a separate cleanup task.
- **Trigger rule:** Any time you rename a public-facing HTML file, audit all
  routes in `src/app.ts` for the old filename before closing the PR.

### Error disclosure

- **Server surface:** Error detail never leaves the process boundary. Send
  only user-safe messages to clients.
- **CLI surface:** Generic by default, detailed on `--verbose`. Use
  `logCliPipelineError` from `src/utils/cli-error.ts` for all CLI fatal paths.
- **Test:** "If an attacker crafts input that triggers this error, what do
  they learn from the response?" If the answer is more specific than "something
  went wrong," the error is over-disclosed.
- **Trigger rule:** Any `catch` block that touches `err.message`, `err.stack`,
  or `String(err)` in a network-facing path is a mandatory review stop.

### Surface inventory before hardening

- Before any error-output sanitization pass, explicitly list the surfaces:
  HTTP responses (public), SSE streams (public), server-side logs (internal),
  CLI default output (local), CLI `--verbose` output (local+explicit). Apply
  different rules to each.

## Security Review Checklist

**CSRF coverage**
- [ ] Every POST/PUT/DELETE route has `csrfGuard` in its middleware chain
- [ ] No new auth methods bypass `csrfGuard` in `src/auth.ts`
- [ ] External POST clients include `X-Requested-With: dashboard`
- [ ] Webhook routes are intentionally exempt (signature verification instead)

**Route hygiene**
- [ ] No route serves raw HTML from a non-canonical path — old paths redirect
- [ ] Static file middleware does not expose files that should require auth

**Error disclosure**
- [ ] No `catch` block sends `err.message`/`err.stack` in an HTTP response
- [ ] SSE error events send only user-safe strings
- [ ] `logCliPipelineError` is used for all CLI fatal error paths
- [ ] `error_message` fields stored in the DB and returned via API contain only operator-safe strings (not raw provider error messages)

**Operator diagnostics**
- [ ] `--verbose` flag threaded from CLI args to `logCliPipelineError`
- [ ] Running with `--verbose` produces actionable, class-distinguishable output
- [ ] Running without `--verbose` produces only `"Pipeline error"`

## Residual Risks

1. **External Basic Auth POST clients — unverified (MEDIUM).** Any deployed
   automation that POSTs with Basic Auth but without `X-Requested-With` will
   break on next deploy. Requires live inventory before deployment.

2. **Production log usefulness after genericization — unverified (LOW-MEDIUM).**
   Server-side logs now log less detail. Operational documentation gap, not
   code gap.

3. **Browser-based CSRF not empirically tested (LOW).** Defense verified by
   code inspection and server tests, not a browser-based exercise.

4. **`--verbose` only reachable via CLI (LOW).** No runtime override for
   Railway instances without redeploying with a flag change.

5. **`post-pipeline.ts` writes raw `err.message` to DB and SMS (MEDIUM).**
   `post-pipeline.ts` stores `err.message` in the `error_message` DB column,
   which surfaces in `/api/leads` responses (authenticated only) and in SMS
   alerts (truncated to 100 chars). Provider-specific error strings from
   Claude or Twilio could leak to SMS recipients. Not a public surface, but
   a different threat model than the HTTP response path.

6. **`venue-lookup.ts` indirect `err.message` propagation (LOW).**
   Unknown errors write `err.message` to a `reason` field on the return value.
   Currently internal-only, but a caller that propagates the reason to an HTTP
   response would create a disclosure path.

## Related Documentation

- `docs/solutions/architecture/review-fix-cycle-4-hardening-and-cleanup.md` —
  Pattern 2: "State-changing operations must never be GET" (CSRF guard origin)
- `docs/solutions/architecture/2026-03-10-global-express-error-middleware.md` —
  `err.expose` gated error sanitization (direct predecessor)
- `docs/solutions/architecture/review-fix-cycle-12-full-codebase-hardening.md` —
  Pattern 4: auth middleware on all user-facing routes
- `docs/solutions/architecture/environment-aware-fatal-guards.md` —
  fail-closed/fail-open by environment (predecessor to `--verbose` pattern)
- `docs/solutions/architecture/2026-03-10-createapp-factory-and-404-catchall.md` —
  404 catch-all for unmatched legacy routes
- `docs/reviews/2026-03-12-security-follow-up/REVIEW-SUMMARY.md` —
  Direct review for this work (P2 CLI finding, fixed in-session)
- `docs/reviews/feat-follow-up-v2-dashboard/batch3-deployment.md` —
  First identified the Basic Auth bypass gap

## Risk Resolution

**Flagged risk:** "Any external script or `curl` flow that posts with Basic
Auth but without `X-Requested-With: dashboard` will now get a 403."

**What actually happened:** Code is correct — `csrfGuard` fires unconditionally.
Dashboard client already sends the header. One stale doc example was found and
fixed. No external clients were available to test locally.

**Lesson learned:** When tightening an auth boundary, audit all POST clients
(code, docs, curl examples, integrations) in the same commit. The stale doc
was found only because rollout validation was done as a separate deliberate
step. Make the client audit part of the CSRF-change checklist, not an
afterthought.

## Three Questions

1. **Hardest pattern to extract from the fixes?** The "surface inventory before
   hardening" pattern. The CLI `--verbose` regression happened because error
   sanitization was applied uniformly without classifying surfaces first. The
   pattern generalizes beyond this fix: any security hardening that touches
   output must start by listing all output surfaces and their threat models.

2. **What did you consider documenting but left out, and why?** The specific
   `void err` TypeScript pattern used to silence the unused-variable linter.
   It's a language idiom, not an architectural decision — documenting it would
   add noise without compounding value.

3. **What might future sessions miss that this solution doesn't cover?** The
   residual risk of production log detail being insufficient during incidents.
   This doc flags it as a residual risk but doesn't prescribe a fix because
   it's an operational concern (log verbosity policy) rather than a code
   pattern. A future incident where `"Pipeline error"` in Railway logs is
   insufficient to diagnose a provider outage would be the signal to revisit.
