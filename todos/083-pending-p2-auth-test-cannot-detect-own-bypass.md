---
status: pending
priority: p2
issue_id: "083"
tags: [code-review, testing, auth, ambiguous-output]
dependencies: []
unblocks: []
sub_priority: 1
---

# 083: The dashboard auth test cannot detect its own bypass

## Problem Statement

`src/error-middleware.test.ts:155-156` asserts that `GET /dashboard.html`
returns `200`, and treats that as evidence the authenticated route is wired up
correctly:

```js
const dashboardRes = await request(srv, "GET", "/dashboard.html");
assert.equal(dashboardRes.status, 200);
```

But the test process runs with `DASHBOARD_USER` and `DASHBOARD_PASS` unset. That
takes the dev bypass at `src/auth.ts:118-126`:

```js
// Dev bypass when creds aren't set
if (!user || !pass) {
  if (process.env.NODE_ENV === "production" || process.env.RAILWAY_ENVIRONMENT) {
    res.status(500).json({ error: "Server misconfigured — auth credentials missing" });
    return;
  }
  console.warn("WARNING: Auth disabled — DASHBOARD_USER/DASHBOARD_PASS not set");
  next();
  return;
}
```

So the `200` is produced by `next()` on the **auth-disabled** path, not by a
successful authentication.

**"Auth passed" and "auth was disabled" produce byte-identical output.** The
assertion cannot distinguish them, and it passes either way. If `sessionAuth`
were deleted from that route tomorrow, this test would still be green.

**Found by:** review of the 2026-08-07 security session (see HANDOFF.md, Three
Questions, "least confident" answer).

## Not a live hole

`src/server.ts:18-21` hard-fails at startup in production when those vars are
missing, and the bypass branch above explicitly returns `500` when
`NODE_ENV === "production"` or `RAILWAY_ENVIRONMENT` is set. Production
`/dashboard.html` was verified returning `401` on 2026-08-07 and again on
2026-08-08 after the PR #23 deploy.

The defect is in the **test's ability to detect a regression**, not in the
running system. That is why this is p2 and not p1: nothing is currently
exposed, but the guard that would catch a future exposure is blind.

## Why it matters beyond this one test

This is the ambiguous-output failure class: a check whose pass and whose
non-execution are indistinguishable. The same shape already cost time on this
repo — `mockup-hybrid.html` was served unauthenticated in production for an
unknown period, and the fix's verification only became interpretable once a
**control** (`/no-such-file.html`, expected `401`) was added to prove the `200`
was a real static serve rather than a blanket allow.

## Proposed fix

Set the credentials in the test and assert both directions, so a pass means
auth ran and succeeded:

1. In the test setup, set `DASHBOARD_USER` / `DASHBOARD_PASS` /
   `COOKIE_SECRET` (see `src/auth.test.ts:6-8` for the existing pattern in
   this repo) and restore them afterwards.
2. Assert `GET /dashboard.html` **without** credentials returns `401` — the
   negative control that proves the route is actually guarded.
3. Assert `GET /dashboard.html` **with** valid credentials returns `200`.
4. Optionally assert the bypass warning is NOT emitted, so a future refactor
   that silently re-enables the dev path fails the test.

## Acceptance criteria

- WHEN the dashboard auth test runs with `DASHBOARD_USER`/`DASHBOARD_PASS`
  unset, THE SYSTEM SHALL assert a `401`, not a `200`.
- WHEN `sessionAuth` is removed from the `/dashboard.html` route, THE SYSTEM
  SHALL fail at least one test. Verify this by actually deleting the middleware
  locally and confirming a red run before committing the fix — a test claimed
  to catch a regression, but never shown to, is the same defect being fixed
  here.
