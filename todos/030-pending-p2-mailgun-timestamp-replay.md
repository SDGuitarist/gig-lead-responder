---
status: pending
priority: p2
issue_id: "030"
tags: [code-review, security, webhook]
dependencies: []
unblocks: []
sub_priority: 5
---

# 030: Mailgun webhook missing timestamp replay protection

## Problem Statement

The Mailgun signature verification (`webhook.ts:15-37`) validates the HMAC correctly using `timingSafeEqual`, but does not check whether the `timestamp` is recent. A captured valid payload can be replayed indefinitely. The `mailgun_message_id` dedup mitigates re-processing, but a crafted email with a different Message-Id would bypass dedup.

**Found by:** Security Sentinel

## Findings

- `src/webhook.ts:15-37` -- HMAC verified, timestamp used as input but not validated against current time
- Mailgun docs recommend rejecting timestamps older than 5 minutes

## Proposed Solutions

### Solution A: Add timestamp age check (Recommended)
**Effort:** Small (3 lines) | **Risk:** Low
```typescript
const age = Math.abs(Date.now() / 1000 - Number(timestamp));
if (age > 300) return false; // 5-minute window
```

## Acceptance Criteria

- [ ] Webhook rejects payloads with timestamps older than 5 minutes
- [ ] Warning logged for rejected replays

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-05 | Created from final verification review | HMAC without timestamp check = replay risk |
