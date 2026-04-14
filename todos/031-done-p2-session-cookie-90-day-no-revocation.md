---
status: done
priority: p2
issue_id: "031"
tags: [code-review, security, auth]
dependencies: []
unblocks: []
sub_priority: 6
---

# 031: 90-day session cookie with no revocation mechanism

## Problem Statement

`COOKIE_MAX_AGE_S` in `auth.ts:8` is 90 days. There is no logout endpoint, no server-side session store, and no way to invalidate a stolen cookie short of rotating `COOKIE_SECRET`. Single-user dashboard limits blast radius, but 90 days is excessive.

**Found by:** Security Sentinel

## Proposed Solutions

### Solution A: Reduce to 7-14 days + add /logout (Recommended)
**Effort:** Small | **Risk:** Low

## Acceptance Criteria

- [ ] Cookie max age reduced to 14 days
- [ ] `/logout` endpoint clears the session cookie
- [ ] Dashboard logout button or link added

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-05 | Created from final verification review | No revocation = long exposure window |
