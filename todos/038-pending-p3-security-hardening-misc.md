---
status: pending
priority: p3
issue_id: "038"
tags: [code-review, security]
dependencies: []
unblocks: []
sub_priority: 4
---

# 038: Security hardening -- static files, webhook rate limits, error logs

## Problem Statement

Defense-in-depth improvements that reduce attack surface without fixing active vulnerabilities: (1) static files served before auth exposes page structure, (2) webhook endpoints have no rate limiting, (3) error logs may include sensitive data from LLM responses.

**Found by:** Security Sentinel

## Findings

- `src/server.ts:64` -- `express.static()` before auth middleware
- `src/server.ts:67-70` -- webhook routes have no rate limiter
- `src/post-pipeline.ts:85`, `src/twilio-webhook.ts:245-262` -- full error objects logged

## Proposed Solutions

### Solution A: Incremental hardening
1. Move `express.static()` after `sessionAuth` (exclude /health)
2. Add conservative rate limiter (60/min/IP) on webhook routes
3. Log only `err.message` and `err.code`, not full error objects

**Effort:** Small | **Risk:** Low

## Acceptance Criteria

- [ ] Static files require authentication
- [ ] Webhook endpoints rate-limited
- [ ] Error logs sanitized

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-05 | Created from final verification review | Defense-in-depth, not active vulnerabilities |
