# Brainstorm: Rate Limiting for Cost-Sensitive Endpoints

**Date:** 2026-02-26
**Issue:** #5
**Origin:** P2 #6 from `docs/reviews/fix-batch-d-quick-wins/REVIEW-SUMMARY.md`

## What We're Building

Per-route rate limiting on the two API endpoints that call paid external APIs:

- `POST /api/analyze` — calls Anthropic (Claude) API. **5 requests per 15 minutes.**
- `POST /api/leads/:id/approve` — calls Twilio SMS API. **10 requests per 15 minutes.**

## Why This Approach

- **API-only scope.** Webhooks (`/webhook/mailgun`, `/webhook/twilio`) already have
  signature validation — forged requests are rejected before hitting paid APIs. Rate
  limiting them adds complexity for no real benefit.
- **Per-route, not global.** Read endpoints (`GET /api/leads`, `/api/stats`,
  `/api/analytics`) don't call external APIs and don't need protection. A global
  limiter would add config noise and risk false positives on dashboard refreshes.
- **Tight limits.** Single-user app — 5 analyze and 10 approve requests per 15
  minutes is well above normal usage. These catch runaway scripts or leaked
  credentials, not traffic spikes.

## Key Decisions

1. **Scope:** API endpoints only (analyze + approve)
2. **Library:** `express-rate-limit` (standard, zero-config in-memory store)
3. **Limits:** 5/15min for analyze, 10/15min for approve
4. **Store:** In-memory (default). Single-process app on Railway, no need for Redis.
5. **Response:** Standard 429 Too Many Requests with generic message (no error details)

## Open Questions

None — all decisions resolved in brainstorm dialogue.

## Three Questions

1. **Hardest decision in this session?** Whether to rate limit webhooks too.
   Signature validation already blocks unauthorized requests, so rate limiting
   would be pure defense-in-depth. Decided against it — the validation is the
   real security layer, and rate limiting webhooks could interfere with
   legitimate burst scenarios (multiple leads arriving simultaneously).

2. **What did you reject, and why?** Global API rate limiting with stricter
   per-route overrides. More protective in theory, but adds config complexity
   for routes that only read from SQLite. The cost risk is specifically on
   the two endpoints that call paid APIs.

3. **Least confident about going into the next phase?** Whether the in-memory
   store resets on Railway deploys. If the app restarts frequently, rate limits
   effectively reset each time. Acceptable for a single-user app — the limits
   catch sustained abuse, not one-off spikes.
