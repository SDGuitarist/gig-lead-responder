---
status: done
priority: p2
issue_id: "008"
tags: [code-review, security]
dependencies: ["006"]
unblocks: []
sub_priority: 1
---

# 008: Mailgun webhook has no inline production guard

## Problem Statement

The Twilio webhook (`twilio-webhook.ts:38-42`) has defense-in-depth: even if `DISABLE_TWILIO_VALIDATION=true`, it returns `false` in production/Railway. The Mailgun webhook (`webhook.ts:47`) has no such inline guard — it trusts the startup check in `server.ts` entirely.

Combined with finding 006 (startup guard missing `RAILWAY_ENVIRONMENT`), if the startup guard fails to detect production, Mailgun validation is completely bypassed. An attacker could forge webhook payloads to inject leads, consuming Claude API credits and sending unwanted SMS.

**Found by:** Security Sentinel
**Known pattern:** `docs/solutions/architecture/environment-aware-fatal-guards.md`

## Proposed Solutions

### Option A: Add inline guard matching Twilio pattern (Recommended)
Add the same production check that `twilio-webhook.ts` uses.
- Effort: Small
- Risk: None

## Technical Details

- **Affected files:** `src/webhook.ts`

## Acceptance Criteria

- [ ] Mailgun webhook has inline production guard matching Twilio's pattern
- [ ] Bypass returns 401 in production even if flag is set

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-04 | Created from review cycle 2 | |
