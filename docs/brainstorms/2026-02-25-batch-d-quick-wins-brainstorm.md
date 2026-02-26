# Batch D Quick Wins — Brainstorm

**Date:** 2026-02-25
**Origin:** `docs/fixes/feat-lead-conversion-tracking/plan.md` (Batch D — Deferred)
**Scope:** 3 items from the 15 deferred review findings

## What We're Building

Three quick security/quality fixes from the lead conversion tracking review
that don't require design decisions or new architecture:

1. **Security headers via Helmet** — Add `helmet` middleware to server.ts for
   CSP, X-Frame-Options, X-Content-Type-Options, and HSTS. One `npm install`,
   one line of code.

2. **SMS error sanitization** — Replace raw `err.message` (which may contain
   Twilio account SIDs) with a generic "SMS delivery failed" message in the
   API response. Log the real error server-side with `console.error`.

3. **Analyze endpoint error sanitization** — Same pattern for the `/api/analyze`
   SSE error event. Replace raw Anthropic SDK errors with a generic message.
   Log the real error server-side.

## What We're NOT Building

- **CSRF protection** — Dropped. Basic Auth uses the `Authorization` header,
  not cookies. Browsers don't auto-attach it on cross-origin requests, so CSRF
  is not a realistic attack vector for this auth pattern.
- **Pipeline error_message sanitization** — Keeping raw errors visible in the
  dashboard's `error_message` field. The dashboard is behind Basic Auth and
  Alejandro is the only user — seeing "Anthropic API rate limit exceeded" is
  more useful than checking Railway logs.
- **All other Batch D items** (rate limiting, caching, SELECT *, RETURNING,
  json_extract denorm, auth overhaul, dashboard split) — deferred to future
  features.

## Why This Approach

These three items share a profile: no design decisions, no new architecture,
minimal risk, and clear security value. Helmet closes the header-related
findings (#17 X-Frame-Options/CSP, #18 CSRF context via X-Frame-Options).
Error sanitization closes the information-leak findings (#30 error_message
leak, #31 SMS error leak).

Together they close all actionable security findings from the review without
touching auth, caching, or database patterns.

## Key Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| CSRF protection | Skip | Basic Auth via header, not cookies — not vulnerable |
| Pipeline error_message | Keep raw | Only user is behind Basic Auth; debugging value > security risk |
| Error sanitization scope | SMS + analyze only | These are response bodies visible in network tools |
| Helmet config | Needs CSP decision | Defaults may block inline scripts/styles in dashboard.html — see Open Questions |

## Open Questions

1. **Helmet CSP vs. inline dashboard code.** Helmet's default CSP sets
   `script-src 'self'` which blocks inline `<script>` tags. The dashboard is
   2,092 lines with all JS and CSS inline. Options: (a) add
   `contentSecurityPolicy: false` to disable CSP entirely, (b) allow
   `'unsafe-inline'` for scripts and styles, (c) extract JS/CSS to separate
   files and use strict CSP. Plan phase must check Helmet 8.x defaults and
   decide.

## Three Questions

### 1. Hardest decision in this session?

Whether to sanitize the `error_message` field in `shapeLead`. It's the same
pattern as SMS/analyze errors (raw `err.message` in API response), but the use
case is different: it's displayed in the dashboard UI behind Basic Auth, not in
a public-facing response body. Keeping it raw means faster debugging; sanitizing
means a cleaner security posture. Went with "keep raw" because the threat model
doesn't justify the debugging cost for a single-user app.

### 2. What did you reject, and why?

Rejected including rate limiting and Insights caching in this batch. Both are
"small features" that need design decisions (which endpoints? what TTL? how to
invalidate?). They'd expand a 30-minute session into a multi-hour one for P3
findings that aren't blocking.

### 3. Least confident about going into the next phase?

Helmet's default CSP may block inline `<script>` and `<style>` tags in
`dashboard.html`. The dashboard is a 2,092-line monolith with all CSS and JS
inline. If Helmet's default CSP includes `script-src 'self'` (no `'unsafe-inline'`),
the dashboard will break. The plan phase needs to check Helmet's defaults and
decide whether to allow `'unsafe-inline'` or configure CSP manually.
