---
status: done
priority: p1
issue_id: "006"
tags: [code-review, security]
dependencies: []
unblocks: ["007"]
sub_priority: 1
---

# 006: Production guard misses RAILWAY_ENVIRONMENT check

## Problem Statement

The startup guard in `server.ts:17` that blocks `DISABLE_TWILIO_VALIDATION` and `DISABLE_MAILGUN_VALIDATION` in production only checks `process.env.NODE_ENV === "production"`. Railway does NOT automatically set `NODE_ENV=production`. The auth module (`auth.ts:13,97,120`) and Twilio webhook (`twilio-webhook.ts:39`) correctly check `RAILWAY_ENVIRONMENT` as a fallback, but the startup crash guard does not.

If `NODE_ENV` is unset on Railway, the validation bypass flags would NOT trigger the fatal crash, allowing the app to run with webhook validation disabled in production.

**Found by:** Security Sentinel
**Known pattern:** `docs/solutions/architecture/environment-aware-fatal-guards.md`

## Findings

- `server.ts:17` — only checks `NODE_ENV === "production"`, misses `RAILWAY_ENVIRONMENT`
- `auth.ts:13` — correctly uses `process.env.NODE_ENV === "production" || !!process.env.RAILWAY_ENVIRONMENT`
- `twilio-webhook.ts:39` — correctly checks `RAILWAY_ENVIRONMENT`
- Inconsistency between startup guard and runtime guards

## Proposed Solutions

### Option A: Add RAILWAY_ENVIRONMENT to startup guard (Recommended)
```typescript
const isProd = process.env.NODE_ENV === "production" || !!process.env.RAILWAY_ENVIRONMENT;
```
- Pros: One-line fix, matches existing pattern in auth.ts
- Cons: None
- Effort: Small
- Risk: None

## Recommended Action

Option A — one-line fix.

## Technical Details

- **Affected files:** `src/server.ts`
- **Components:** Startup validation

## Acceptance Criteria

- [ ] `server.ts` startup guard uses same production detection as `auth.ts`
- [ ] App crashes on startup if bypass flags are set in Railway environment

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-04 | Created from review cycle 2 | |

## Resources

- Security Sentinel agent report
- `docs/solutions/architecture/environment-aware-fatal-guards.md`
