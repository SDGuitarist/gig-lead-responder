---
status: done
priority: p2
issue_id: "010"
tags: [code-review, security]
dependencies: []
unblocks: []
sub_priority: 3
---

# 010: Missing HSTS header

## Problem Statement

Security headers middleware sets `X-Frame-Options`, `X-Content-Type-Options`, and CSP, but does NOT set `Strict-Transport-Security`. Railway provides HTTPS, but without HSTS a first-time visitor could be subject to protocol downgrade attack.

**Found by:** Security Sentinel

## Proposed Solutions

### Option A: Add HSTS in production only (Recommended)
```typescript
if (process.env.NODE_ENV === "production" || process.env.RAILWAY_ENVIRONMENT) {
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
}
```
Also add `Referrer-Policy: strict-origin-when-cross-origin` and `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
- Effort: Small
- Risk: None

## Technical Details

- **Affected files:** `src/server.ts`

## Acceptance Criteria

- [ ] HSTS header set in production
- [ ] Referrer-Policy and Permissions-Policy headers added

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-04 | Created from review cycle 2 | |
